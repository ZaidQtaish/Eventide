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
	let isAdminUser = false;
	const PAGE_SIZE = 8;

	async function loadSessionRole() {
		try {
			const res = await fetch('/api/session');
			if (!res.ok) return;
			const payload = await res.json();
			isAdminUser = String(payload.role || '').trim().toLowerCase() === 'admin';
		} catch {
			isAdminUser = false;
		}
	}

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
			const warehouseCode = row.code || 'Unknown warehouse';
			const inventoryLink = row.code ? `/app/inventory/?warehouse=${encodeURIComponent(row.code)}` : '/app/inventory/';
			const statusControl = isAdminUser
				? `
					<div class="warehouse-status-wrap">
						<select class="warehouse-status-select ${row.status === 'active' ? 'is-active' : 'is-inactive'}" data-warehouse-code="${warehouseCode}" aria-label="Warehouse status">
							<option value="active" ${row.status === 'active' ? 'selected' : ''}>Active</option>
							<option value="inactive" ${row.status === 'inactive' ? 'selected' : ''}>Inactive</option>
						</select>
					</div>
				`
				: `<div class="pill ${isActive ? '' : 'warning'}">${isActive ? 'ACTIVE' : 'INACTIVE'}</div>`;
			const card = document.createElement('div');
			card.className = `event-row warehouse-link-card ${isActive ? 'event-in' : 'event-out'}`;
			card.dataset.link = inventoryLink;
			card.tabIndex = 0;
			card.setAttribute('role', 'link');
			card.innerHTML = `
				<div class="event-details">
					<div class="event-title">${warehouseCode}</div>
					<div class="event-meta">Click row to open inventory</div>
				</div>
				${statusControl}
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

	async function updateWarehouseStatus(code, status) {
		const response = await fetch(`/api/warehouses/${encodeURIComponent(code)}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status }),
		});

		if (!response.ok) {
			throw new Error((await response.text()) || 'Update failed');
		}

		const updated = normalizeWarehouse(await response.json());
		const idx = cachedWarehouses.findIndex((w) => w.code === updated.code);
		if (idx >= 0) {
			cachedWarehouses[idx] = updated;
		}

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

		list?.addEventListener('click', (event) => {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			if (target.closest('.warehouse-status-select')) return;
			const card = target.closest('.warehouse-link-card');
			if (!(card instanceof HTMLElement)) return;

			const link = card.dataset.link;
			if (!link) return;
			window.location.href = link;
		});

		list?.addEventListener('keydown', (event) => {
			if (event.key !== 'Enter' && event.key !== ' ') return;
			const target = event.target;
			if (!(target instanceof HTMLElement) || !target.classList.contains('warehouse-link-card')) return;

			event.preventDefault();
			const link = target.dataset.link;
			if (!link) return;
			window.location.href = link;
		});

		list?.addEventListener('change', (event) => {
			if (!isAdminUser) return;
			const target = event.target;
			if (!(target instanceof HTMLSelectElement)) return;
			if (!target.classList.contains('warehouse-status-select')) return;

			const code = String(target.dataset.warehouseCode || '').trim();
			const nextStatus = String(target.value || '').trim().toLowerCase();
			if (!code || (nextStatus !== 'active' && nextStatus !== 'inactive')) return;

			const existing = cachedWarehouses.find((w) => w.code === code);
			const previousStatus = existing?.status || '';
			if (previousStatus === nextStatus) return;

			target.disabled = true;
			updateWarehouseStatus(code, nextStatus).catch((err) => {
				target.value = previousStatus || 'active';
				console.error('Failed to update warehouse status', err);
				window.alert(`Failed to update ${code}: ${err.message}`);
			}).finally(() => {
				target.disabled = false;
			});
		});
	}

	async function init() {
		bindEvents();
		try {
			await loadSessionRole();
			await loadWarehouses();
		} catch (err) {
			if (list) list.innerHTML = `<p class="loading">Error loading warehouses: ${err.message}</p>`;
			console.error(err);
		}
	}

	init();
})();
