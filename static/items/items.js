(() => {
    const list = document.getElementById('items-list');
    const queryInput = document.getElementById('item-search-filter');
    const categoryFilterInput = document.getElementById('item-category-filter');
    const clearFilter = document.getElementById('clear-filter');
    const prevPageBtn = document.getElementById('items-prev-page');
    const nextPageBtn = document.getElementById('items-next-page');
    const pageInfo = document.getElementById('items-page-info');

    let cachedItems = [];
    let currentPage = 1;
    const PAGE_SIZE = 12;
    let itemModalApi = null;

    function buildSkuThumb(sku) {
        const safeSku = String(sku || '').trim();
        const encodedSku = encodeURIComponent(safeSku);
        return `
            <div class="sku-thumb">
                <img class="sku-thumb-img" src="/public/${encodedSku}.png" alt="${safeSku || 'Item'} image" loading="lazy" />
                <span class="sku-thumb-fallback">IMG</span>
            </div>
        `;
    }

    function applySkuThumbFallback(scope) {
        const images = scope.querySelectorAll('.sku-thumb-img');
        images.forEach((img) => {
            img.addEventListener('load', () => {
                img.closest('.sku-thumb')?.classList.add('has-image');
            });
            img.addEventListener('error', () => {
                img.style.display = 'none';
                img.closest('.sku-thumb')?.classList.remove('has-image');
            });
        });
    }

    function matchesFilter(item) {
        const query = (queryInput?.value || '').toLowerCase();
        const selectedCategory = (categoryFilterInput?.value || '').toLowerCase();
        const itemCategory = String(item.category || '').toLowerCase();

        if (selectedCategory && itemCategory !== selectedCategory) {
            return false;
        }

        if (!query) return true;

        const fields = [item.name, item.sku, item.item_id];
        return fields.some((value) => String(value || '').toLowerCase().includes(query));
    }

    function populateCategoryFilter(items) {
        if (!categoryFilterInput) return;

        const current = categoryFilterInput.value;
        const categories = [...new Set((items || [])
            .map((item) => String(item.category || '').trim())
            .filter(Boolean))].sort((a, b) => a.localeCompare(b));

        categoryFilterInput.innerHTML = '<option value="">All categories</option>';
        categories.forEach((category) => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            categoryFilterInput.appendChild(option);
        });

        if (current && categories.includes(current)) {
            categoryFilterInput.value = current;
        }
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
            const category = item.category || 'Uncategorized';
            const minimumStock = Number.isFinite(item.minimum_stock) ? item.minimum_stock : '-';
            const sku = item.sku || 'SKU N/A';
            const row = document.createElement('div');
            row.className = 'event-row event-in';
            row.innerHTML = `
                <div class="event-main">
                    ${buildSkuThumb(sku)}
                    <div class="event-details">
                        <div class="event-title">${item.name || 'Unnamed item'} (${sku})</div>
                        <div class="event-meta">Item ID: ${item.item_id ?? '-'} | Category: ${category} | Min Stock: ${minimumStock}</div>
                    </div>
                </div>
                <div class="item-pill-group">
                <button class="cta-btn ghost item-edit-btn" type="button" data-item-id="${item.item_id}">Edit</button>
                <span class="pill">${category}</span>
                </div>
            `;
            list.appendChild(row);
            applySkuThumbFallback(row);
        });

        updatePaginationUI(totalPages);
    }

    async function loadItems() {
        if (list) list.innerHTML = '<p class="loading">Loading items...</p>';
        const res = await fetch('/api/items');
        if (!res.ok) throw new Error('Fetch failed');

        cachedItems = await res.json();
        populateCategoryFilter(cachedItems);
        render(cachedItems);
    }

    function bindEvents() {
        const rerenderFromFirstPage = () => {
            currentPage = 1;
            render(cachedItems);
        };

        queryInput?.addEventListener('input', rerenderFromFirstPage);
        categoryFilterInput?.addEventListener('change', rerenderFromFirstPage);

        clearFilter?.addEventListener('click', () => {
            if (queryInput) queryInput.value = '';
            if (categoryFilterInput) categoryFilterInput.value = '';
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

        list?.addEventListener('click', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const button = target.closest('.item-edit-btn');
            if (!(button instanceof HTMLElement)) return;

            const rawID = button.dataset.itemId;
            const itemID = Number.parseInt(rawID || '', 10);
            if (!Number.isFinite(itemID)) return;

            itemModalApi?.openEditItemModal(itemID);
        });
    }

    async function init() {
        bindEvents();
        itemModalApi = window.EventideItemModal?.mount({
            openButtonSelector: '#add-new-item-btn',
            getItemByID: (itemID) => cachedItems.find((item) => Number(item.item_id) === Number(itemID)),
            onSuccess: async () => {
                await loadItems();
            },
        }) || null;

        try {
            await loadItems();
        } catch (err) {
            if (list) list.innerHTML = `<p class="loading">Error loading items: ${err.message}</p>`;
            console.error(err);
        }
    }

    init();
})();
