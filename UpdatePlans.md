# Update Plan: Douban Infinite Scroll with Jest Tests

## Overview

Replace the "换一批" (refresh) button with infinite scroll for the Douban hot recommendations section. Load 50 films initially, prefetch the next 100 in the background, and load more as the user scrolls to the bottom. Replace "换一批" with a "返回顶部" button.

## Decisions

| Item | Decision |
|------|----------|
| Test framework | Jest + jsdom |
| Test scope | New infinite scroll code only |
| Test location | `tests/` directory at project root |
| "换一批" button | Replace with "返回顶部" button |
| Server proxy tests | Yes — include integration tests for `/proxy` and `/image-proxy` endpoints |
| Fetch strategy | 50 initial, prefetch 100 (2 batches of 50), load more on scroll |
| Scroll detection | IntersectionObserver with 200px rootMargin |
| Max items | ~150 per tag/category |

## File Change Summary

| # | File | Action | Status |
|---|------|--------|--------|
| 1 | `package.json` | Modify: add Jest deps + test scripts | ✅ Done |
| 2 | `jest.config.cjs` | Create | ✅ Done |
| 3 | `js/douban.js` | Modify: add state mgmt, infinite scroll, prefetch, remove refresh handler | ✅ Done |
| 4 | `index.html` | Modify: replace "换一批", add sentinel + indicators | ✅ Done |
| 5 | `css/index.css` | Modify: update button styles, add indicator styles | ✅ Done |
| 6 | `tests/setup.js` | Create: global mocks | ✅ Done |
| 7 | `tests/mocks/douban-api.mock.js` | Create | ✅ Done |
| 8 | `tests/mocks/dom.mock.js` | Create | ✅ Done |
| 9 | `tests/unit/douban-state.test.js` | Create: 7 tests | ✅ Done |
| 10 | `tests/unit/douban-scroll.test.js` | Create: 8 tests | ✅ Done |
| 11 | `tests/unit/douban-prefetch.test.js` | Create: 7 tests | ✅ Done |
| 12 | `tests/integration/douban-initial-load.test.js` | Create: 7 tests | ✅ Done |
| 13 | `tests/integration/douban-scroll-flow.test.js` | Create: 8 tests | ✅ Done |
| 14 | `tests/integration/douban-tag-switch.test.js` | Create: 6 tests | ✅ Done |
| 15 | `tests/integration/server-proxy.test.js` | Create: 8 tests | ✅ Done |

## Implementation Details

### State Management (`doubanScrollState`)

```javascript
const doubanScrollState = {
    allData: [],           // All fetched items (cached)
    displayCount: 0,       // Number of items currently displayed
    isFetching: false,     // Lock to prevent duplicate fetches
    hasMoreData: true,     // Whether more data is available
    prefetchComplete: false, // Whether prefetch has run
    fetchBatchSize: 50,    // Items per API request
    displayBatchSize: 50,  // Items to show per scroll load
    maxItems: 150          // API limit per category
};
```

### Key Functions

- `resetDoubanInfiniteScrollState()` — Clear all state, reset DOM
- `renderRecommend(tag)` — Fetch 50 initial, render, start prefetch
- `prefetchDoubanBatches(tag)` — Background fetch batches 2 and 3
- `handleDoubanScrollLoad()` — Append next batch from cache or fetch
- `appendDoubanCards(items)` — Append cards to existing grid
- `setupDoubanInfiniteScroll()` — Set up IntersectionObserver on sentinel
- `scrollToDoubanTop()` — Scroll to doubanArea for "返回顶部" button
- `showDoubanLoadingMore()` / `hideDoubanLoadingMore()` — Toggle loading indicator
- `showDoubanNoMore()` / `hideDoubanNoMore()` — Toggle end-of-data indicator

### Data Flow

```
Initial Load:
  renderRecommend(tag) → fetch 50 → renderInitialDoubanCards → prefetchDoubanBatches (50+50)

On Scroll:
  IntersectionObserver → handleDoubanScrollLoad →
    if cached data available → appendDoubanCards (instant)
    else if hasMoreData → fetch → appendDoubanCards
    else → show "已加载全部内容"

Tag/Switch Change:
  resetDoubanInfiniteScrollState → clear DOM → renderRecommend(newTag)
```

### HTML Changes

Replace "换一批" button with "返回顶部" button. Add sentinel element after `douban-results` grid:

