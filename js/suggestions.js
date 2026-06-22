// Search suggestions — shows matching entries from search history as you type
(function () {
    let dropdown = null;
    let debounceTimer = null;
    let activeIndex = -1;

    function getHistory() {
        try {
            const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
            if (!raw) return [];
            return JSON.parse(raw).map(item => typeof item === 'string' ? item : item.text).filter(Boolean);
        } catch { return []; }
    }

    function createDropdown() {
        const el = document.createElement('div');
        el.id = 'searchSuggestions';
        el.className = 'absolute left-0 right-0 bg-[#1a1a1a] border border-[#333] rounded-b-lg shadow-xl z-50 hidden';
        el.style.top = '100%';
        return el;
    }

    function renderSuggestions(matches) {
        if (!dropdown) return;
        if (matches.length === 0) { hide(); return; }

        dropdown.innerHTML = matches.map((text, i) => `
            <button data-idx="${i}" class="suggest-item w-full text-left px-5 py-2 text-white hover:bg-[#2a2a2a] transition-colors text-sm flex items-center gap-2">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <span>${text}</span>
            </button>`).join('');

        dropdown.querySelectorAll('.suggest-item').forEach(btn => {
            btn.addEventListener('mousedown', e => {
                e.preventDefault(); // keep focus on input
                const idx = +btn.dataset.idx;
                selectSuggestion(matches[idx]);
            });
        });

        dropdown.classList.remove('hidden');
        activeIndex = -1;
    }

    function selectSuggestion(text) {
        const input = document.getElementById('searchInput');
        if (!input) return;
        input.value = text;
        if (typeof toggleClearButton === 'function') toggleClearButton();
        hide();
        if (typeof search === 'function') search();
    }

    function hide() {
        if (dropdown) dropdown.classList.add('hidden');
        activeIndex = -1;
    }

    function highlightItem(idx, items) {
        items.forEach((el, i) => el.classList.toggle('bg-[#2a2a2a]', i === idx));
    }

    function update(query) {
        if (!query.trim()) { hide(); return; }
        const history = getHistory();
        const q = query.toLowerCase();
        const matches = history.filter(t => t.toLowerCase().includes(q)).slice(0, 8);
        renderSuggestions(matches);
    }

    document.addEventListener('DOMContentLoaded', () => {
        const input = document.getElementById('searchInput');
        if (!input) return;

        // Wrap the search bar in a relative container for dropdown positioning.
        // We target the immediate flex row that contains the input.
        const bar = input.closest('div.flex');
        if (!bar) return; // not on a page with the search bar

        const wrapper = document.createElement('div');
        wrapper.className = 'relative';
        bar.parentNode.insertBefore(wrapper, bar);
        wrapper.appendChild(bar);
        dropdown = createDropdown();
        wrapper.appendChild(dropdown);

        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => update(input.value), 120);
        });

        input.addEventListener('keydown', e => {
            if (dropdown.classList.contains('hidden')) return;
            const items = Array.from(dropdown.querySelectorAll('.suggest-item'));
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, items.length - 1);
                highlightItem(activeIndex, items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, -1);
                highlightItem(activeIndex, items);
            } else if (e.key === 'Enter') {
                if (activeIndex >= 0 && items[activeIndex]) {
                    e.preventDefault();
                    selectSuggestion(items[activeIndex].querySelector('span').textContent);
                } else {
                    hide();
                }
            } else if (e.key === 'Escape') {
                hide();
            }
        });

        input.addEventListener('focus', () => {
            if (input.value.trim()) update(input.value);
        });

        document.addEventListener('click', e => {
            if (dropdown && !dropdown.contains(e.target) && e.target !== input) hide();
        });
    });
})();
