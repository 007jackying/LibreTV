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

function resetDoubanInfiniteScrollState() {
    doubanScrollState.allData = [];
    doubanScrollState.displayCount = 0;
    doubanScrollState.isFetching = false;
    doubanScrollState.hasMoreData = true;
    doubanScrollState.prefetchComplete = false;
}

function showDoubanLoadingMore() {
    var el = document.getElementById('douban-loading-more');
    if (el) el.classList.remove('hidden');
}

function hideDoubanLoadingMore() {
    var el = document.getElementById('douban-loading-more');
    if (el) el.classList.add('hidden');
}

function showDoubanNoMore() {
    var el = document.getElementById('douban-no-more');
    if (el) el.classList.remove('hidden');
}

function hideDoubanNoMore() {
    var el = document.getElementById('douban-no-more');
    if (el) el.classList.add('hidden');
}

function scrollToDoubanTop() {
    var doubanArea = document.getElementById('doubanArea');
    if (doubanArea) {
        doubanArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

describe('doubanScrollState', () => {
    beforeEach(function() {
        document.body.innerHTML = '<div id="doubanArea"><div id="douban-loading-more" class="hidden"></div><div id="douban-no-more" class="hidden"></div></div>';
        resetDoubanInfiniteScrollState();
    });

    test('initial state has correct default values', function() {
        expect(doubanScrollState).toBeDefined();
        expect(doubanScrollState.allData).toEqual([]);
        expect(doubanScrollState.displayCount).toBe(0);
        expect(doubanScrollState.isFetching).toBe(false);
        expect(doubanScrollState.hasMoreData).toBe(true);
        expect(doubanScrollState.prefetchComplete).toBe(false);
        expect(doubanScrollState.fetchBatchSize).toBe(50);
        expect(doubanScrollState.displayBatchSize).toBe(50);
        expect(doubanScrollState.maxItems).toBe(150);
    });

    test('resetDoubanInfiniteScrollState resets all state', function() {
        doubanScrollState.allData = [{ title: 'test' }];
        doubanScrollState.displayCount = 50;
        doubanScrollState.isFetching = true;
        doubanScrollState.hasMoreData = false;
        doubanScrollState.prefetchComplete = true;

        resetDoubanInfiniteScrollState();

        expect(doubanScrollState.allData).toEqual([]);
        expect(doubanScrollState.displayCount).toBe(0);
        expect(doubanScrollState.isFetching).toBe(false);
        expect(doubanScrollState.hasMoreData).toBe(true);
        expect(doubanScrollState.prefetchComplete).toBe(false);
    });

    test('showDoubanLoadingMore reveals the loading indicator', function() {
        var el = document.getElementById('douban-loading-more');
        expect(el.classList.contains('hidden')).toBe(true);

        showDoubanLoadingMore();

        expect(el.classList.contains('hidden')).toBe(false);
    });

    test('hideDoubanLoadingMore hides the loading indicator', function() {
        var el = document.getElementById('douban-loading-more');
        el.classList.remove('hidden');

        hideDoubanLoadingMore();

        expect(el.classList.contains('hidden')).toBe(true);
    });

    test('showDoubanNoMore reveals the no-more indicator', function() {
        var el = document.getElementById('douban-no-more');
        expect(el.classList.contains('hidden')).toBe(true);

        showDoubanNoMore();

        expect(el.classList.contains('hidden')).toBe(false);
    });

    test('hideDoubanNoMore hides the no-more indicator', function() {
        var el = document.getElementById('douban-no-more');
        el.classList.remove('hidden');

        hideDoubanNoMore();

        expect(el.classList.contains('hidden')).toBe(true);
    });

    test('scrollToDoubanTop scrolls to doubanArea', function() {
        var mockScrollIntoView = jest.fn();
        var doubanArea = document.getElementById('doubanArea');
        doubanArea.scrollIntoView = mockScrollIntoView;

        scrollToDoubanTop();

        expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    });
});
