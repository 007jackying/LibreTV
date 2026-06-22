// LibreTV Live TV — M3U IPTV player
// Parses M3U playlists fetched through the existing proxy, groups channels,
// plays via hls.js, persists favourites + custom sources in localStorage.

const LIVE_STORAGE_SOURCES = 'liveCustomSources';
const LIVE_STORAGE_LAST_SOURCE = 'liveLastSource';
const LIVE_STORAGE_LAST_CHANNEL = 'liveLastChannel';
const LIVE_STORAGE_FAVOURITES = 'liveFavourites';

// ─── M3U parser ──────────────────────────────────────────────────────────────

function parseM3U(text) {
    const channels = [];
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let meta = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('#EXTINF:')) {
            const tvgId    = (line.match(/tvg-id="([^"]*)"/)    || [])[1] || '';
            const logo     = (line.match(/tvg-logo="([^"]*)"/)  || [])[1] || '';
            const group    = (line.match(/group-title="([^"]*)"/) || [])[1] || '未分组';
            const nameMatch = line.match(/,([^,]*)$/);
            const name     = nameMatch ? nameMatch[1].trim() : '';
            meta = { tvgId, logo, group, name };
        } else if (meta && !line.startsWith('#')) {
            if (meta.name && line) channels.push({ ...meta, url: line, id: channels.length });
            meta = null;
        }
    }
    return channels;
}

function groupChannels(channels) {
    const groups = {};
    channels.forEach(ch => {
        if (!groups[ch.group]) groups[ch.group] = [];
        groups[ch.group].push(ch);
    });
    return groups;
}

// ─── HLS player ──────────────────────────────────────────────────────────────

let hls = null;

