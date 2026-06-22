// 豆瓣热门电影电视剧推荐功能

// 获取豆瓣数据代理配置
function getDoubanDataProxyConfig() {
    const proxyType = localStorage.getItem('doubanDataProxyType') || 'auto';
    const proxyUrl = localStorage.getItem('doubanDataProxyUrl') || '';
    return { proxyType, proxyUrl };
}

// 保存豆瓣数据代理设置
function saveDoubanDataProxy(value) {
    localStorage.setItem('doubanDataProxyType', value);
}

// 保存豆瓣图片代理设置
function saveDoubanImageProxy(value) {
    localStorage.setItem('doubanImageProxyType', value);
    // 切换后重新加载当前豆瓣内容
    if (localStorage.getItem('doubanEnabled') === 'true') {
        resetDoubanInfiniteScrollState();
        renderRecommend(doubanCurrentTag);
    }
}

// 重置豆瓣代理设置为默认值
function resetDoubanSettings() {
    localStorage.removeItem('doubanDataProxyType');
    localStorage.removeItem('doubanImageProxyType');
    localStorage.removeItem('doubanDataProxyUrl');
    localStorage.removeItem('doubanImageProxyUrl');
    initDoubanProxySettings();
    if (localStorage.getItem('doubanEnabled') === 'true') {
        resetDoubanInfiniteScrollState();
        renderRecommend(doubanCurrentTag);
    }
    showToast('豆瓣代理设置已恢复默认', 'success');
}

// 初始化豆瓣代理设置UI（同步select选中状态）
function initDoubanProxySettings() {
    const dataSelect = document.getElementById('doubanDataProxySelect');
    const imageSelect = document.getElementById('doubanImageProxySelect');
    if (dataSelect) {
        dataSelect.value = localStorage.getItem('doubanDataProxyType') || 'auto';
    }
    if (imageSelect) {
        imageSelect.value = localStorage.getItem('doubanImageProxyType') || 'cmliussss-cdn-tencent';
    }
}

// 获取豆瓣图片代理配置（与LunaTV保持一致的代理机制）
function getDoubanImageProxyConfig() {
    const proxyType = localStorage.getItem('doubanImageProxyType') || 'cmliussss-cdn-tencent';
    const proxyUrl = localStorage.getItem('doubanImageProxyUrl') || '';
    return { proxyType, proxyUrl };
}

