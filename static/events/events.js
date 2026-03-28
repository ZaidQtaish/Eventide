(() => {
    const list = document.getElementById('events-list');
    const typeFilter = document.getElementById('event-type-filter');
    const userFilter = document.getElementById('user-filter');
    const warehouseFilter = document.getElementById('warehouse-filter');
    const queryInput = document.getElementById('item-sku-filter');
    const clearFilter = document.getElementById('clear-filter');

    let cachedEvents = [];

    function formatDate(dateString) {
        const d = new Date(dateString);
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function getEventBadgeType(type) {
        const normalized = (type || '').toLowerCase();
        if (normalized.includes('inbound')) return 'event-in';
        if (normalized.includes('outbound')) return 'event-out';
        if (normalized.includes('adjustment')) return 'event-in';
        if (normalized.includes('transfer')) return 'event-in';
        return 'event-in';
    }

    function matchesFilters(evt) {
        const type = (typeFilter?.value || '').toLowerCase();
        const user = (userFilter?.value || '').toLowerCase();
        const warehouse = (warehouseFilter?.value || '').toLowerCase();
        const query = (queryInput?.value || '').toLowerCase();

        if (type && (evt.type || '').toLowerCase() !== type) return false;
        if (user && (evt.username || '').toLowerCase() !== user) return false;
        if (warehouse && String(evt.warehouse_code || '').toLowerCase() !== warehouse) return false;

        if (query) {
            const fields = [
                evt.item_name,
                evt.sku,
                evt.warehouse_code,
                evt.username,
                evt.type,
                evt.reason_code,
            ];
            const hasMatch = fields.some(field => String(field || '').toLowerCase().includes(query));
            if (!hasMatch) return false;
        }
        return true;
    }

    function render(events) {
        if (!list) return;
        if (!events || events.length === 0) {
            list.innerHTML = '<p class="loading">No inventory events found.</p>';
            return;
        }

        const filtered = events.filter(matchesFilters);

        if (filtered.length === 0) {
            list.innerHTML = '<p class="loading">No matching events for current filters.</p>';
            return;
        }

        list.innerHTML = '';
        filtered.forEach(evt => {
            const row = document.createElement('div');
            const badgeType = getEventBadgeType(evt.type);
            row.className = `event-row ${badgeType}`;

            const icon = document.createElement('div');
            icon.className = 'event-icon';
            icon.textContent = (evt.type || 'N/A').toUpperCase().slice(0, 3);

            const details = document.createElement('div');
            details.className = 'event-details';
            details.innerHTML = `
                <div class="event-title">${evt.item_name || 'Unknown item'} (${evt.sku || 'SKU N/A'})</div>
                <div class="event-meta">${evt.warehouse_code || 'No warehouse'} · ${evt.username || 'Unknown user'} · ${evt.reason_code || 'No reason'} · ${formatDate(evt.timestamp)}</div>
            `;

            const qty = document.createElement('div');
            qty.className = 'event-qty';
            qty.textContent = (evt.quantity_change >= 0 ? '+' : '') + evt.quantity_change;

            row.appendChild(icon);
            row.appendChild(details);
            row.appendChild(qty);

            list.appendChild(row);
        });
    }

    async function loadEvents() {
        if (list) list.innerHTML = '<p class="loading">Loading events...</p>';
        const res = await fetch('/events');
        if (!res.ok) throw new Error('Fetch failed');
        cachedEvents = await res.json();

        cachedEvents.forEach(evt => {
            if (!evt.item_name && evt.item_id) evt.item_name = `Item #${evt.item_id}`;
        });
        render(cachedEvents);
    }

    function bindEvents() {
        typeFilter?.addEventListener('change', () => render(cachedEvents));
        userFilter?.addEventListener('change', () => render(cachedEvents));
        warehouseFilter?.addEventListener('change', () => render(cachedEvents));
        queryInput?.addEventListener('input', () => render(cachedEvents));

        clearFilter?.addEventListener('click', () => {
            if (typeFilter) typeFilter.value = '';
            if (userFilter) userFilter.value = '';
            if (warehouseFilter) warehouseFilter.value = '';
            if (queryInput) queryInput.value = '';
            render(cachedEvents);
        });

        window.addEventListener('eventide:events:refresh', () => {
            loadEvents().catch((err) => {
                if (list) list.innerHTML = `<p class="loading">Error loading events: ${err.message}</p>`;
                console.error(err);
            });
        });
    }

    async function init() {
        bindEvents();
        try {
            await loadEvents();
        } catch (err) {
            if (list) list.innerHTML = `<p class="loading">Error loading events: ${err.message}</p>`;
            console.error(err);
        }
    }

    init();
})();
