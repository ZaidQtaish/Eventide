(() => {
    const list = document.getElementById('snapshots-list');
    const warehouseFilter = document.getElementById('warehouse-filter');
    const queryInput = document.getElementById('item-sku-filter');
    const clearFilter = document.getElementById('clear-filter');
    const searchForm = document.getElementById('search-form');
    const prevPageBtn = document.getElementById('inventory-prev-page');
    const nextPageBtn = document.getElementById('inventory-next-page');
    const pageInfo = document.getElementById('inventory-page-info');
    let cachedRows = [];
    let currentPage = 1;
    const PAGE_SIZE = 10;

    function normalizeRow(row) {
        return {
            name: row.name ?? row.Name,
            sku: row.sku ?? row.SKU,
            warehouse_code: row.warehouse_code ?? row.WarehouseCode ?? row.code,
            warehouse_id: row.warehouse_id ?? row.WarehouseID,
            item_id: row.item_id ?? row.ItemID,
            minimum_quantity: row.minimum_quantity ?? row.MinimumQuantity ?? row.minimum_stock ?? row.MinimumStock,
            current_quantity: row.current_quantity ?? row.CurrentQuantity ?? row.quantity ?? row.Quantity ?? 0,
            last_updated: row.last_updated ?? row.LastUpdated,
        };
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function matchesFilters(row) {
        const warehouse = (warehouseFilter?.value || '').toLowerCase();
        const query = (queryInput?.value || '').toLowerCase();

        if (warehouse && String(row.warehouse_code || '').toLowerCase() !== warehouse) return false;

        if (query) {
            const fields = [row.name, row.sku, row.warehouse_code, row.item_id, row.warehouse_id];
            const hasMatch = fields.some(f => String(f || '').toLowerCase().includes(query));
            if (!hasMatch) return false;
        }
        return true;
    }

    function render(data) {
        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="loading">No stock found.</p>';
            updatePaginationUI(0);
            return;
        }

        const filtered = data.map(normalizeRow).filter(matchesFilters);
        if (filtered.length === 0) {
            list.innerHTML = '<p class="loading">No matching stock for current filters.</p>';
            updatePaginationUI(0);
            return;
        }

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const start = (currentPage - 1) * PAGE_SIZE;
        const paginated = filtered.slice(start, start + PAGE_SIZE);

        list.innerHTML = '';
        paginated.forEach(row => {
            const el = document.createElement('div');
            const isLow = row.current_quantity <= (row.minimum_quantity || 0);
            el.className = `event-row ${isLow ? 'event-out' : 'event-in'}`;
            el.innerHTML = `
                <div class="event-details">
                    <div class="event-title">${row.name || 'Unknown item'} (${row.sku || 'SKU N/A'})</div>
                    <div class="event-meta">${row.warehouse_code || row.warehouse_id || 'No warehouse'} · Min ${row.minimum_quantity ?? '-'} · Updated ${formatDate(row.last_updated)}</div>
                </div>
                <div class="event-qty" title="Current quantity">${row.current_quantity}</div>
            `;
            list.appendChild(el);
        });

        updatePaginationUI(totalPages);
    }

    function updatePaginationUI(totalPages) {
        const hasPages = totalPages > 0;
        const safeTotal = hasPages ? totalPages : 1;
        const safeCurrent = hasPages ? currentPage : 1;

        if (pageInfo) {
            pageInfo.textContent = `Page ${safeCurrent} of ${safeTotal}`;
        }
        if (prevPageBtn) {
            prevPageBtn.disabled = !hasPages || safeCurrent <= 1;
        }
        if (nextPageBtn) {
            nextPageBtn.disabled = !hasPages || safeCurrent >= safeTotal;
        }
    }

    async function load() {
        if (list) list.innerHTML = '<p class="loading">Loading stock...</p>';
        try {
            const res = await fetch('/inventory');
            if (!res.ok) throw new Error('Fetch failed');
            cachedRows = await res.json();
            render(cachedRows);
        } catch (err) {
            if (list) list.innerHTML = `<p class="loading">Error loading stock: ${err.message}</p>`;
            console.error(err);
        }
    }

    function bindEvents() {
        const rerenderFromFirstPage = () => {
            currentPage = 1;
            render(cachedRows);
        };

        warehouseFilter?.addEventListener('change', rerenderFromFirstPage);
        queryInput?.addEventListener('input', rerenderFromFirstPage);
        searchForm?.addEventListener('submit', (e) => { e.preventDefault(); rerenderFromFirstPage(); });

        prevPageBtn?.addEventListener('click', () => {
            currentPage -= 1;
            render(cachedRows);
        });

        nextPageBtn?.addEventListener('click', () => {
            currentPage += 1;
            render(cachedRows);
        });

        clearFilter?.addEventListener('click', () => {
            if (warehouseFilter) warehouseFilter.value = '';
            if (queryInput) queryInput.value = '';
            currentPage = 1;
            render(cachedRows);
        });

        window.addEventListener('eventide:inventory:refresh', () => {
            currentPage = 1;
            load().catch((err) => {
                if (list) list.innerHTML = `<p class="loading">Error loading stock: ${err.message}</p>`;
                console.error(err);
            });
        });
    }

    bindEvents();
    load();
})();