// 处理豆瓣图片URL，根据配置选择代理方式（与LunaTV的processImageUrl保持一致）
function processDoubanImageUrl(originalUrl) {
    if (!originalUrl || !originalUrl.includes('doubanio.com')) return originalUrl;

    const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
    switch (proxyType) {
        case 'cmliussss-cdn-tencent':
            return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img.doubanio.cmliussss.net');
        case 'cmliussss-cdn-ali':
            return originalUrl.replace(/img\d+\.doubanio\.com/g, 'img.doubanio.cmliussss.com');
        case 'custom':
            return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
        case 'server':
        default:
            return `/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    }
}

// 封面图片加载失败时，通过服务器图片代理重试，仅在有鉴权时回退到本地代理
function handleCoverError(img) {
    img.onerror = null;
    const src = img.dataset.src;
    if (!src) return;
    // 先尝试服务器图片代理（添加正确的Referer头）
    img.src = `/image-proxy?url=${encodeURIComponent(src)}`;
    img.onerror = function() {
        this.onerror = null;
        // 仅在有鉴权时才尝试本地代理，避免产生无效的401错误
        const authHash = localStorage.getItem('proxyAuthHash') || localStorage.getItem('passwordHash');
        if (!authHash) return;
        const proxied = PROXY_URL + encodeURIComponent(src)
            + `?auth=${encodeURIComponent(authHash)}&t=${Date.now()}`;
        this.src = proxied;
        this.classList.add('object-contain');
    };
}

// 豆瓣标签列表 - 修改为默认标签
let defaultMovieTags = ['热门', '最新', '经典', '豆瓣高分', '冷门佳片', '华语', '欧美', '韩国', '日本', '动作', '喜剧', '日综', '爱情', '科幻', '悬疑', '恐怖', '治愈'];
let defaultTvTags = ['热门', '美剧', '英剧', '韩剧', '日剧', '国产剧', '港剧', '日本动画', '综艺', '纪录片'];

// 用户标签列表 - 存储用户实际使用的标签（包含保留的系统标签和用户添加的自定义标签）
let movieTags = [];
let tvTags = [];

// 加载用户标签
function loadUserTags() {
    try {
        // 尝试从本地存储加载用户保存的标签
        const savedMovieTags = localStorage.getItem('userMovieTags');
        const savedTvTags = localStorage.getItem('userTvTags');
        
        // 如果本地存储中有标签数据，则使用它
        if (savedMovieTags) {
            movieTags = JSON.parse(savedMovieTags);
        } else {
            // 否则使用默认标签
            movieTags = [...defaultMovieTags];
        }
        
        if (savedTvTags) {
            tvTags = JSON.parse(savedTvTags);
        } else {
            // 否则使用默认标签
            tvTags = [...defaultTvTags];
        }
    } catch (e) {
        console.error('加载标签失败：', e);
        // 初始化为默认值，防止错误
        movieTags = [...defaultMovieTags];
        tvTags = [...defaultTvTags];
    }
}

// 保存用户标签
function saveUserTags() {
    try {
        localStorage.setItem('userMovieTags', JSON.stringify(movieTags));
        localStorage.setItem('userTvTags', JSON.stringify(tvTags));
    } catch (e) {
        console.error('保存标签失败：', e);
        showToast('保存标签失败', 'error');
    }
}

window.doubanMovieTvCurrentSwitch = 'movie';
window.doubanCurrentTag = '热门';
let doubanMovieTvCurrentSwitch = window.doubanMovieTvCurrentSwitch;
let doubanCurrentTag = window.doubanCurrentTag;

// Infinite scroll state management
var doubanScrollState = {
    allData: [],
    displayCount: 0,
    isFetching: false,
    hasMoreData: true,
    fetchBatchSize: 50,
    displayBatchSize: 50,
    prefetchBatchSize: 200,
    abortController: null,
    requestId: 0
};

// Cancel any in-flight fetch and mark state stale
function cancelDoubanFetch() {
    if (doubanScrollState.abortController) {
        doubanScrollState.abortController.abort();
        doubanScrollState.abortController = null;
    }
}

// Reset infinite scroll state and clear DOM
function resetDoubanInfiniteScrollState() {
    cancelDoubanFetch();
    doubanScrollState.allData = [];
    doubanScrollState.displayCount = 0;
    doubanScrollState.isFetching = false;
    doubanScrollState.hasMoreData = true;
    doubanScrollState.requestId++;

    const container = document.getElementById('douban-results');
    if (container) {
        container.innerHTML = '';
    }
    hideDoubanLoadingMore();
    hideDoubanNoMore();
}

// Show/hide loading more indicator (for scroll-triggered loads)
function showDoubanLoadingMore() {
    const el = document.getElementById('douban-loading-more');
    if (el) el.classList.remove('hidden');
    appendDoubanShimmerCards(8);
}

function hideDoubanLoadingMore() {
    const el = document.getElementById('douban-loading-more');
    if (el) el.classList.add('hidden');
    removeDoubanShimmerCards();
}

// Show full-grid shimmer for initial load (replaces grid content)
function showDoubanInitialLoading() {
    const container = document.getElementById('douban-results');
    if (!container) return;
    container.innerHTML = '';
    appendDoubanShimmerCards(16);
}

function appendDoubanShimmerCards(count) {
    const container = document.getElementById('douban-results');
    if (!container) return;
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
        const card = document.createElement('div');
        card.className = 'douban-shimmer-card bg-[#111] rounded-lg overflow-hidden';
        card.innerHTML = `
            <div class="relative w-full aspect-[2/3] bg-[#1a1a1a] shimmer"></div>
            <div class="p-2 space-y-2">
                <div class="h-3 bg-[#1a1a1a] shimmer rounded w-3/4"></div>
                <div class="h-3 bg-[#1a1a1a] shimmer rounded w-1/2"></div>
            </div>
        `;
        fragment.appendChild(card);
    }
    container.appendChild(fragment);
}

function removeDoubanShimmerCards() {
    const container = document.getElementById('douban-results');
    if (!container) return;
    container.querySelectorAll('.douban-shimmer-card').forEach(function(el) {
        el.remove();
    });
}

// Show/hide no more data indicator
function showDoubanNoMore() {
    const el = document.getElementById('douban-no-more');
    if (el) el.classList.remove('hidden');
}

function hideDoubanNoMore() {
    const el = document.getElementById('douban-no-more');
    if (el) el.classList.add('hidden');
}

// Scroll to top of douban area
function scrollToDoubanTop() {
    const doubanArea = document.getElementById('doubanArea');
    if (doubanArea) {
        doubanArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Set up IntersectionObserver for infinite scroll
function setupDoubanInfiniteScroll() {
    const sentinel = document.getElementById('douban-scroll-sentinel');
    if (!sentinel) return;

    if (window._doubanScrollObserver) {
        window._doubanScrollObserver.disconnect();
    }

    let scrollDebounceTimer = null;

    window._doubanScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting || doubanScrollState.isFetching || !doubanScrollState.hasMoreData) return;
            clearTimeout(scrollDebounceTimer);
            scrollDebounceTimer = setTimeout(handleDoubanScrollLoad, 200);
        });
    }, {
        root: null,
        rootMargin: '300px',
        threshold: 0
    });

    window._doubanScrollObserver.observe(sentinel);
}

// Handle scroll-triggered load more — displays from prefetch cache only
async function handleDoubanScrollLoad() {
    if (doubanScrollState.isFetching) return;

    if (!doubanScrollState.hasMoreData && doubanScrollState.displayCount >= doubanScrollState.allData.length) {
        hideDoubanLoadingMore();
        showDoubanNoMore();
        return;
    }

    const nextStart = doubanScrollState.displayCount;
    const nextEnd = Math.min(nextStart + doubanScrollState.displayBatchSize, doubanScrollState.allData.length);

    if (nextEnd <= nextStart) return;

    doubanScrollState.isFetching = true;
    showDoubanLoadingMore();

    try {
        const nextItems = doubanScrollState.allData.slice(nextStart, nextEnd);
        appendDoubanCards(nextItems);
        doubanScrollState.displayCount = nextEnd;
    } finally {
        doubanScrollState.isFetching = false;
        hideDoubanLoadingMore();
    }
}

// Prefetch next batches in background — runs continuously until API exhausted
async function prefetchDoubanBatches(tag) {
    const reqId = doubanScrollState.requestId;
    const batchSize = doubanScrollState.prefetchBatchSize;

    while (doubanScrollState.requestId === reqId && doubanScrollState.hasMoreData) {
        const start = doubanScrollState.allData.length;
        try {
            const target = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${batchSize}&page_start=${start}`;
            const data = await fetchDoubanData(target);

            if (doubanScrollState.requestId !== reqId) return;

            if (data.subjects && data.subjects.length > 0) {
                doubanScrollState.allData = doubanScrollState.allData.concat(data.subjects);
                if (data.subjects.length < batchSize) {
                    doubanScrollState.hasMoreData = false;
                    hideDoubanLoadingMore();
                    showDoubanNoMore();
                }
            } else {
                doubanScrollState.hasMoreData = false;
                hideDoubanLoadingMore();
                showDoubanNoMore();
            }
        } catch (error) {
            console.warn('Prefetch failed for start=' + start, error);
            return;
        }
    }
}

