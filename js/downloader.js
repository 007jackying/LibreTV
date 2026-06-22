// LibreTV M3U8 Downloader
// Parses M3U8 playlists (including master playlists) via the existing proxy,
// downloads segments concurrently, and saves as .ts using File System Access
// API when available, Blob URL as fallback for short clips.
//
// AES-encrypted streams are not supported in this build.

(function () {

// ─── M3U8 parser ─────────────────────────────────────────────────────────────

function applyUrl(target, base) {
    if (/^https?:\/\//.test(target)) return target;
    try {
        return new URL(target, base).href;
    } catch {
        const parts = base.split('/'); parts.pop();
        return parts.join('/') + '/' + target.replace(/^\//, '');
    }
}

async function fetchM3U8Text(url) {
    const proxied = PROXY_URL + encodeURIComponent(url);
    const res = await fetch(proxied, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

async function parseM3U8(url, depth = 0) {
    if (depth > 3) throw new Error('M3U8 嵌套层级过深');
    const text = await fetchM3U8Text(url);
    if (!text.trim().startsWith('#EXTM3U')) throw new Error('无效的 M3U8 链接');

    // Master playlist → follow highest-bandwidth stream
    if (text.includes('#EXT-X-STREAM-INF')) {
        const lines = text.split('\n');
        let best = null, bestBw = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
                const bwM = lines[i].match(/BANDWIDTH=(\d+)/);
                const bw = bwM ? +bwM[1] : 0;
                const next = lines[i + 1]?.trim();
                if (next && !next.startsWith('#') && bw > bestBw) {
                    best = applyUrl(next, url); bestBw = bw;
                }
            }
        }
        if (!best) throw new Error('主播放列表中未找到子流');
        return parseM3U8(best, depth + 1);
    }

    // Media playlist
    const segments = [];
    let hasKey = false;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i].trim();
        if (l.startsWith('#EXT-X-KEY')) hasKey = true;
        if (l && !l.startsWith('#')) segments.push(applyUrl(l, url));
    }
    if (!segments.length) throw new Error('未找到视频片段');
    return { segments, hasKey, baseUrl: url };
}

// ─── Pause/resume ─────────────────────────────────────────────────────────────
// Bug fix: use a shared Promise so that all concurrent waiters unblock together
// when resume is called. The old single-resolve approach only unblocked the last
// waiter, leaving all others hanging permanently.

let _pausePromise = null;
let _pauseResolve = null;

async function waitIfPaused() {
    // while loop handles the edge case of being paused again immediately
    while (_pausePromise) await _pausePromise;
}

function pauseDownloads() {
    if (!_pausePromise) {
        _pausePromise = new Promise(r => { _pauseResolve = r; });
    }
}

function resumeDownloads() {
    if (_pauseResolve) {
        _pauseResolve();
        _pauseResolve = null;
        _pausePromise = null;
    }
}

// ─── Segment fetch ────────────────────────────────────────────────────────────

let _abort = null;

async function downloadSegment(url, signal, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const proxied = PROXY_URL + encodeURIComponent(url);
            const res = await fetch(proxied, { signal });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.arrayBuffer();
        } catch (e) {
            if (e.name === 'AbortError') throw e;
            if (attempt === retries) throw e;
            await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        }
    }
}

// ─── File System Access API path (Chrome/Edge 86+) ───────────────────────────
// Streams directly to disk — no RAM limit.

async function downloadWithFSA(parsed, title, onProgress) {
    const handle = await window.showSaveFilePicker({
        suggestedName: sanitizeFilename(title) + '.ts',
        types: [{ description: 'TS Video', accept: { 'video/MP2T': ['.ts'] } }],
    });
    const writable = await handle.createWritable();
    const signal = _abort.signal;
    const total = parsed.segments.length;
    let done = 0, failed = 0;

    const CONC = 4;
    const queue = [...parsed.segments.entries()]; // [[idx, url], ...]
    const inFlight = new Set();
    const buf = new Map(); // idx → ArrayBuffer | null
    let writeIdx = 0;
    let fetchIdx = 0;

    const fetchOne = async ([idx, url]) => {
        await waitIfPaused();
        try {
            buf.set(idx, await downloadSegment(url, signal));
        } catch {
            failed++;
            buf.set(idx, null); // mark failed so pump doesn't stall
        }
    };

    // Pump: keep CONC fetches in flight, write segments in order.
    // Lookahead capped at CONC*2 to bound buffered RAM.
    const pump = async () => {
        while (writeIdx < total) {
            while (fetchIdx < total && inFlight.size < CONC && (fetchIdx - writeIdx) < CONC * 2) {
                const entry = queue[fetchIdx++];
                const p = fetchOne(entry).then(() => inFlight.delete(p));
                inFlight.add(p);
            }
            // Wait until the next segment to write is buffered
            while (!buf.has(writeIdx)) {
                if (inFlight.size === 0) break; // all fetches done (all failed)
                await Promise.race(inFlight);
            }
            const data = buf.get(writeIdx);
            buf.delete(writeIdx);
            if (data) await writable.write(new Uint8Array(data));
            writeIdx++;
            done++;
            onProgress(done, total, failed);
        }
    };

    // Bug fix: ensure writable is always closed/aborted so the file handle is
    // released even when download is cancelled or an error occurs mid-stream.
    try {
        await pump();
        await writable.close();
    } catch (e) {
        try { await writable.abort(); } catch {}
        throw e;
    }
    return { done, failed };
}

