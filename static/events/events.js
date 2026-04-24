(() => {
    const list = document.getElementById('events-list');
    const typeFilter = document.getElementById('event-type-filter');
    const userFilter = document.getElementById('user-filter');
    const warehouseFilter = document.getElementById('warehouse-filter');
    const queryInput = document.getElementById('item-sku-filter');
    const clearFilter = document.getElementById('clear-filter');
    const exportBtn = document.getElementById('export-events-csv');
    const prevPageBtn = document.getElementById('events-prev-page');
    const nextPageBtn = document.getElementById('events-next-page');
    const pageInfo = document.getElementById('events-page-info');
    const eventsContext = document.getElementById('events-context');

    let cachedEvents = [];
    let displayedEvents = [];
    let currentPage = 1;
    const PAGE_SIZE = 8;

    function parseApiErrorMessage(status, raw) {
        const text = String(raw || '').replace(/\s+/g, ' ').trim();
        const lower = text.toLowerCase();

        if (status === 401 || status === 403) {
            return 'Your session expired. Please log in again.';
        }

        if (lower.includes('insufficient stock')) {
            return 'Not enough stock in the selected warehouse.';
        }

        if (!text) {
            return status >= 500 ? 'Server error while loading events.' : 'Failed to load events.';
        }

        return text;
    }

    async function populateFilterOptions() {
        try {
            const [usersRes, warehousesRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/warehouses'),
            ]);

            if (usersRes.ok && userFilter) {
                const users = await usersRes.json();
                userFilter.innerHTML = '<option value="">All users</option>';
                users.forEach((u) => {
                    const username = String(u.username || '').trim();
                    if (!username) return;
                    const option = document.createElement('option');
                    option.value = username.toLowerCase();
                    option.textContent = u.name ? `${u.name} (${username})` : username;
                    userFilter.appendChild(option);
                });
            }

            if (warehousesRes.ok && warehouseFilter) {
                const warehouses = await warehousesRes.json();
                warehouseFilter.innerHTML = '<option value="">Warehouses</option>';
                warehouses.forEach((w) => {
                    const code = String(w.code || '').trim();
                    if (!code) return;
                    const option = document.createElement('option');
                    option.value = code.toLowerCase();
                    option.textContent = code;
                    warehouseFilter.appendChild(option);
                });
            }
        } catch (err) {
            console.error('Failed to load dynamic filter options', err);
        }
    }

    function formatDate(dateString) {
        const d = new Date(dateString);
        return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function formatLocalDateTime(value) {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return String(value);
        return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }

    function getEventBadgeType(type) {
        const normalized = (type || '').toLowerCase();
        if (normalized.includes('inbound')) return 'event-in';
        if (normalized.includes('outbound')) return 'event-out';
        if (normalized.includes('adjustment')) return 'event-in';
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
            displayedEvents = [];
            list.innerHTML = '<p class="loading">No inventory events found.</p>';
            updateWarehouseContext([]);
            updatePaginationUI(0);
            return;
        }

        const filtered = events.filter(matchesFilters);
        displayedEvents = filtered;

        if (filtered.length === 0) {
            list.innerHTML = '<p class="loading">No matching events for current filters.</p>';
            updateWarehouseContext([]);
            updatePaginationUI(0);
            return;
        }

        updateWarehouseContext(filtered);
        const hasWarehouseFilter = selectedWarehouseCode() !== '';

        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        if (currentPage < 1) currentPage = 1;

        const start = (currentPage - 1) * PAGE_SIZE;
        const paginated = filtered.slice(start, start + PAGE_SIZE);

        list.innerHTML = '';
        paginated.forEach(evt => {
            const row = document.createElement('div');
            const badgeType = getEventBadgeType(evt.type);
            row.className = `event-row ${badgeType}`;
            const warehouseCode = evt.warehouse_code || 'No warehouse';
            const warehouseChip = !hasWarehouseFilter ? `<span class="warehouse-chip" title="Warehouse">${warehouseCode}</span>` : '';

            const icon = document.createElement('div');
            icon.className = 'event-icon';
            icon.textContent = (evt.type || 'N/A').toUpperCase().slice(0, 3);

            const details = document.createElement('div');
            details.className = 'event-details';
            details.innerHTML = `
                <div class="event-title-line">
                    <div class="event-title">${evt.item_name || 'Unknown item'} (${evt.sku || 'SKU N/A'})</div>
                    ${warehouseChip}
                </div>
                <div class="event-meta">${evt.username || 'Unknown user'} · ${evt.reason_code || 'No reason'} · ${formatDate(evt.timestamp)}</div>
            `;

            const qty = document.createElement('div');
            qty.className = 'event-qty';
            qty.textContent = (evt.quantity_change >= 0 ? '+' : '') + evt.quantity_change;

            row.appendChild(icon);
            row.appendChild(details);
            row.appendChild(qty);

            list.appendChild(row);
        });

        updatePaginationUI(totalPages);
    }

    function exportEventsCsv() {
        if (!window.EventideExport || typeof window.EventideExport.exportCsv !== 'function') return;

        const exportedAtLocal = new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        const dateStamp = new Date().toISOString().slice(0, 10);
        window.EventideExport.exportCsv({
            filename: `events-${dateStamp}.csv`,
            columns: [
                { header: 'Exported At (Local)', value: () => exportedAtLocal },
                { header: 'Event ID', value: (evt) => evt.id ?? '' },
                { header: 'Timestamp (Local)', value: (evt) => formatLocalDateTime(evt.timestamp) },
                { header: 'Type', value: (evt) => evt.type ?? '' },
                { header: 'Reason', value: (evt) => evt.reason_code ?? '' },
                { header: 'Item ID', value: (evt) => evt.item_id ?? '' },
                { header: 'Item Name', value: (evt) => evt.item_name ?? '' },
                { header: 'SKU', value: (evt) => evt.sku ?? '' },
                { header: 'Warehouse ID', value: (evt) => evt.warehouse_id ?? '' },
                { header: 'Warehouse Code', value: (evt) => evt.warehouse_code ?? '' },
                { header: 'User ID', value: (evt) => evt.user_id ?? '' },
                { header: 'Username', value: (evt) => evt.username ?? '' },
                { header: 'Quantity Change', value: (evt) => evt.quantity_change ?? 0 },
            ],
            rows: displayedEvents,
        });
    }

    function selectedWarehouseCode() {
        return String(warehouseFilter?.value || '').trim();
    }

    function updateWarehouseContext(rows) {
        if (!eventsContext) return;
        const selectedWarehouse = selectedWarehouseCode();
        if (!selectedWarehouse) {
            eventsContext.hidden = true;
            eventsContext.innerHTML = '';
            return;
        }

        eventsContext.hidden = false;
        eventsContext.innerHTML = `
            <span class="warehouse-context-pill">Warehouse: ${selectedWarehouse.toUpperCase()}</span>
        `;
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

    async function loadEvents() {
        if (list) list.innerHTML = '<p class="loading">Loading events...</p>';
        const res = await fetch('/api/events');

        if (!res.ok) {
            const raw = await res.text();
            throw new Error(parseApiErrorMessage(res.status, raw));
        }

        const payload = await res.json();
        if (!Array.isArray(payload)) {
            throw new Error('Unexpected events response format.');
        }
        cachedEvents = payload;

        cachedEvents.forEach(evt => {
            if (!evt.item_name && evt.item_id) evt.item_name = `Item #${evt.item_id}`;
        });
        render(cachedEvents);
    }

    function bindEvents() {
        const rerenderFromFirstPage = () => {
            currentPage = 1;
            render(cachedEvents);
        };

        typeFilter?.addEventListener('change', rerenderFromFirstPage);
        userFilter?.addEventListener('change', rerenderFromFirstPage);
        warehouseFilter?.addEventListener('change', rerenderFromFirstPage);
        queryInput?.addEventListener('input', rerenderFromFirstPage);

        prevPageBtn?.addEventListener('click', () => {
            currentPage -= 1;
            render(cachedEvents);
        });

        nextPageBtn?.addEventListener('click', () => {
            currentPage += 1;
            render(cachedEvents);
        });

        clearFilter?.addEventListener('click', () => {
            if (typeFilter) typeFilter.value = '';
            if (userFilter) userFilter.value = '';
            if (warehouseFilter) warehouseFilter.value = '';
            if (queryInput) queryInput.value = '';
            currentPage = 1;
            render(cachedEvents);
        });

        exportBtn?.addEventListener('click', exportEventsCsv);

        window.addEventListener('eventide:events:refresh', () => {
            currentPage = 1;
            loadEvents().catch((err) => {
                if (list) list.innerHTML = `<p class="loading">Error loading events: ${err.message}</p>`;
                console.error(err);
            });
        });
    }

    async function init() {
        bindEvents();
        try {
            await populateFilterOptions();
            await loadEvents();
        } catch (err) {
            if (list) list.innerHTML = `<p class="loading">Error loading events: ${err.message}</p>`;
            console.error(err);
        }
    }

    init();
})();