// Append cards to existing grid (for infinite scroll)
function appendDoubanCards(items) {
    const container = document.getElementById('douban-results');
    if (!container || !items || items.length === 0) return;

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bg-[#111] hover:bg-[#222] transition-all duration-300 rounded-lg overflow-hidden flex flex-col transform hover:scale-105 shadow-md hover:shadow-lg';

        const safeTitle = item.title
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');

        const safeRate = (item.rate || '暂无')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const originalCoverUrl = item.cover;
        const proxiedCoverUrl = processDoubanImageUrl(originalCoverUrl);

        card.innerHTML = `
            <div class="relative w-full aspect-[2/3] overflow-hidden cursor-pointer" onclick="fillAndSearchWithDouban('${safeTitle}')">
                <img src="${proxiedCoverUrl}" alt="${safeTitle}" data-src="${originalCoverUrl}"
                    class="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                    onerror="handleCoverError(this)"
                    loading="lazy" referrerpolicy="no-referrer">
                <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60"></div>
                <div class="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm">
                    <span class="text-yellow-400">★</span> ${safeRate}
                </div>
                <div class="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm hover:bg-[#333] transition-colors">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer" title="在豆瓣查看" onclick="event.stopPropagation();">🔗</a>
                </div>
            </div>
            <div class="p-2 text-center bg-[#111]">
                <button onclick="fillAndSearchWithDouban('${safeTitle}')"
                        class="text-sm font-medium text-white truncate w-full hover:text-pink-400 transition"
                        title="${safeTitle}">
                    ${safeTitle}
                </button>
            </div>
        `;

        fragment.appendChild(card);
    });

    container.appendChild(fragment);
}