// ─── Blob fallback (Firefox / Safari) ────────────────────────────────────────
// Holds all segments in RAM — only feasible for short clips.

const BLOB_SEGMENT_LIMIT = 300; // ~5 min at 1 s/segment

async function downloadWithBlob(parsed, title, onProgress) {
    if (parsed.segments.length > BLOB_SEGMENT_LIMIT) {
        throw new Error(
            `视频片段过多（${parsed.segments.length}个），请使用支持 File System Access API 的浏览器（Chrome/Edge）下载完整视频`
        );
    }
    const signal = _abort.signal;
    const total = parsed.segments.length;
    const buffers = new Array(total).fill(null);
    let done = 0, failed = 0;
    const CONC = 4;

    const downloadOne = async (idx) => {
        await waitIfPaused();
        try {
            buffers[idx] = await downloadSegment(parsed.segments[idx], signal);
        } catch { failed++; }
        done++;
        onProgress(done, total, failed);
    };

    for (let i = 0; i < total; i += CONC) {
        if (signal.aborted) break;
        await Promise.all(
            parsed.segments.slice(i, i + CONC).map((_, j) => downloadOne(i + j))
        );
    }

    const blob = new Blob(buffers.filter(Boolean), { type: 'video/MP2T' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = sanitizeFilename(title) + '.ts';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
    return { done, failed };
}

function sanitizeFilename(name) {
    return (name || 'video').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

// ─── UI ───────────────────────────────────────────────────────────────────────

let _panel = null;
let _state = 'idle'; // idle | parsing | downloading | paused | done | error

function buildPanel() {
    const el = document.createElement('div');
    el.id = 'dlPanel';
    el.style.cssText = `position:fixed;bottom:24px;right:24px;width:320px;background:#111;
        border:1px solid #333;border-radius:12px;padding:16px;z-index:9999;
        box-shadow:0 8px 32px rgba(0,0,0,.7);font-family:system-ui,sans-serif;`;
    el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-weight:600;color:#fff;font-size:14px">📥 下载视频</span>
            <button id="dlClose" style="background:none;border:none;color:#888;cursor:pointer;font-size:18px;line-height:1">×</button>
        </div>
        <div id="dlEncNote" style="display:none;background:#2a1a0a;border:1px solid #7c3a0a;border-radius:6px;
             padding:8px;font-size:12px;color:#f59e0b;margin-bottom:10px">
            ⚠ 此视频可能使用 AES 加密，下载的文件可能无法正常播放
        </div>
        <div id="dlStatusMsg" style="font-size:12px;color:#aaa;margin-bottom:10px;min-height:18px"></div>
        <div style="background:#222;border-radius:4px;height:6px;overflow:hidden;margin-bottom:10px">
            <div id="dlBar" style="height:100%;width:0%;background:#ec4899;transition:width .3s"></div>
        </div>
        <div id="dlCountMsg" style="font-size:11px;color:#666;margin-bottom:12px;min-height:16px"></div>
        <div style="display:flex;gap:8px">
            <button id="dlStart" style="flex:1;padding:8px;background:#ec4899;color:#fff;border:none;
                border-radius:6px;cursor:pointer;font-size:13px;font-weight:600">开始下载</button>
            <button id="dlPause" style="flex:1;padding:8px;background:#333;color:#fff;border:none;
                border-radius:6px;cursor:pointer;font-size:13px;display:none">暂停</button>
            <button id="dlCancel" style="padding:8px 12px;background:#333;color:#aaa;border:none;
                border-radius:6px;cursor:pointer;font-size:13px;display:none">取消</button>
        </div>
    `;
    document.body.appendChild(el);

    el.querySelector('#dlClose').addEventListener('click', () => {
        if (_state === 'downloading' || _state === 'paused') {
            if (!confirm('下载进行中，确认取消？')) return;
            cancelDownload();
        }
        el.remove(); _panel = null; _state = 'idle';
    });

    el.querySelector('#dlStart').addEventListener('click', startDownload);

    el.querySelector('#dlPause').addEventListener('click', () => {
        if (_state === 'paused') {
            resumeDownloads();
            _state = 'downloading';
            el.querySelector('#dlPause').textContent = '暂停';
            setStatus('下载中...');
        } else {
            pauseDownloads();
            _state = 'paused';
            el.querySelector('#dlPause').textContent = '继续';
            setStatus('已暂停');
        }
    });

    el.querySelector('#dlCancel').addEventListener('click', cancelDownload);

    return el;
}

function setStatus(msg) {
    if (_panel) _panel.querySelector('#dlStatusMsg').textContent = msg;
}

function setProgress(done, total, failed) {
    if (!_panel) return;
    const pct = total ? Math.round(done / total * 100) : 0;
    _panel.querySelector('#dlBar').style.width = pct + '%';
    _panel.querySelector('#dlCountMsg').textContent =
        `${done} / ${total} 片段${failed ? `  ⚠ ${failed} 个失败` : ''}`;
}

function cancelDownload() {
    _abort?.abort();
    resumeDownloads(); // unblock any paused waiters so they can see the abort signal
    _state = 'idle';
    setStatus('已取消');
    setUI('idle');
}

function setUI(state) {
    if (!_panel) return;
    const start  = _panel.querySelector('#dlStart');
    const pause  = _panel.querySelector('#dlPause');
    const cancel = _panel.querySelector('#dlCancel');
    start.style.display  = state === 'idle' || state === 'done' || state === 'error' ? '' : 'none';
    pause.style.display  = state === 'downloading' || state === 'paused' ? '' : 'none';
    cancel.style.display = state === 'downloading' || state === 'paused' ? '' : 'none';
    start.textContent = state === 'done' ? '再次下载' : state === 'error' ? '重试' : '开始下载';
}

async function startDownload() {
    const videoUrl = getCurrentVideoUrl();
    if (!videoUrl) { setStatus('未检测到视频链接，请先播放视频'); return; }

    _abort = new AbortController();
    resumeDownloads(); // clear any stale pause from previous run
    _state = 'parsing';
    setUI('downloading');
    setProgress(0, 0, 0);
    setStatus('正在解析 M3U8...');

    try {
        const parsed = await parseM3U8(videoUrl);

        if (parsed.hasKey && _panel) {
            _panel.querySelector('#dlEncNote').style.display = '';
        }

        setStatus(`已解析 ${parsed.segments.length} 个片段，开始下载...`);
        _state = 'downloading';

        const title = document.getElementById('videoTitle')?.textContent || 'video';
        const onProgress = (done, total, failed) => {
            setProgress(done, total, failed);
            setStatus(`下载中... ${Math.round(done / total * 100)}%`);
        };

        let result;
        if ('showSaveFilePicker' in window) {
            result = await downloadWithFSA(parsed, title, onProgress);
        } else {
            result = await downloadWithBlob(parsed, title, onProgress);
        }

        _state = 'done';
        setStatus(`✅ 下载完成！${result.failed ? ` (${result.failed} 个片段失败)` : ''}`);
        setProgress(result.done, parsed.segments.length, result.failed);
        setUI('done');
    } catch (e) {
        if (e.name === 'AbortError') {
            // cancelDownload already reset state; nothing to do here
            return;
        }
        _state = 'error';
        setStatus('❌ ' + (e.message || '下载失败'));
        setUI('error');
    }
}

function getCurrentVideoUrl() {
    if (window.currentVideoUrl) return window.currentVideoUrl;
    return new URLSearchParams(location.search).get('url') || '';
}

// ─── Public API ───────────────────────────────────────────────────────────────

window.showDownloadPanel = function () {
    if (_panel) {
        // Panel already open — flash border to draw attention
        _panel.style.boxShadow = '0 0 0 2px #ec4899, 0 8px 32px rgba(0,0,0,.7)';
        setTimeout(() => {
            if (_panel) _panel.style.boxShadow = '0 8px 32px rgba(0,0,0,.7)';
        }, 600);
        return;
    }
    _panel = buildPanel();
    setStatus(getCurrentVideoUrl() ? '点击"开始下载"开始' : '播放视频后即可下载');
    setUI('idle');
};

})();
