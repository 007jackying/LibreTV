require('../setup.js');

var doubanScrollState = {
    allData: [],
    displayCount: 0,
    isFetching: false,
    hasMoreData: true,
    prefetchComplete: false,
    fetchBatchSize: 50,
    displayBatchSize: 50,
    maxItems: 150
};

var doubanCurrentTag = '热门';
var doubanMovieTvCurrentSwitch = 'movie';

function resetDoubanInfiniteScrollState() {
    doubanScrollState.allData = [];
    doubanScrollState.displayCount = 0;
    doubanScrollState.isFetching = false;
    doubanScrollState.hasMoreData = true;
    doubanScrollState.prefetchComplete = false;
}

function mockSubjects(count, offset) {
    offset = offset || 0;
    var subjects = [];
    for (var i = 0; i < count; i++) {
        subjects.push({
            id: offset + i + 1,
            title: 'Movie ' + (offset + i + 1),
            rate: '8.0',
            cover: 'https://img.doubanio.com/cover' + (offset + i + 1) + '.jpg',
            url: 'https://movie.douban.com/subject/' + (offset + i + 1)
        });
    }
    return subjects;
}

function processDoubanImageUrl(url) {
    return url;
}

function appendDoubanCards(subjects) {
    var container = document.getElementById('douban-results');
    if (!container || !subjects || subjects.length === 0) return;

    subjects.forEach(function(item) {
        var card = document.createElement('div');
        card.className = 'movie-card';
        card.textContent = item.title;
        container.appendChild(card);
    });
}

async function renderRecommend(tag) {
    var container = document.getElementById('douban-results');
    if (!container) return;

    doubanScrollState.isFetching = true;

    try {
        var target = 'https://movie.douban.com/j/search_subjects?type=' + doubanMovieTvCurrentSwitch + '&tag=' + tag + '&sort=recommend&page_limit=' + doubanScrollState.fetchBatchSize + '&page_start=0';
        var response = await fetch(target);
        var data = await response.json();

        if (data.subjects && data.subjects.length > 0) {
            doubanScrollState.allData = data.subjects.slice();
            doubanScrollState.displayCount = data.subjects.length;
            container.innerHTML = '';
            appendDoubanCards(data.subjects);
        } else {
            container.innerHTML = '<div class="col-span-full text-center py-8"><div class="text-pink-500">暂无数据，请尝试其他分类</div></div>';
            doubanScrollState.hasMoreData = false;
        }
    } catch (error) {
        console.error('获取豆瓣数据失败：', error);
        container.innerHTML = '<div class="col-span-full text-center py-8"><div class="text-red-400">获取豆瓣数据失败，请稍后重试</div></div>';
    } finally {
        doubanScrollState.isFetching = false;
    }
}

async function prefetchDoubanBatches(tag) {
    if (doubanScrollState.prefetchComplete) return;
    doubanScrollState.prefetchComplete = true;

    var batchSize = doubanScrollState.fetchBatchSize;
    for (var i = 0; i < 2; i++) {
        var start = doubanScrollState.allData.length;
        try {
            var target = 'https://movie.douban.com/j/search_subjects?type=' + doubanMovieTvCurrentSwitch + '&tag=' + tag + '&sort=recommend&page_limit=' + batchSize + '&page_start=' + start;
            var response = await fetch(target);
            var data = await response.json();
            if (data.subjects && data.subjects.length > 0) {
                doubanScrollState.allData = doubanScrollState.allData.concat(data.subjects);
            } else {
                doubanScrollState.hasMoreData = false;
                break;
            }
        } catch (error) {
            doubanScrollState.prefetchComplete = false;
            break;
        }
    }
    if (doubanScrollState.allData.length >= doubanScrollState.maxItems) {
        doubanScrollState.hasMoreData = false;
    }
}

describe('douban initial load integration', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="doubanArea"><div id="douban-results"></div><div id="douban-scroll-sentinel"><div id="douban-loading-more" class="hidden"></div><div id="douban-no-more" class="hidden"></div></div></div>';
        resetDoubanInfiniteScrollState();
        fetch.mockClear();
        doubanCurrentTag = '热门';
        doubanMovieTvCurrentSwitch = 'movie';
    });

    test('renderRecommend fetches initial 50 items', async function() {
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });

        await renderRecommend('热门');

        expect(fetch).toHaveBeenCalled();
        expect(doubanScrollState.allData.length).toBe(50);
        expect(doubanScrollState.displayCount).toBe(50);
    });

    test('renderRecommend clears container before rendering', async function() {
        var container = document.getElementById('douban-results');
        container.innerHTML = '<div class="old-card">old</div>';

        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });

        await renderRecommend('热门');

        expect(container.innerHTML).not.toContain('old-card');
        expect(container.children.length).toBe(50);
    });

    test('renderRecommend shows error message on fetch failure', async function() {
        fetch.mockRejectedValueOnce(new Error('Network error'));

        await renderRecommend('热门');

        var container = document.getElementById('douban-results');
        expect(container.innerHTML).toContain('获取豆瓣数据失败');
    });

    test('renderRecommend shows empty message when no data', async function() {
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: [] }; } });

        await renderRecommend('热门');

        var container = document.getElementById('douban-results');
        expect(container.innerHTML).toContain('暂无数据');
    });

    test('renderRecommend sets isFetching to false after completion', async function() {
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });

        doubanScrollState.isFetching = true;

        await renderRecommend('热门');

        expect(doubanScrollState.isFetching).toBe(false);
    });

    test('renderRecommend constructs correct API URL', async function() {
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });

        await renderRecommend('热门');

        var url = fetch.mock.calls[0][0];
        expect(url).toContain('type=movie');
        expect(url).toContain('tag=热门');
        expect(url).toContain('page_limit=50');
        expect(url).toContain('page_start=0');
    });
});