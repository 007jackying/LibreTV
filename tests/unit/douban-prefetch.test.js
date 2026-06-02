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

async function prefetchDoubanBatches(tag) {
    if (doubanScrollState.prefetchComplete) return;
    doubanScrollState.prefetchComplete = true;

    var batchSize = doubanScrollState.fetchBatchSize;
    var batchesToFetch = 2;

    for (var i = 0; i < batchesToFetch; i++) {
        var start = doubanScrollState.allData.length;
        try {
            var target = 'https://movie.douban.com/j/search_subjects?type=' + doubanMovieTvCurrentSwitch + '&tag=' + tag + '&sort=recommend&page_limit=' + batchSize + '&page_start=' + start;
            var response = await fetch(target);
            var data = await response.json();

            if (data.subjects && data.subjects.length > 0) {
                var newItems = data.subjects.slice(0, doubanScrollState.maxItems - doubanScrollState.allData.length);
                doubanScrollState.allData = doubanScrollState.allData.concat(newItems);
            } else {
                doubanScrollState.hasMoreData = false;
                break;
            }
        } catch (error) {
            console.error('Prefetch batch failed:', error);
            doubanScrollState.prefetchComplete = false;
            break;
        }
    }

    if (doubanScrollState.allData.length >= doubanScrollState.maxItems) {
        doubanScrollState.hasMoreData = false;
    }
}

describe('prefetchDoubanBatches', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="doubanArea"><div id="douban-results"></div><div id="douban-scroll-sentinel"><div id="douban-loading-more" class="hidden"></div><div id="douban-no-more" class="hidden"></div></div></div>';
        resetDoubanInfiniteScrollState();
        fetch.mockClear();
        doubanCurrentTag = '热门';
        doubanMovieTvCurrentSwitch = 'movie';
    });

    test('prefetches two additional batches', async function() {
        doubanScrollState.prefetchComplete = false;
        doubanScrollState.allData = mockSubjects(50);
        doubanScrollState.displayCount = 50;

        fetch
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 50) }; } })
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 100) }; } });

        await prefetchDoubanBatches('热门');

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(doubanScrollState.allData.length).toBe(150);
    });

    test('skips prefetch if already complete', async function() {
        doubanScrollState.prefetchComplete = true;

        await prefetchDoubanBatches('热门');

        expect(fetch).not.toHaveBeenCalled();
    });

    test('sets prefetchComplete to true after prefetch', async function() {
        doubanScrollState.prefetchComplete = false;
        doubanScrollState.allData = mockSubjects(50);

        fetch
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 50) }; } })
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 100) }; } });

        await prefetchDoubanBatches('热门');

        expect(doubanScrollState.prefetchComplete).toBe(true);
    });

    test('stops prefetching on empty response', async function() {
        doubanScrollState.prefetchComplete = false;
        doubanScrollState.allData = mockSubjects(50);

        fetch.mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: [] }; } });

        await prefetchDoubanBatches('热门');

        expect(doubanScrollState.allData.length).toBe(50);
        expect(doubanScrollState.hasMoreData).toBe(false);
    });

    test('sets prefetchComplete to false on fetch error for retry', async function() {
        doubanScrollState.prefetchComplete = false;
        doubanScrollState.allData = mockSubjects(50);

        fetch.mockRejectedValueOnce(new Error('Network error'));

        await prefetchDoubanBatches('热门');

        expect(doubanScrollState.prefetchComplete).toBe(false);
    });

    test('caps total data at maxItems', async function() {
        doubanScrollState.prefetchComplete = false;
        doubanScrollState.allData = mockSubjects(50);

        fetch
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 50) }; } })
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 100) }; } });

        await prefetchDoubanBatches('热门');

        expect(doubanScrollState.allData.length).toBeLessThanOrEqual(doubanScrollState.maxItems);
    });

    test('constructs correct API URLs for prefetch batches', async function() {
        doubanScrollState.prefetchComplete = false;
        doubanScrollState.allData = mockSubjects(50);

        fetch
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 50) }; } })
            .mockResolvedValueOnce({ ok: true, json: async function() { return { subjects: mockSubjects(50, 100) }; } });

        await prefetchDoubanBatches('热门');

        var call1Url = fetch.mock.calls[0][0];
        var call2Url = fetch.mock.calls[1][0];

        expect(call1Url).toContain('page_start=50');
        expect(call2Url).toContain('page_start=100');
    });
});