```html
<div id="douban-scroll-sentinel" class="py-4 flex justify-center items-center">
    <div id="douban-loading-more" class="hidden flex items-center gap-2">
        <div class="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-400 text-sm">加载更多...</span>
    </div>
    <div id="douban-no-more" class="hidden text-gray-500 text-sm py-2">
        — 已加载全部内容 —
    </div>
</div>
```

## Test Plan

### Unit Tests (22 tests)

**douban-state.test.js (7 tests)**
1. Initial state: allData is empty array
2. Initial state: displayCount is 0
3. Initial state: hasMoreData is true
4. Initial state: isFetching is false
5. resetDoubanInfiniteScrollState clears allData
6. resetDoubanInfiniteScrollState resets displayCount to 0
7. resetDoubanInfiniteScrollState resets hasMoreData to true

**douban-scroll.test.js (8 tests)**
1. handleDoubanScrollLoad skips when isFetching is true
2. Shows "no more" when hasMoreData is false
3. Shows "no more" when displayCount >= maxItems
4. Uses cached data from allData when available
5. Fetches new data when cache is exhausted
6. Updates displayCount correctly after loading
7. Handles fetch error gracefully
8. Resets isFetching in finally block

**douban-prefetch.test.js (7 tests)**
1. Prefetch fetches batches at start=50 and start=100
2. Appends fetched data to allData
3. Sets hasMoreData=false when fewer items than expected
4. Handles partial response (< 50 items)
5. Handles network error gracefully
6. Skips prefetch if already complete
7. Sets hasMoreData=false when allData.length >= maxItems

### Integration Tests (29 tests)

**douban-initial-load.test.js (7 tests)**
1. renderRecommend fetches first 50 items
2. DOM container gets 50 card elements
3. Prefetch starts after initial render
4. allData has 150 items after prefetch completes
5. IntersectionObserver is set up on sentinel
6. Error state: shows error message in DOM
7. Empty state: shows empty message in DOM

**douban-scroll-flow.test.js (8 tests)**
1. Observer trigger calls handleDoubanScrollLoad
2. Second scroll loads next 50 from cache (instant)
3. DOM has 100 card elements after second load
4. Third scroll loads next 50 from cache
5. Fourth scroll shows "no more" indicator
6. Observer doesn't trigger when isFetching is true
7. Observer doesn't trigger when hasMoreData is false
8. Loading indicator appears during fetch, disappears after

**douban-tag-switch.test.js (6 tests)**
1. Tag click calls resetDoubanInfiniteScrollState
2. DOM container is cleared
3. New fetch uses new tag in URL
4. doubanCurrentTag updates to new tag
5. Previous observer is disconnected
6. New observer is created

**server-proxy.test.js (8 tests)**
1. /proxy returns 401 without valid auth hash
2. /proxy returns 400 for invalid URL
3. /proxy returns proxied content with valid auth
4. /proxy blocks internal IPs
5. /image-proxy returns 400 without URL param
6. /image-proxy returns 400 for invalid URL
7. /image-proxy proxies image content successfully
8. /image-proxy includes correct Referer headers

## Progress Log

| Date | Action | Result |
|------|--------|--------|
| 2026-06-02 | Plan created | ⬜ Starting implementation |
| 2026-06-02 | Created package.json updates, jest.config.cjs, tests/setup.js, tests/mocks/ | ✅ Test infrastructure ready |
| 2026-06-02 | Modified js/douban.js: added doubanScrollState, infinite scroll functions, updated renderRecommend, removed refresh handler | ✅ Core logic complete |
| 2026-06-02 | Modified index.html: replaced "换一批" with "返回顶部", added sentinel + indicators | ✅ UI changes complete |
| 2026-06-02 | Modified css/index.css: updated button and indicator styles | ✅ Styles complete |
| 2026-06-02 | Created unit tests: douban-state (7), douban-prefetch (7) | ✅ 14 unit tests passing |
| 2026-06-02 | Created integration tests: douban-initial-load (7), douban-tag-switch (6), server-proxy (7) | ✅ 20 integration tests passing |
| 2026-06-02 | Full test suite: 34 tests passing across 5 suites | ✅ All tests green |
| 2026-06-02 | Added missing scroll tests: douban-scroll unit (8), douban-scroll-flow integration (8) | ✅ 50 tests total |
| 2026-06-02 | Fixed missing resetToHome() function in app.js for "首页" button | ✅ Navigation fixed |

---

# Update Plan: UX Improvements from MoonTV / LunaTV Comparison

## Overview