// 初始化豆瓣功能
function initDouban() {
    // 设置豆瓣开关的初始状态
    const doubanToggle = document.getElementById('doubanToggle');
    if (doubanToggle) {
        const isEnabled = localStorage.getItem('doubanEnabled') === 'true';
        doubanToggle.checked = isEnabled;
        
        // 设置开关外观
        const toggleBg = doubanToggle.nextElementSibling;
        const toggleDot = toggleBg.nextElementSibling;
        if (isEnabled) {
            toggleBg.classList.add('bg-pink-600');
            toggleDot.classList.add('translate-x-6');
        }
        
        // 添加事件监听
        doubanToggle.addEventListener('change', function(e) {
            const isChecked = e.target.checked;
            localStorage.setItem('doubanEnabled', isChecked);
            
            // 更新开关外观
            if (isChecked) {
                toggleBg.classList.add('bg-pink-600');
                toggleDot.classList.add('translate-x-6');
            } else {
                toggleBg.classList.remove('bg-pink-600');
                toggleDot.classList.remove('translate-x-6');
            }
            
            // 更新显示状态
            updateDoubanVisibility();
        });
        
        // 初始更新显示状态
        updateDoubanVisibility();

        // 滚动到页面顶部
        window.scrollTo(0, 0);
    }

    // 初始化代理设置UI
    initDoubanProxySettings();

    // 加载用户标签
    loadUserTags();

    // 渲染电影/电视剧切换
    renderDoubanMovieTvSwitch();
    
    // 渲染豆瓣标签
    renderDoubanTags();
    
    // 设置无限滚动
    setupDoubanInfiniteScroll();
    
    // 初始加载热门内容
    if (localStorage.getItem('doubanEnabled') === 'true') {
        renderRecommend(doubanCurrentTag);
    }
}

// 根据设置更新豆瓣区域的显示状态
function updateDoubanVisibility() {
    const doubanArea = document.getElementById('doubanArea');
    if (!doubanArea) return;
    
    const isEnabled = localStorage.getItem('doubanEnabled') === 'true';
    const isSearching = document.getElementById('resultsArea') && 
        !document.getElementById('resultsArea').classList.contains('hidden');
    
    // 只有在启用且没有搜索结果显示时才显示豆瓣区域
    if (isEnabled && !isSearching) {
        doubanArea.classList.remove('hidden');
        // 如果豆瓣结果为空，重新加载
        if (document.getElementById('douban-results').children.length === 0) {
            renderRecommend(doubanCurrentTag);
        }
    } else {
        doubanArea.classList.add('hidden');
    }
}

// 只填充搜索框，不执行搜索，让用户自主决定搜索时机
function fillSearchInput(title) {
    if (!title) return;
    
    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        
        // 聚焦搜索框，便于用户立即使用键盘操作
        input.focus();
        
        // 显示一个提示，告知用户点击搜索按钮进行搜索
        showToast('已填充搜索内容，点击搜索按钮开始搜索', 'info');
    }
}