function playChannel(channel) {
    const video = document.getElementById('liveVideo');
    const nameEl = document.getElementById('liveChannelName');
    if (!video) return;

    if (nameEl) nameEl.textContent = channel.name;
    document.title = `${channel.name} — 直播 · LibreTV`;

    localStorage.setItem(LIVE_STORAGE_LAST_CHANNEL, JSON.stringify({ id: channel.id, sourceKey: currentSourceKey }));

    // Highlight active channel
    document.querySelectorAll('.ch-item').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.ch-item[data-id="${channel.id}"]`);
    if (activeEl) { activeEl.classList.add('active'); activeEl.scrollIntoView({ block: 'nearest' }); }

    const streamUrl = PROXY_URL + encodeURIComponent(channel.url);

    if (hls) { hls.destroy(); hls = null; }
    video.src = '';

    if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false });
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
        hls.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal) showLiveToast('播放失败，请尝试其他频道', 'error');
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(() => {});
    } else {
        showLiveToast('当前浏览器不支持 HLS 播放', 'error');
    }
}

// ─── State ────────────────────────────────────────────────────────────────────

let allChannels = [];
let filteredChannels = [];
let currentGroup = '';
let currentSourceKey = '';
let favourites = new Set();

// ─── Render ───────────────────────────────────────────────────────────────────

function renderGroups(groups) {
    const container = document.getElementById('groupTabs');
    if (!container) return;
    const allGroups = Object.keys(groups);
    container.innerHTML = `
        <button class="group-tab active" data-group="">全部 (${allChannels.length})</button>
        <button class="group-tab" data-group="__fav__">❤ 收藏 (${favourites.size})</button>
        ${allGroups.map(g =>
            `<button class="group-tab" data-group="${esc(g)}">${esc(g)} (${groups[g].length})</button>`
        ).join('')}
    `;
    container.querySelectorAll('.group-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentGroup = btn.dataset.group;
            container.querySelectorAll('.group-tab').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            applyFilter();
        });
    });
}

function applyFilter() {
    const query = (document.getElementById('chSearch')?.value || '').toLowerCase();
    let base = currentGroup === '__fav__'
        ? allChannels.filter(ch => favourites.has(ch.id))
        : currentGroup
            ? allChannels.filter(ch => ch.group === currentGroup)
            : allChannels;

    filteredChannels = query ? base.filter(ch => ch.name.toLowerCase().includes(query)) : base;
    renderChannelList(filteredChannels);
}

function renderChannelList(channels) {
    const container = document.getElementById('channelList');
    if (!container) return;
    if (!channels.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm text-center py-8">暂无频道</div>';
        return;
    }
    container.innerHTML = channels.map(ch => `
        <div class="ch-item flex items-center gap-2 px-3 py-2 cursor-pointer rounded hover:bg-[#2a2a2a] transition-colors"
             data-id="${ch.id}" onclick="onChannelClick(${ch.id})">
            ${ch.logo
                ? `<img src="${esc(ch.logo)}" alt="" class="w-8 h-8 rounded object-contain bg-[#222] flex-shrink-0" onerror="this.style.display='none'">`
                : `<div class="w-8 h-8 rounded bg-[#333] flex-shrink-0 flex items-center justify-center text-xs text-gray-400">TV</div>`
            }
            <span class="flex-1 text-sm truncate">${esc(ch.name)}</span>
            <button class="fav-btn text-lg leading-none flex-shrink-0 ${favourites.has(ch.id) ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}"
                    onclick="event.stopPropagation(); toggleFav(${ch.id})" title="收藏">♥</button>
        </div>
    `).join('');
}

function onChannelClick(id) {
    const ch = allChannels.find(c => c.id === id);
    if (!ch) return;
    playChannel(ch);
    // Close sidebar on mobile after channel selection so player is visible
    if (window.innerWidth < 640) {
        document.getElementById('channelSidebar')?.classList.add('hidden');
    }
}

function toggleFav(id) {
    if (favourites.has(id)) favourites.delete(id);
    else favourites.add(id);
    localStorage.setItem(LIVE_STORAGE_FAVOURITES, JSON.stringify([...favourites]));
    // re-render fav buttons without full list rerender
    document.querySelectorAll('.fav-btn').forEach(btn => {
        const chId = parseInt(btn.closest('.ch-item')?.dataset.id);
        if (!isNaN(chId)) btn.className = `fav-btn text-lg leading-none flex-shrink-0 ${favourites.has(chId) ? 'text-red-400' : 'text-gray-600 hover:text-red-400'}`;
    });
    // update fav count in tab
    const favTab = document.querySelector('.group-tab[data-group="__fav__"]');
    if (favTab) favTab.textContent = `❤ 收藏 (${favourites.size})`;
    if (currentGroup === '__fav__') applyFilter();
}

// ─── Source loading ────────────────────────────────────────────────────────────

async function loadSource(key, url) {
    showLiveLoading(true);
    currentSourceKey = key;

    try {
        const proxyUrl = PROXY_URL + encodeURIComponent(url);
        const controller = new AbortController();
        const tid = setTimeout(() => controller.abort(), 30000);
        const res = await fetch(proxyUrl, { signal: controller.signal });
        clearTimeout(tid);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        allChannels = parseM3U(text);
        if (!allChannels.length) { showLiveToast('未解析到频道，请检查M3U地址', 'warning'); return; }

        const groups = groupChannels(allChannels);
        currentGroup = '';
        filteredChannels = [...allChannels];
        renderGroups(groups);
        renderChannelList(allChannels);
        localStorage.setItem(LIVE_STORAGE_LAST_SOURCE, key);
        showLiveToast(`已加载 ${allChannels.length} 个频道`, 'success');

        // restore last channel if same source
        const saved = JSON.parse(localStorage.getItem(LIVE_STORAGE_LAST_CHANNEL) || 'null');
        if (saved && saved.sourceKey === key) {
            const ch = allChannels.find(c => c.id === saved.id);
            if (ch) playChannel(ch);
        }
    } catch (err) {
        const msg = err.name === 'AbortError' ? '加载超时，请检查M3U地址' : `加载失败: ${err.message}`;
        showLiveToast(msg, 'error');
    } finally {
        showLiveLoading(false);
    }
}

// ─── Source management UI ─────────────────────────────────────────────────────

function getSources() {
    try { return JSON.parse(localStorage.getItem(LIVE_STORAGE_SOURCES) || '[]'); }
    catch { return []; }
}

function saveSources(sources) {
    localStorage.setItem(LIVE_STORAGE_SOURCES, JSON.stringify(sources));
}

function renderSourceList() {
    const container = document.getElementById('sourceList');
    if (!container) return;
    const sources = getSources();
    if (!sources.length) {
        container.innerHTML = '<div class="text-gray-500 text-sm text-center py-4">暂无自定义直播源，请添加M3U地址</div>';
        return;
    }
    container.innerHTML = sources.map((s, i) => `
        <div class="flex items-center gap-2 py-2 border-b border-[#333]">
            <button onclick="selectSource(${i})"
                    class="flex-1 text-left text-sm truncate hover:text-pink-400 transition-colors ${currentSourceKey === String(i) ? 'text-pink-400 font-medium' : ''}">
                ${esc(s.name)}
            </button>
            <button onclick="deleteSource(${i})" class="text-gray-500 hover:text-red-400 text-xs px-2">删除</button>
        </div>
    `).join('');
}

function selectSource(index) {
    const sources = getSources();
    if (!sources[index]) return;
    document.getElementById('sourcePanel')?.classList.add('hidden');
    loadSource(String(index), sources[index].url);
    renderSourceList();
}

function deleteSource(index) {
    const sources = getSources();
    sources.splice(index, 1);
    saveSources(sources);
    renderSourceList();
}

function addSource() {
    const nameEl = document.getElementById('newSourceName');
    const urlEl  = document.getElementById('newSourceUrl');
    const name = nameEl?.value.trim();
    const url  = urlEl?.value.trim();
    if (!name || !url) { showLiveToast('请填写名称和M3U地址', 'warning'); return; }
    if (!url.startsWith('http')) { showLiveToast('请输入有效的URL地址', 'warning'); return; }

    const sources = getSources();
    sources.push({ name, url });
    saveSources(sources);
    if (nameEl) nameEl.value = '';
    if (urlEl) urlEl.value = '';
    renderSourceList();
    showLiveToast('已添加直播源', 'success');
    // auto-load if first source
    if (sources.length === 1) selectSource(0);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showLiveLoading(show) {
    const el = document.getElementById('liveLoading');
    if (el) el.classList.toggle('hidden', !show);
}

function showLiveToast(msg, type = 'info') {
    // reuse LibreTV's showToast if available, else console
    if (typeof showToast === 'function') showToast(msg, type);
    else console.log(`[${type}] ${msg}`);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // load favourites
    try { favourites = new Set(JSON.parse(localStorage.getItem(LIVE_STORAGE_FAVOURITES) || '[]')); }
    catch { favourites = new Set(); }

    renderSourceList();

    // source panel toggle
    document.getElementById('btnSourcePanel')?.addEventListener('click', () => {
        document.getElementById('sourcePanel')?.classList.toggle('hidden');
        renderSourceList();
    });
    document.getElementById('btnAddSource')?.addEventListener('click', addSource);

    // channel search
    document.getElementById('chSearch')?.addEventListener('input', applyFilter);

    // channel list toggle on mobile
    document.getElementById('btnToggleList')?.addEventListener('click', () => {
        document.getElementById('channelSidebar')?.classList.toggle('hidden');
    });

    // auto-load last source
    const lastKey = localStorage.getItem(LIVE_STORAGE_LAST_SOURCE);
    if (lastKey !== null) {
        const sources = getSources();
        const idx = parseInt(lastKey);
        if (sources[idx]) loadSource(lastKey, sources[idx].url);
    }

    // fullscreen button
    document.getElementById('btnFullscreen')?.addEventListener('click', () => {
        const video = document.getElementById('liveVideo');
        if (video?.requestFullscreen) video.requestFullscreen();
    });
});
