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
    hideDoubanNoMore();
}

function showDoubanNoMore() {
    var el = document.getElementById('douban-no-more');
    if (el) el.classList.remove('hidden');
}

function hideDoubanNoMore() {
    var el = document.getElementById('douban-no-more');
    if (el) el.classList.add('hidden');
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

function mockSubjects(count) {
    var subjects = [];
    for (var i = 0; i < count; i++) {
        subjects.push({
            id: i + 1,
            title: 'Movie ' + (i + 1),
            rate: '8.0',
            cover: 'https://img.doubanio.com/cover' + (i + 1) + '.jpg',
            url: 'https://movie.douban.com/subject/' + (i + 1)
        });
    }
    return subjects;
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
            container.innerHTML = '<div class="col-span-full text-center py-8"><div class="text-pink-500">暂无数据</div></div>';
            doubanScrollState.hasMoreData = false;
        }
    } catch (error) {
        console.error('获取豆瓣数据失败：', error);
        container.innerHTML = '<div class="col-span-full text-center py-8"><div class="text-red-400">获取豆瓣数据失败</div></div>';
    } finally {
        doubanScrollState.isFetching = false;
    }
}

describe('douban tag switch integration', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="doubanArea"><div id="douban-results"></div><div id="douban-scroll-sentinel"><div id="douban-loading-more" class="hidden"></div><div id="douban-no-more" class="hidden"></div></div></div>';
        resetDoubanInfiniteScrollState();
        doubanCurrentTag = '热门';
        doubanMovieTvCurrentSwitch = 'movie';
        fetch.mockClear();
    });

    test('switching tag resets scroll state and fetches new data', async function() {
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });
        await renderRecommend('热门');
        expect(doubanScrollState.displayCount).toBe(50);

        resetDoubanInfiniteScrollState();
        doubanCurrentTag = '最新';

        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(40) }; } });
        await renderRecommend('最新');
        expect(doubanScrollState.displayCount).toBe(40);
    });

    test('switching tag clears old cards from grid', async function() {
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });
        await renderRecommend('热门');
        var container = document.getElementById('douban-results');
        expect(container.children.length).toBe(50);

        resetDoubanInfiniteScrollState();

        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(30) }; } });
        await renderRecommend('最新');
        expect(container.children.length).toBe(30);
    });

    test('switching movie/tv changes API type parameter', async function() {
        doubanMovieTvCurrentSwitch = 'tv';
        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50) }; } });
        await renderRecommend('热门');

        var url = fetch.mock.calls[0][0];
        expect(url).toContain('type=tv');
    });

    test('switching movie/tv resets scroll state', function() {
        doubanScrollState.allData = mockSubjects(100);
        doubanScrollState.displayCount = 100;

        resetDoubanInfiniteScrollState();

        expect(doubanScrollState.allData).toEqual([]);
        expect(doubanScrollState.displayCount).toBe(0);
    });

    test('tag click updates current tag and resets state', function() {
        doubanCurrentTag = '热门';
        doubanScrollState.allData = mockSubjects(50);

        doubanCurrentTag = '最新';
        resetDoubanInfiniteScrollState();

        expect(doubanCurrentTag).toBe('最新');
        expect(doubanScrollState.allData).toEqual([]);
    });

    test('switching hides no-more indicator', function() {
        var noMoreEl = document.getElementById('douban-no-more');
        noMoreEl.classList.remove('hidden');

        resetDoubanInfiniteScrollState();

        expect(noMoreEl.classList.contains('hidden')).toBe(true);
    });
});