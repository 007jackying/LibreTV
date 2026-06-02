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

function renderRecommend(tag) {
    var container = document.getElementById('douban-results');
    if (!container) return Promise.resolve();

    doubanScrollState.isFetching = true;
    showDoubanLoadingMore();

    var target = 'https://movie.douban.com/j/search_subjects?type='
        + doubanMovieTvCurrentSwitch + '&tag=' + encodeURIComponent(tag)
        + '&sort=recommend&page_limit=' + doubanScrollState.fetchBatchSize
        + '&page_start=0';

    return fetch(target)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.subjects && data.subjects.length > 0) {
                doubanScrollState.allData = data.subjects.slice();
                doubanScrollState.displayCount = data.subjects.length;
                container.innerHTML = '';
                appendDoubanCards(data.subjects);
            } else {
                container.innerHTML = '<div class="empty-msg">暂无数据</div>';
                doubanScrollState.hasMoreData = false;
            }
        })
        .catch(function() {
            container.innerHTML = '<div class="error-msg">获取豆瓣数据失败</div>';
        })
        .finally(function() {
            doubanScrollState.isFetching = false;
            hideDoubanLoadingMore();
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

describe('douban scroll flow integration', function() {
    beforeEach(function() {
        document.body.innerHTML = '<div id="doubanArea"><div id="douban-results"></div><div id="douban-scroll-sentinel"><div id="douban-loading-more" class="hidden"></div><div id="douban-no-more" class="hidden"></div></div></div>';
        resetDoubanInfiniteScrollState();
        doubanCurrentTag = '热门';
        doubanMovieTvCurrentSwitch = 'movie';
        fetch.mockClear();
    });

    test('initial load renders 50 cards then scroll loads next 50 from cache', function() {
        fetch.mockResolvedValueOnce({
            ok: true,
            json: function() { return Promise.resolve({ subjects: mockSubjects(50) }); }
        });

        return renderRecommend('热门').then(function() {
            expect(doubanScrollState.displayCount).toBe(50);
            expect(document.getElementById('douban-results').children.length).toBe(50);

            doubanScrollState.allData = mockSubjects(100);
            doubanScrollState.displayCount = 50;

            return handleDoubanScrollLoad();
        }).then(function() {
            expect(doubanScrollState.displayCount).toBe(100);
            expect(document.getElementById('douban-results').children.length).toBe(100);
            expect(fetch).toHaveBeenCalledTimes(1);
        });
    });

    test('third scroll loads next 50 from cache reaching max', function() {
        doubanScrollState.allData = mockSubjects(150);
        doubanScrollState.displayCount = 100;

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.displayCount).toBe(150);
        });
    });

    test('fourth scroll shows no-more indicator', function() {
        doubanScrollState.allData = mockSubjects(150);
        doubanScrollState.displayCount = 150;
        doubanScrollState.hasMoreData = true;

        return handleDoubanScrollLoad().then(function() {
            expect(doubanScrollState.hasMoreData).toBe(false);
            var noMoreEl = document.getElementById('douban-no-more');
            expect(noMoreEl.classList.contains('hidden')).toBe(false);
        });
    });

    test('observer does not trigger when isFetching is true', function() {
        doubanScrollState.isFetching = true;
        doubanScrollState.allData = mockSubjects(100);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            expect(fetch).not.toHaveBeenCalled();
            expect(doubanScrollState.displayCount).toBe(50);
        });
    });

    test('observer does not trigger when hasMoreData is false', function() {
        doubanScrollState.hasMoreData = false;
        doubanScrollState.allData = mockSubjects(100);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            expect(fetch).not.toHaveBeenCalled();
        });
    });

    test('loading indicator appears during fetch and disappears after', function() {
        doubanScrollState.allData = mockSubjects(50);
        doubanScrollState.displayCount = 50;

        var resolvePromise;
        fetch.mockImplementationOnce(function() {
            return new Promise(function(resolve) { resolvePromise = resolve; });
        });

        var loadingEl = document.getElementById('douban-loading-more');
        var promise = handleDoubanScrollLoad();

        expect(loadingEl.classList.contains('hidden')).toBe(false);
        expect(doubanScrollState.isFetching).toBe(true);

        resolvePromise({ ok: true, json: function() { return Promise.resolve({ subjects: mockSubjects(50, 50) }); } });

        return promise.then(function() {
            expect(loadingEl.classList.contains('hidden')).toBe(true);
            expect(doubanScrollState.isFetching).toBe(false);
        });
    });

    test('scroll fetches from API when cache exhausted', function() {
        doubanScrollState.allData = mockSubjects(50);
        doubanScrollState.displayCount = 50;

        fetch.mockResolvedValueOnce({
            ok: true,
            json: function() { return Promise.resolve({ subjects: mockSubjects(50, 50) }); }
        });

        return handleDoubanScrollLoad().then(function() {
            expect(fetch).toHaveBeenCalledTimes(1);
            expect(doubanScrollState.displayCount).toBeGreaterThan(50);
        });
    });

    test('scroll appends cards to existing grid without clearing', function() {
        var container = document.getElementById('douban-results');
        for (var i = 0; i < 50; i++) {
            var div = document.createElement('div');
            div.className = 'movie-card';
            container.appendChild(div);
        }

        doubanScrollState.allData = mockSubjects(100);
        doubanScrollState.displayCount = 50;

        return handleDoubanScrollLoad().then(function() {
            expect(container.children.length).toBe(100);
        });
    });
});
