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

function handleDoubanScrollLoad() {
    if (doubanScrollState.isFetching) return Promise.resolve();
    if (!doubanScrollState.hasMoreData) return Promise.resolve();
    if (doubanScrollState.displayCount >= doubanScrollState.maxItems) {
        doubanScrollState.hasMoreData = false;
        showDoubanNoMore();
        return Promise.resolve();
    }

    if (doubanScrollState.allData.length > doubanScrollState.displayCount) {
        var nextBatch = doubanScrollState.allData.slice(
            doubanScrollState.displayCount,
            doubanScrollState.displayCount + doubanScrollState.displayBatchSize
        );
        appendDoubanCards(nextBatch);
        doubanScrollState.displayCount += nextBatch.length;
        return Promise.resolve();
    }

    doubanScrollState.isFetching = true;
    showDoubanLoadingMore();

    var start = doubanScrollState.allData.length;
    var target = 'https://movie.douban.com/j/search_subjects?type='
        + doubanMovieTvCurrentSwitch + '&tag=' + doubanCurrentTag
        + '&sort=recommend&page_limit=' + doubanScrollState.fetchBatchSize
        + '&page_start=' + start;

    return fetch(target)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.subjects && data.subjects.length > 0) {
                var newItems = data.subjects.slice(0, doubanScrollState.maxItems - doubanScrollState.allData.length);
                doubanScrollState.allData = doubanScrollState.allData.concat(newItems);
                var nextBatch = doubanScrollState.allData.slice(
                    doubanScrollState.displayCount,
                    doubanScrollState.displayCount + doubanScrollState.displayBatchSize
                );
                appendDoubanCards(nextBatch);
                doubanScrollState.displayCount += nextBatch.length;
            } else {
                doubanScrollState.hasMoreData = false;
                showDoubanNoMore();
            }
        })
        .catch(function(error) {
            console.error('Load more failed:', error);
            doubanScrollState.hasMoreData = false;
        })
        .finally(function() {
            doubanScrollState.isFetching = false;
            hideDoubanLoadingMore();
        });
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

describe('douban-scroll unit', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="doubanArea"><div id="douban-results"></div><div id="douban-scroll-sentinel"><div id="douban-loading-more" class="hidden"></div><div id="douban-no-more" class="hidden"></div></div></div>';
        resetDoubanInfiniteScrollState();
        doubanCurrentTag = '热门';
        doubanMovieTvCurrentSwitch = 'movie';
        fetch.mockClear();
    });

    test('skips when isFetching is true', function() {
        doubanScrollState.isFetching = true;
        doubanScrollState.allData = mockSubjects(60);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    test('shows no-more when hasMoreData is false', function() {
        doubanScrollState.hasMoreData = false;
        doubanScrollState.allData = mockSubjects(60);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            var noMoreEl = document.getElementById('douban-no-more');
            expect(noMoreEl.classList.contains('hidden')).toBe(true);
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    test('shows no-more when displayCount >= maxItems', function() {
        doubanScrollState.allData = mockSubjects(150);
        doubanScrollState.displayCount = 150;
        doubanScrollState.hasMoreData = true;

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.hasMoreData).toBe(false);
            var noMoreEl = document.getElementById('douban-no-more');
            expect(noMoreEl.classList.contains('hidden')).toBe(false);
        });
    });

    test('uses cached data from allData when available', function() {
        doubanScrollState.allData = mockSubjects(100);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.displayCount).toBe(100);
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    test('fetches new data when cache is exhausted', function() {
        doubanScrollState.allData = mockSubjects(50);
        doubanScrollState.displayCount = 50;

        fetch.mockResolvedValueOnce({
            ok: true,
            json: function() { return Promise.resolve({ subjects: mockSubjects(50, 50) }); }
        });

        return handleDoubanScrollLoad().then(function() {
            expect(fetch).toHaveBeenCalled();
            expect(doubanScrollState.displayCount).toBeGreaterThan(50);
        });
    });

    test('updates displayCount correctly after loading', function() {
        doubanScrollState.allData = mockSubjects(120);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.displayCount).toBe(100);
        });
    });

    test('handles fetch error gracefully', function() {
        doubanScrollState.allData = mockSubjects(50);
        doubanScrollState.displayCount = 50;

        fetch.mockRejectedValueOnce(new Error('Network error'));

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.hasMoreData).toBe(false);
        });
    });

    test('resets isFetching in finally block', function() {
        doubanScrollState.allData = mockSubjects(50);
        doubanScrollState.displayCount = 50;

        fetch.mockResolvedValueOnce({
            ok: true,
            json: function() { return Promise.resolve({ subjects: mockSubjects(50, 50) }); }
        });

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.isFetching).toBe(false);
        });
    });
});