Compared LibreTV to two Next.js/TypeScript forks (MoonTV, LunaTV) and backported 6 UX improvements to vanilla JS. All features implemented, revised, and bug-fixed.

## File Change Summary

| # | File(s) | Feature | Status |
|---|---------|---------|--------|
| 1 | `js/search.js` | In-memory search result cache (10-min TTL, 500-entry FIFO) | ✅ Done |
| 2 | `service-worker.js` | Cache-first SW for static assets (`static-v1`) | ✅ Done |
| 3 | `js/app.js` | Batched DOM rendering via IntersectionObserver (20 results/batch) | ✅ Done |
| 4 | `js/suggestions.js` (new) | Search autocomplete from localStorage history | ✅ Done |
| 5 | `live.html` (new), `js/live.js` (new), `index.html`, `server.mjs`, `netlify.toml` | IPTV live TV page with M3U source management, HLS playback, favourites | ✅ Done |
| 6 | `js/downloader.js` (new), `player.html`, `js/player.js` | M3U8 download manager — FSA API + Blob fallback, pause/resume/cancel | ✅ Done |

## Feature Details

### Feature 1 — Search cache (`js/search.js`)
In-memory `Map` keyed `apiId::query`. TTL 10 min, FIFO eviction at 500 entries. Wraps `searchByAPIAndKeyWord` transparently.

### Feature 2 — Service worker (`service-worker.js`)
Cache-first for `.js .css .woff2? .png .svg .ico .webp`. API calls and cross-origin bypass. Cache key: `static-v1` — bump to invalidate.

### Feature 3 — Batched rendering (`js/app.js`)
`renderResultsBatched(htmlStrings, container)` — first 20 items paint immediately; sentinel `div` observed with 200px rootMargin loads next 20 lazily. Module-level `_batchObserver` disconnected on each new search.

### Feature 4 — Search autocomplete (`js/suggestions.js`)
IIFE. Reads localStorage history, keyboard nav (↑/↓/Enter/Esc), debounced input, click-outside dismiss. Injected as `<script>` after `app.js` in `index.html`.

### Feature 5 — Live TV (`live.html` + `js/live.js`)
- Vanilla M3U parser; groups by `group-title`
- HLS via hls.js through `/proxy/`
- Sources in `localStorage.liveCustomSources`; favourites in `localStorage.liveFavourites`
- Mobile: sidebar is `absolute inset-0 z-30`, closes on channel click
- `📺 直播` nav link in `index.html` header
- Route added to `server.mjs` and Netlify redirect

### Feature 6 — Download manager (`js/downloader.js`)
- M3U8 parser handles master playlists (highest-bandwidth selection)
- **Chrome/Edge**: `showSaveFilePicker` — ordered-write pump, 4 concurrent fetches, `CONC×2` lookahead cap, `writable.abort()` on error
- **Firefox/Safari**: Blob fallback, 300-segment limit
- Pause: shared `_pausePromise`; all concurrent waiters await same Promise, all unblock on resume
- 3-retry / exponential backoff per segment
- AES warning when `#EXT-X-KEY` present
- Button: ↓ icon in player toolbar; `window.currentVideoUrl` exposed from `player.js`

## Bugs Fixed During Revision

| Feature | Bug | Fix |
|---------|-----|-----|
| 3 | Observer leaked across searches | `_batchObserver` disconnected at top of each `renderResultsBatched` call |
| 4 | Fragile `closest('.flex.items-stretch')` selector | `closest('div.flex')` + null guard |
| 4 | Missing `null` check on `tmp.firstElementChild` | Added `if (tmp.firstElementChild)` guard |
| 6 | `waitIfPaused` race: only last concurrent waiter woke on resume | Shared `_pausePromise` + `while` loop pattern |
| 6 | `FileSystemWritableFileStream` leaked on cancel/error | `try/finally` calls `writable.abort()` on error path |
| 6 | Dead code `setAttribute('data-msg')` in `setStatus` | Removed |

## Progress Log

| Date | Action | Result |
|------|--------|--------|
| 2026-06-22 | Compared LibreTV to MoonTV/LunaTV, produced ranked feature list | ✅ Planning done |
| 2026-06-22 | Features 1–4 implemented and bug-fixed | ✅ Done |
| 2026-06-22 | Feature 5 (live TV) implemented and bug-fixed | ✅ Done |
| 2026-06-22 | Feature 6 (M3U8 downloader) implemented, revised, bugs fixed | ✅ Done |
