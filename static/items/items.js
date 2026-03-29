(() => {
    const list = document.getElementById('items-list');
    const queryInput = document.getElementById('item-search-filter');
    const clearFilter = document.getElementById('clear-filter');
    const prevPageBtn = document.getElementById('items-prev-page');
    const nextPageBtn = document.getElementById('items-next-page');
    const pageInfo = document.getElementById('items-page-info');

    let cachedItems = [];
    let currentPage = 1;
    const PAGE_SIZE = 12;

    function matchesFilter(item) {
        const query = (queryInput?.value || '').toLowerCase();
        if (!query) return true;

        const fields = [item.name, item.sku, item.item_id];
        return fields.some((value) => String(value || '').toLowerCase().includes(query));
    }

    function updatePaginationUI(totalPages) {
        const hasPages = totalPages > 0;
        const safeTotal = hasPages ? totalPages : 1;
        const safeCurrent = hasPages ? currentPage : 1;

        if (pageInfo) pageInfo.textContent = `Page ${safeCurrent} of ${safeTotal}`;
        if (prevPageBtn) prevPageBtn.disabled = !hasPages || safeCurrent <= 1;
        if (nextPageBtn) nextPageBtn.disabled = !hasPages || safeCurrent >= safeTotal;
    }

    function render(items) {
        if (!list) return;

        if (!items || items.length === 0) {
            list.innerHTML = '<p class="loading">No items found.</p>';
            updatePaginationUI(0);
            return;
        }

        const filtered = items.filter(matchesFilter);
        if (filtered.length === 0) {
            list.innerHTML = '<p class="loading">No matching items for current filter.</p>';
            updatePaginationUI(0);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const start = (currentPage - 1) * PAGE_SIZE;
        const paginated = filtered.slice(start, start + PAGE_SIZE);

        list.innerHTML = '';
        paginated.forEach((item) => {
            const row = document.createElement('div');
            row.className = 'event-row event-in';
            row.innerHTML = `
                <div class="event-details">
                    <div class="event-title">${item.name || 'Unnamed item'} (${item.sku || 'SKU N/A'})</div>
                    <div class="event-meta">Item ID: ${item.item_id ?? '-'} </div>
                </div>
                <div class="pill">ITEM</div>
            `;
            list.appendChild(row);
        });

        updatePaginationUI(totalPages);
    }

    async function loadItems() {
        if (list) list.innerHTML = '<p class="loading">Loading items...</p>';
        const res = await fetch('/api/items');
        if (!res.ok) throw new Error('Fetch failed');

        cachedItems = await res.json();
        render(cachedItems);
    }

    function bindEvents() {
        const rerenderFromFirstPage = () => {
            currentPage = 1;
            render(cachedItems);
        };

        queryInput?.addEventListener('input', rerenderFromFirstPage);

        clearFilter?.addEventListener('click', () => {
            if (queryInput) queryInput.value = '';
            rerenderFromFirstPage();
        });

        prevPageBtn?.addEventListener('click', () => {
            currentPage -= 1;
            render(cachedItems);
        });

        nextPageBtn?.addEventListener('click', () => {
            currentPage += 1;
            render(cachedItems);
        });

        window.addEventListener('eventide:event-created', () => {
            loadItems().catch((err) => {
                if (list) list.innerHTML = `<p class="loading">Error loading items: ${err.message}</p>`;
                console.error(err);
            });
        });
    }

    async function init() {
        bindEvents();
        try {
            await loadItems();
        } catch (err) {
            if (list) list.innerHTML = `<p class="loading">Error loading items: ${err.message}</p>`;
            console.error(err);
        }
    }

    init();
})();
