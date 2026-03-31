(() => {
	const list = document.getElementById('warehouses-list');
	const statusFilter = document.getElementById('warehouse-status-filter');
	const searchFilter = document.getElementById('warehouse-search-filter');
	const clearFilter = document.getElementById('clear-filter');
	const prevPageBtn = document.getElementById('warehouses-prev-page');
	const nextPageBtn = document.getElementById('warehouses-next-page');
	const pageInfo = document.getElementById('warehouses-page-info');

	const totalWarehousesEl = document.getElementById('stat-total-warehouses');
	const activeWarehousesEl = document.getElementById('stat-active-warehouses');
	const inactiveWarehousesEl = document.getElementById('stat-inactive-warehouses');

	let cachedWarehouses = [];
	let currentPage = 1;
	const PAGE_SIZE = 8;

	function normalizeWarehouse(row) {
		return {
			code: String(row.code ?? row.Code ?? '').trim(),
			status: String(row.status ?? row.Status ?? '').trim().toLowerCase(),
		};
	}

	function updateStats(rows) {
		const total = rows.length;
		const active = rows.filter((w) => w.status === 'active').length;
		const inactive = rows.filter((w) => w.status === 'inactive').length;

		if (totalWarehousesEl) totalWarehousesEl.textContent = String(total);
		if (activeWarehousesEl) activeWarehousesEl.textContent = String(active);
		if (inactiveWarehousesEl) inactiveWarehousesEl.textContent = String(inactive);
	}

	function matchesFilters(row) {
		const selectedStatus = (statusFilter?.value || '').toLowerCase();
		const query = (searchFilter?.value || '').toLowerCase();

		if (selectedStatus && row.status !== selectedStatus) {
			return false;
		}

		if (!query) return true;
		return [row.code, row.status].some((value) => String(value || '').toLowerCase().includes(query));
	}

	function updatePaginationUI(totalPages) {
		const hasPages = totalPages > 0;
		const safeTotal = hasPages ? totalPages : 1;
		const safeCurrent = hasPages ? currentPage : 1;

		if (pageInfo) pageInfo.textContent = `Page ${safeCurrent} of ${safeTotal}`;
		if (prevPageBtn) prevPageBtn.disabled = !hasPages || safeCurrent <= 1;
		if (nextPageBtn) nextPageBtn.disabled = !hasPages || safeCurrent >= safeTotal;
	}

	function render(rows) {
		if (!list) return;

		if (!rows || rows.length === 0) {
			list.innerHTML = '<p class="loading">No warehouses found.</p>';
			updatePaginationUI(0);
			return;
		}

		const filtered = rows.filter(matchesFilters);
		if (filtered.length === 0) {
			list.innerHTML = '<p class="loading">No matching warehouses for current filters.</p>';
			updatePaginationUI(0);
			return;
		}

		const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;

		const start = (currentPage - 1) * PAGE_SIZE;
		const paginated = filtered.slice(start, start + PAGE_SIZE);

		list.innerHTML = '';
		paginated.forEach((row) => {
			const isActive = row.status === 'active';
			const card = document.createElement('div');
			card.className = `event-row ${isActive ? 'event-in' : 'event-out'}`;
			card.innerHTML = `
				<div class="event-details">
					<div class="event-title">${row.code || 'Unknown warehouse'}</div>
					<div class="event-meta">Status: ${row.status || 'unknown'}</div>
				</div>
				<div class="pill ${isActive ? '' : 'warning'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</div>
			`;
			list.appendChild(card);
		});

		updatePaginationUI(totalPages);
	}

	async function loadWarehouses() {
		if (list) list.innerHTML = '<p class="loading">Loading warehouses...</p>';

		const response = await fetch('/api/warehouses');
		if (!response.ok) throw new Error('Fetch failed');

		const data = await response.json();
		cachedWarehouses = (data || []).map(normalizeWarehouse);
		updateStats(cachedWarehouses);
		render(cachedWarehouses);
	}

	function bindEvents() {
		const rerenderFromFirstPage = () => {
			currentPage = 1;
			render(cachedWarehouses);
		};

		statusFilter?.addEventListener('change', rerenderFromFirstPage);
		searchFilter?.addEventListener('input', rerenderFromFirstPage);

		clearFilter?.addEventListener('click', () => {
			if (statusFilter) statusFilter.value = '';
			if (searchFilter) searchFilter.value = '';
			rerenderFromFirstPage();
		});

		prevPageBtn?.addEventListener('click', () => {
			currentPage -= 1;
			render(cachedWarehouses);
		});

		nextPageBtn?.addEventListener('click', () => {
			currentPage += 1;
			render(cachedWarehouses);
		});
	}

	async function init() {
		bindEvents();
		try {
			await loadWarehouses();
		} catch (err) {
			if (list) list.innerHTML = `<p class="loading">Error loading warehouses: ${err.message}</p>`;
			console.error(err);
		}
	}

	init();
})();