// 填充搜索框并执行搜索
function fillAndSearch(title) {
    if (!title) return;
    
    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        search(); // 使用已有的search函数执行搜索
        
        // 同时更新浏览器URL，使其反映当前的搜索状态
        try {
            // 使用URI编码确保特殊字符能够正确显示
            const encodedQuery = encodeURIComponent(safeTitle);
            // 使用HTML5 History API更新URL，不刷新页面
            window.history.pushState(
                { search: safeTitle }, 
                `搜索: ${safeTitle} - LibreTV`, 
                `/s=${encodedQuery}`
            );
            // 更新页面标题
            document.title = `搜索: ${safeTitle} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
        }
    }
}

// 填充搜索框，确保豆瓣资源API被选中，然后执行搜索
async function fillAndSearchWithDouban(title) {
    if (!title) return;
    
    // 安全处理标题，防止XSS
    const safeTitle = title
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    // 确保豆瓣资源API被选中
    if (typeof selectedAPIs !== 'undefined' && !selectedAPIs.includes('dbzy')) {
        // 在设置中勾选豆瓣资源API复选框
        const doubanCheckbox = document.querySelector('input[id="api_dbzy"]');
        if (doubanCheckbox) {
            doubanCheckbox.checked = true;
            
            // 触发updateSelectedAPIs函数以更新状态
            if (typeof updateSelectedAPIs === 'function') {
                updateSelectedAPIs();
            } else {
                // 如果函数不可用，则手动添加到selectedAPIs
                selectedAPIs.push('dbzy');
                localStorage.setItem('selectedAPIs', JSON.stringify(selectedAPIs));
                
                // 更新选中API计数（如果有这个元素）
                const countEl = document.getElementById('selectedAPICount');
                if (countEl) {
                    countEl.textContent = selectedAPIs.length;
                }
            }
            
            showToast('已自动选择豆瓣资源API', 'info');
        }
    }
    
    // 填充搜索框并执行搜索
    const input = document.getElementById('searchInput');
    if (input) {
        input.value = safeTitle;
        await search(); // 使用已有的search函数执行搜索
        
        // 更新浏览器URL，使其反映当前的搜索状态
        try {
            // 使用URI编码确保特殊字符能够正确显示
            const encodedQuery = encodeURIComponent(safeTitle);
            // 使用HTML5 History API更新URL，不刷新页面
            window.history.pushState(
                { search: safeTitle }, 
                `搜索: ${safeTitle} - LibreTV`, 
                `/s=${encodedQuery}`
            );
            // 更新页面标题
            document.title = `搜索: ${safeTitle} - LibreTV`;
        } catch (e) {
            console.error('更新浏览器历史失败:', e);
        }

        if (window.innerWidth <= 768) {
          window.scrollTo({
              top: 0,
              behavior: 'smooth'
          });
        }
    }
}

// 渲染电影/电视剧切换器
function renderDoubanMovieTvSwitch() {
    // 获取切换按钮元素
    const movieToggle = document.getElementById('douban-movie-toggle');
    const tvToggle = document.getElementById('douban-tv-toggle');

    if (!movieToggle ||!tvToggle) return;

    movieToggle.addEventListener('click', function() {
        if (doubanMovieTvCurrentSwitch !== 'movie') {
            // 更新按钮样式
            movieToggle.classList.add('bg-pink-600', 'text-white');
            movieToggle.classList.remove('text-gray-300');
            
            tvToggle.classList.remove('bg-pink-600', 'text-white');
            tvToggle.classList.add('text-gray-300');
            
            doubanMovieTvCurrentSwitch = 'movie';
            doubanCurrentTag = '热门';

            // 重新加载豆瓣内容
            renderDoubanTags(movieTags);

            // 设置无限滚动
            setupDoubanInfiniteScroll();
            
            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                resetDoubanInfiniteScrollState();
                renderRecommend(doubanCurrentTag);
            }
        }
    });
    
    // 电视剧按钮点击事件
    tvToggle.addEventListener('click', function() {
        if (doubanMovieTvCurrentSwitch !== 'tv') {
            // 更新按钮样式
            tvToggle.classList.add('bg-pink-600', 'text-white');
            tvToggle.classList.remove('text-gray-300');
            
            movieToggle.classList.remove('bg-pink-600', 'text-white');
            movieToggle.classList.add('text-gray-300');
            
            doubanMovieTvCurrentSwitch = 'tv';
            doubanCurrentTag = '热门';

            // 重新加载豆瓣内容
            renderDoubanTags(tvTags);

            // 设置无限滚动
            setupDoubanInfiniteScroll();
            
            // 初始加载热门内容
            if (localStorage.getItem('doubanEnabled') === 'true') {
                resetDoubanInfiniteScrollState();
                renderRecommend(doubanCurrentTag);
            }
        }
    });
}

// 渲染豆瓣标签选择器
function renderDoubanTags(tags) {
    const tagContainer = document.getElementById('douban-tags');
    if (!tagContainer) return;
    
    // 确定当前应该使用的标签列表
    const currentTags = doubanMovieTvCurrentSwitch === 'movie' ? movieTags : tvTags;
    
    // 清空标签容器
    tagContainer.innerHTML = '';

    // 先添加标签管理按钮
    const manageBtn = document.createElement('button');
    manageBtn.className = 'py-1.5 px-3.5 rounded text-sm font-medium transition-all duration-300 bg-[#1a1a1a] text-gray-300 hover:bg-pink-700 hover:text-white border border-[#333] hover:border-white';
    manageBtn.innerHTML = '<span class="flex items-center"><svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>管理标签</span>';
    manageBtn.onclick = function() {
        showTagManageModal();
    };
    tagContainer.appendChild(manageBtn);

    // 添加所有标签
    currentTags.forEach(tag => {
        const btn = document.createElement('button');
        
        // 设置样式
        let btnClass = 'py-1.5 px-3.5 rounded text-sm font-medium transition-all duration-300 border ';
        
        // 当前选中的标签使用高亮样式
        if (tag === doubanCurrentTag) {
            btnClass += 'bg-pink-600 text-white shadow-md border-white';
        } else {
            btnClass += 'bg-[#1a1a1a] text-gray-300 hover:bg-pink-700 hover:text-white border-[#333] hover:border-white';
        }
        
        btn.className = btnClass;
        btn.textContent = tag;
        
        btn.onclick = function() {
            if (doubanCurrentTag !== tag) {
                doubanCurrentTag = tag;
                resetDoubanInfiniteScrollState();
                renderRecommend(doubanCurrentTag);
                renderDoubanTags();
            }
        };
        
        tagContainer.appendChild(btn);
    });
}

function fetchDoubanTags() {
    const movieTagsTarget = `https://movie.douban.com/j/search_tags?type=movie`
    fetchDoubanData(movieTagsTarget)
        .then(data => {
            movieTags = data.tags;
            if (doubanMovieTvCurrentSwitch === 'movie') {
                renderDoubanTags(movieTags);
            }
        })
        .catch(error => {
            console.error("获取豆瓣热门电影标签失败：", error);
        });
    const tvTagsTarget = `https://movie.douban.com/j/search_tags?type=tv`
    fetchDoubanData(tvTagsTarget)
       .then(data => {
            tvTags = data.tags;
            if (doubanMovieTvCurrentSwitch === 'tv') {
                renderDoubanTags(tvTags);
            }
        })
       .catch(error => {
            console.error("获取豆瓣热门电视剧标签失败：", error);
        });
}

// 渲染热门推荐内容
async function renderRecommend(tag) {
    const container = document.getElementById("douban-results");
    if (!container) return;

    cancelDoubanFetch();
    doubanScrollState.isFetching = true;
    const reqId = ++doubanScrollState.requestId;
    showDoubanInitialLoading();

    try {
        doubanScrollState.abortController = new AbortController();
        const target = `https://movie.douban.com/j/search_subjects?type=${doubanMovieTvCurrentSwitch}&tag=${tag}&sort=recommend&page_limit=${doubanScrollState.fetchBatchSize}&page_start=0`;
        const data = await fetchDoubanData(target, doubanScrollState.abortController.signal);

        if (doubanScrollState.requestId !== reqId) return;

        if (data.subjects && data.subjects.length > 0) {
            doubanScrollState.allData = [...data.subjects];
            doubanScrollState.displayCount = data.subjects.length;

            renderInitialDoubanCards(data, container);

            prefetchDoubanBatches(tag);
        } else {
            container.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <div class="text-pink-500">暂无数据，请尝试其他分类</div>
                </div>
            `;
            doubanScrollState.hasMoreData = false;
        }
    } catch (error) {
        if (error.name === 'AbortError') return;
        console.error('获取豆瓣数据失败：', error);
        if (doubanScrollState.requestId !== reqId) return;
        container.innerHTML = `
            <div class="col-span-full text-center py-8">
                <div class="text-red-400">❌ 获取豆瓣数据失败，请稍后重试</div>
                <div class="text-gray-500 text-sm mt-2">提示：使用VPN可能有助于解决此问题</div>
            </div>
        `;
    } finally {
        if (doubanScrollState.requestId === reqId) {
            doubanScrollState.isFetching = false;
            doubanScrollState.abortController = null;
            removeDoubanShimmerCards();
        }
    }
}

// Render initial cards (clears container first)
function renderInitialDoubanCards(data, container) {
    container.innerHTML = '';
    appendDoubanCards(data.subjects);
}

async function fetchDoubanData(url, externalSignal) {
    const { proxyType } = getDoubanDataProxyConfig();

    function withTimeout(ms) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), ms);
        if (externalSignal) {
            if (externalSignal.aborted) controller.abort();
            else externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        return { signal: controller.signal, clear: () => clearTimeout(timeoutId) };
    }

    // CDN 直连模式：将 movie.douban.com/m.douban.com 替换为 CDN 域名
    if (proxyType === 'cmliussss-cdn-tencent' || proxyType === 'cmliussss-cdn-ali') {
        const cdnDomain = proxyType === 'cmliussss-cdn-tencent'
            ? 'm.douban.cmliussss.net'
            : 'm.douban.cmliussss.com';
        const cdnUrl = url
            .replace('movie.douban.com', cdnDomain)
            .replace('m.douban.com', cdnDomain);
        const t = withTimeout(10000);
        try {
            const response = await fetch(cdnUrl, { signal: t.signal });
            t.clear();
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            t.clear();
            if (err.name === 'AbortError' && externalSignal?.aborted) throw err;
            console.warn(`CDN 代理请求失败 (${cdnDomain}):`, err.message);
        }
    }

    // CORS 代理模式 (ciao-cors)
    if (proxyType === 'cors-proxy-zwei') {
        const t = withTimeout(10000);
        try {
            const response = await fetch(`https://ciao-cors.is-an.org/${encodeURIComponent(url)}`, { signal: t.signal });
            t.clear();
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (err) {
            t.clear();
            if (err.name === 'AbortError' && externalSignal?.aborted) throw err;
            console.warn('ciao-cors 代理请求失败:', err.message);
        }
    }

    // 自动模式（默认）：依次尝试第三方代理，最终回退到本站代理
    const thirdPartyProxies = [
        // cors.lol: 直接透传响应
        {
            build: (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
            parse: (data) => data,
        },
        // allorigins: 返回 { contents: "..." }
        {
            build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
            parse: (data) => JSON.parse(data.contents),
        },
    ];

    for (const proxy of thirdPartyProxies) {
        const t = withTimeout(10000);
        try {
            const response = await fetch(proxy.build(url), { signal: t.signal });
            t.clear();
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return proxy.parse(data);
        } catch (err) {
            t.clear();
            if (err.name === 'AbortError' && externalSignal?.aborted) throw err;
            console.warn(`第三方代理请求失败 (${proxy.build(url).split('?')[0]}):`, err.message);
        }
    }

    // 最终回退：通过本站代理（带鉴权）
    console.warn('所有第三方代理失败，尝试本站代理...');
    const t = withTimeout(10000);
    try {
        const proxiedUrl = await window.ProxyAuth?.addAuthToProxyUrl
            ? await window.ProxyAuth.addAuthToProxyUrl(PROXY_URL + encodeURIComponent(url))
            : PROXY_URL + encodeURIComponent(url);
        const response = await fetch(proxiedUrl, { signal: t.signal });
        t.clear();
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        t.clear();
        console.error('本站代理也失败：', err.message);
        throw err;
    }
}

// 重置到首页
function resetToFirstPage() {
    resetDoubanInfiniteScrollState();
    renderRecommend(doubanCurrentTag);
}

// 加载豆瓣首页内容
document.addEventListener('DOMContentLoaded', initDouban);

// 显示标签管理模态框
function showTagManageModal() {
    // 确保模态框在页面上只有一个实例
    let modal = document.getElementById('tagManageModal');
    if (modal) {
        document.body.removeChild(modal);
    }
    
    // 创建模态框元素
    modal = document.createElement('div');
    modal.id = 'tagManageModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40';
    
    // 当前使用的标签类型和默认标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    const defaultTags = isMovie ? defaultMovieTags : defaultTvTags;
    
    // 模态框内容
    modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeTagModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold text-white mb-4">标签管理 (${isMovie ? '电影' : '电视剧'})</h3>
            
            <div class="mb-4">
                <div class="flex justify-between items-center mb-2">
                    <h4 class="text-lg font-medium text-gray-300">标签列表</h4>
                    <button id="resetTagsBtn" class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded">
                        恢复默认标签
                    </button>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4" id="tagsGrid">
                    ${currentTags.length ? currentTags.map(tag => {
                        // "热门"标签不能删除
                        const canDelete = tag !== '热门';
                        return `
                            <div class="bg-[#1a1a1a] text-gray-300 py-1.5 px-3 rounded text-sm font-medium flex justify-between items-center group">
                                <span>${tag}</span>
                                ${canDelete ? 
                                    `<button class="delete-tag-btn text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" 
                                        data-tag="${tag}">✕</button>` : 
                                    `<span class="text-gray-500 text-xs italic opacity-0 group-hover:opacity-100">必需</span>`
                                }
                            </div>
                        `;
                    }).join('') : 
                    `<div class="col-span-full text-center py-4 text-gray-500">无标签，请添加或恢复默认</div>`}
                </div>
            </div>
            
            <div class="border-t border-gray-700 pt-4">
                <h4 class="text-lg font-medium text-gray-300 mb-3">添加新标签</h4>
                <form id="addTagForm" class="flex items-center">
                    <input type="text" id="newTagInput" placeholder="输入标签名称..." 
                           class="flex-1 bg-[#222] text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-pink-500">
                    <button type="submit" class="ml-2 bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded">添加</button>
                </form>
                <p class="text-xs text-gray-500 mt-2">提示：标签名称不能为空，不能重复，不能包含特殊字符</p>
            </div>
        </div>
    `;
    
    // 添加模态框到页面
    document.body.appendChild(modal);
    
    // 焦点放在输入框上
    setTimeout(() => {
        document.getElementById('newTagInput').focus();
    }, 100);
    
    // 添加事件监听器 - 关闭按钮
    document.getElementById('closeTagModal').addEventListener('click', function() {
        document.body.removeChild(modal);
    });
    
    // 添加事件监听器 - 点击模态框外部关闭
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    });
    
    // 添加事件监听器 - 恢复默认标签按钮
    document.getElementById('resetTagsBtn').addEventListener('click', function() {
        resetTagsToDefault();
        showTagManageModal(); // 重新加载模态框
    });
    
    // 添加事件监听器 - 删除标签按钮
    const deleteButtons = document.querySelectorAll('.delete-tag-btn');
    deleteButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tagToDelete = this.getAttribute('data-tag');
            deleteTag(tagToDelete);
            showTagManageModal(); // 重新加载模态框
        });
    });
    
    // 添加事件监听器 - 表单提交
    document.getElementById('addTagForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const input = document.getElementById('newTagInput');
        const newTag = input.value.trim();
        
        if (newTag) {
            addTag(newTag);
            input.value = '';
            showTagManageModal(); // 重新加载模态框
        }
    });
}

// 添加标签
function addTag(tag) {
    // 安全处理标签名，防止XSS
    const safeTag = tag
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    
    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    
    // 检查是否已存在（忽略大小写）
    const exists = currentTags.some(
        existingTag => existingTag.toLowerCase() === safeTag.toLowerCase()
    );
    
    if (exists) {
        showToast('标签已存在', 'warning');
        return;
    }
    
    // 添加到对应的标签数组
    if (isMovie) {
        movieTags.push(safeTag);
    } else {
        tvTags.push(safeTag);
    }
    
    // 保存到本地存储
    saveUserTags();
    
    // 重新渲染标签
    renderDoubanTags();
    
    showToast('标签添加成功', 'success');
}

// 删除标签
function deleteTag(tag) {
    // 热门标签不能删除
    if (tag === '热门') {
        showToast('热门标签不能删除', 'warning');
        return;
    }
    
    // 确定当前使用的是电影还是电视剧标签
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    const currentTags = isMovie ? movieTags : tvTags;
    
    // 寻找标签索引
    const index = currentTags.indexOf(tag);
    
    // 如果找到标签，则删除
    if (index !== -1) {
        currentTags.splice(index, 1);
        
        // 保存到本地存储
        saveUserTags();
        
        // 如果当前选中的是被删除的标签，则重置为"热门"
        if (doubanCurrentTag === tag) {
            doubanCurrentTag = '热门';
            resetDoubanInfiniteScrollState();
            renderRecommend(doubanCurrentTag);
        }
        
        // 重新渲染标签
        renderDoubanTags();
        
        showToast('标签删除成功', 'success');
    }
}

// 重置为默认标签
function resetTagsToDefault() {
    // 确定当前使用的是电影还是电视剧
    const isMovie = doubanMovieTvCurrentSwitch === 'movie';
    
    // 重置为默认标签
    if (isMovie) {
        movieTags = [...defaultMovieTags];
    } else {
        tvTags = [...defaultTvTags];
    }
    
    // 设置当前标签为热门
    doubanCurrentTag = '热门';
    
    // 保存到本地存储
    saveUserTags();
    
    // 重新渲染标签和内容
    renderDoubanTags();
    resetDoubanInfiniteScrollState();
    renderRecommend(doubanCurrentTag);
    
    showToast('已恢复默认标签', 'success');
}
