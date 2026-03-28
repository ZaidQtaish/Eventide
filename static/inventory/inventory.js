(() => {
    const list = document.getElementById('snapshots-list');
    const warehouseFilter = document.getElementById('warehouse-filter');
    const queryInput = document.getElementById('item-sku-filter');
    const clearFilter = document.getElementById('clear-filter');
    const searchForm = document.getElementById('search-form');
    let cachedRows = [];

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
            return;
        }

        const filtered = data.map(normalizeRow).filter(matchesFilters);
        if (filtered.length === 0) {
            list.innerHTML = '<p class="loading">No matching stock for current filters.</p>';
            return;
        }

        list.innerHTML = '';
        filtered.forEach(row => {
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
        warehouseFilter?.addEventListener('change', () => render(cachedRows));
        queryInput?.addEventListener('input', () => render(cachedRows));
        searchForm?.addEventListener('submit', (e) => { e.preventDefault(); render(cachedRows); });
        clearFilter?.addEventListener('click', () => {
            if (warehouseFilter) warehouseFilter.value = '';
            if (queryInput) queryInput.value = '';
            render(cachedRows);
        });

        window.addEventListener('eventide:inventory:refresh', () => {
            load().catch((err) => {
                if (list) list.innerHTML = `<p class="loading">Error loading stock: ${err.message}</p>`;
                console.error(err);
            });
        });
    }

    bindEvents();
    load();
})();
