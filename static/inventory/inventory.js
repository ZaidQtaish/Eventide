(() => {
    const list = document.getElementById('snapshots-list');
    const dateFilter = document.getElementById('date-filter');
    const queryFilter = document.getElementById('query-filter');
    const clearFilter = document.getElementById('clear-filter');

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const d = new Date(dateString);
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function matchesFilters(row) {
        const query = (queryFilter?.value || '').toLowerCase();
        const date = (dateFilter?.value || '').trim();

        if (date) {
            const rowDate = (row.last_updated || '').slice(0, 10);
            if (rowDate !== date) return false;
        }

        if (query) {
            const fields = [
                row.name,
                row.sku,
                row.warehouse_code,
                row.item_id,
                row.warehouse_id,
            ];
            const hasMatch = fields.some(f => String(f || '').toLowerCase().includes(query));
            if (!hasMatch) return false;
        }
        return true;
    }

    function render(data) {
        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = '<p class="loading">No snapshots found.</p>';
            return;
        }

        const filtered = data.filter(matchesFilters);
        if (filtered.length === 0) {
            list.innerHTML = '<p class="loading">No matching snapshots for current filters.</p>';
            return;
        }

        list.innerHTML = '';
        filtered.forEach(row => {
            const el = document.createElement('div');
            el.className = 'event-row';
            el.innerHTML = `
                <div class="event-details">
                    <div class="event-title">${row.name || 'Unknown item'} (${row.sku || 'SKU N/A'})</div>
                    <div class="event-meta">Warehouse ${row.warehouse_code || row.warehouse_id || 'N/A'} · Item ID ${row.item_id} · Updated ${formatDate(row.last_updated)}</div>
                </div>
                <div class="event-qty" title="Current quantity">${row.current_quantity}</div>
            `;

            if (row.current_quantity <= (row.minimum_quantity || 0)) {
                el.classList.add('event-out');
            } else {
                el.classList.add('event-in');
            }

            list.appendChild(el);
        });
    }

    async function load() {
        if (list) list.innerHTML = '<p class="loading">Loading snapshots...</p>';
        try {
            const res = await fetch('/inventory');
            if (!res.ok) throw new Error('Fetch failed');
            const data = await res.json();
            render(data);

            dateFilter?.addEventListener('change', () => render(data));
            queryFilter?.addEventListener('input', () => render(data));
            clearFilter?.addEventListener('click', () => {
                if (dateFilter) dateFilter.value = '';
                if (queryFilter) queryFilter.value = '';
                render(data);
            });
        } catch (err) {
            if (list) list.innerHTML = `<p class="loading">Error loading snapshots: ${err.message}</p>`;
            console.error(err);
        }
    }

    load();
})();
