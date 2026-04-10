(() => {
	const list = document.getElementById('daily-history-list');
	const startDateInput = document.getElementById('start-date-filter');
	const endDateInput = document.getElementById('end-date-filter');
	const windowInput = document.getElementById('history-window-filter');
	const modeDailyBtn = document.getElementById('mode-daily');
	const modeMonthlyBtn = document.getElementById('mode-monthly');
	const periodPill = document.getElementById('history-period-pill');
	const itemFilter = document.getElementById('item-filter');
	const warehouseFilter = document.getElementById('warehouse-filter');
	const applyFilterBtn = document.getElementById('apply-filter');
	const clearFilterBtn = document.getElementById('clear-filter');
	const prevPageBtn = document.getElementById('history-prev-page');
	const nextPageBtn = document.getElementById('history-next-page');
	const pageInfo = document.getElementById('history-page-info');
	const historyContext = document.getElementById('daily-history-context');

	const statRowsEl = document.getElementById('stat-history-rows');
	const statInEl = document.getElementById('stat-history-in');
	const statOutEl = document.getElementById('stat-history-out');
	const statNetEl = document.getElementById('stat-history-net');

	let cachedRows = [];
	let currentPage = 1;
	const PAGE_SIZE = 12;
	const itemsById = new Map();
	const defaultWindowByMode = { daily: 7, monthly: 4 };
	let currentPeriod = 'daily';

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

	function setDefaultDates() {
		const today = new Date();
		const lastWeek = new Date(today);
		lastWeek.setDate(today.getDate() - 7);

		if (startDateInput) startDateInput.value = lastWeek.toISOString().slice(0, 10);;
		if (endDateInput) endDateInput.value = today.toISOString().slice(0, 10);
	}

	function setModeUI(period) {
		const isDaily = period === 'daily';
		currentPeriod = isDaily ? 'daily' : 'monthly';

		modeDailyBtn?.classList.toggle('active', isDaily);
		modeMonthlyBtn?.classList.toggle('active', !isDaily);

		if (windowInput) {
			windowInput.min = '1';
			windowInput.max = isDaily ? '90' : '24';
			windowInput.placeholder = isDaily ? 'Window (days)' : 'Window (months)';
		}

		if (startDateInput) {
			startDateInput.disabled = !isDaily;
		}
		if (endDateInput) {
			endDateInput.disabled = !isDaily;
		}

		if (periodPill) {
			periodPill.textContent = isDaily ? 'Daily' : 'Monthly';
		}

		if (isDaily) {
			if (!startDateInput?.value || !endDateInput?.value) {
				setDefaultDates();
			}
		} else {
			if (startDateInput) startDateInput.value = '';
			if (endDateInput) endDateInput.value = '';
		}
	}

	function formatDate(raw) {
		if (!raw) return 'N/A';
		const d = new Date(raw);
		return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
	}

	function dateGroupKey(raw) {
		if (!raw) return '';
		const parsed = new Date(raw);
		if (Number.isNaN(parsed.getTime())) return String(raw);
		if (currentPeriod === 'monthly') {
			return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
		}
		return parsed.toISOString().slice(0, 10);
	}

	function formatGroupLabel(raw) {
		if (!raw) return 'N/A';
		const d = new Date(raw);
		if (Number.isNaN(d.getTime())) return String(raw);
		if (currentPeriod === 'monthly') {
			return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
		}
		return d.toLocaleDateString(undefined, { dateStyle: 'medium' });
	}

	function updateStats(rows) {
		const totalRows = rows.length;
		const totalIn = rows.reduce((sum, r) => sum + Number(r.in_quantity || 0), 0);
		const totalOut = rows.reduce((sum, r) => sum + Number(r.out_quantity || 0), 0);
		const totalNet = rows.reduce((sum, r) => sum + Number(r.net_change || 0), 0);

		if (statRowsEl) statRowsEl.textContent = String(totalRows);
		if (statInEl) statInEl.textContent = String(totalIn);
		if (statOutEl) statOutEl.textContent = String(totalOut);
		if (statNetEl) statNetEl.textContent = String(totalNet);
	}

	function updatePaginationUI(totalPages) {
		const hasPages = totalPages > 0;
		const safeTotal = hasPages ? totalPages : 1;
		const safeCurrent = hasPages ? currentPage : 1;

		if (pageInfo) pageInfo.textContent = `Page ${safeCurrent} of ${safeTotal}`;
		if (prevPageBtn) prevPageBtn.disabled = !hasPages || safeCurrent <= 1;
		if (nextPageBtn) nextPageBtn.disabled = !hasPages || safeCurrent >= safeTotal;
	}

	function selectedWarehouseCode() {
		return String(warehouseFilter?.value || '').trim();
	}

	function updateHistoryContext(rows) {
		if (!historyContext) return;
		const selectedWarehouse = selectedWarehouseCode();
		if (!selectedWarehouse) {
			historyContext.hidden = true;
			historyContext.innerHTML = '';
			return;
		}
        
		historyContext.hidden = false;
		historyContext.innerHTML = `
			<span class="warehouse-context-pill">Warehouse: ${selectedWarehouse}</span>
		`;
	}

	function render(rows) {
		if (!list) return;
		const hasWarehouseFilter = selectedWarehouseCode() !== '';

		if (!rows || rows.length === 0) {
			list.innerHTML = '<p class="loading">No statements for selected filters.</p>';
			updateHistoryContext([]);
			updatePaginationUI(0);
			updateStats([]);
			return;
		}

		updateStats(rows);
		updateHistoryContext(rows);

		const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;

		const start = (currentPage - 1) * PAGE_SIZE;
		const paginated = rows.slice(start, start + PAGE_SIZE);
		let previousDateKey = '';

		list.innerHTML = '';
		paginated.forEach((row) => {
			const currentDateKey = dateGroupKey(row.date);
			if (currentDateKey !== previousDateKey) {
				const separator = document.createElement('div');
				separator.className = 'day-separator';
				separator.innerHTML = `<span>${formatGroupLabel(row.date)}</span>`;
				list.appendChild(separator);
				previousDateKey = currentDateKey;
			}

			const net = Number(row.net_change || 0);
			const rowClass = net >= 0 ? 'event-in' : 'event-out';
			const itemMeta = itemsById.get(Number(row.item_id));
			const itemName = itemMeta?.name || row.item_name || 'Unknown item';
			const sku = itemMeta?.sku || '';
			const skuLabel = sku || 'SKU N/A';
			const warehouseCode = String(row.warehouse_code || '').trim();
			const warehouseChip = !hasWarehouseFilter && warehouseCode
				? `<span class="warehouse-chip" title="Warehouse">${warehouseCode}</span>`
				: '';
			const card = document.createElement('div');
			card.className = `event-row ${rowClass}`;
			card.innerHTML = `
				<div class="event-main">
					${buildSkuThumb(sku)}
					<div class="event-details">
						<div class="event-title-line">
							<div class="event-title">${itemName} (${skuLabel})</div>
							${warehouseChip}
						</div>
						<div class="event-meta">${formatDate(row.date)} · In ${row.in_quantity ?? 0} · Out ${row.out_quantity ?? 0}</div>
					</div>
				</div>
				<div class="event-qty">${net >= 0 ? '+' : ''}${net}</div>
			`;
			list.appendChild(card);
			applySkuThumbFallback(card);
		});

		updatePaginationUI(totalPages);
	}

	async function populateItemsFilter() {
		if (!itemFilter) return;
		try {
			const res = await fetch('/api/items');
			if (!res.ok) return;

			const items = await res.json();
			itemsById.clear();
			itemFilter.innerHTML = '<option value="">All items</option>';
			(items || []).forEach((item) => {
				const id = Number(item.item_id);
				if (!Number.isFinite(id)) return;
				itemsById.set(id, {
					name: item.name || 'Unnamed item',
					sku: item.sku || '',
				});
				const option = document.createElement('option');
				option.value = String(id);
				option.textContent = `${item.name || 'Unnamed item'} (${item.sku || 'SKU N/A'})`;
				itemFilter.appendChild(option);
			});
		} catch (err) {
			console.error('Failed to load items filter', err);
		}
	}

	async function populateWarehouseFilter() {
		if (!warehouseFilter) return;
		try {
			const res = await fetch('/api/warehouses');
			if (!res.ok) return;

			const warehouses = await res.json();
			warehouseFilter.innerHTML = '<option value="">All warehouses</option>';
			(warehouses || []).forEach((warehouse) => {
				const code = String(warehouse.code || '').trim();
				if (!code) return;
				const option = document.createElement('option');
				option.value = code;
				option.textContent = code;
				warehouseFilter.appendChild(option);
			});
		} catch (err) {
			console.error('Failed to load warehouse filter', err);
		}
	}

	async function loadStatements() {
		if (!list) return;
		const defaultWindow = defaultWindowByMode[currentPeriod] || 7;
		const inputMax = currentPeriod === 'monthly' ? 24 : 90;
		const windowValue = Math.min(inputMax, Math.max(1, parseInt(windowInput?.value || String(defaultWindow), 10) || defaultWindow));
		if (windowInput) windowInput.value = String(windowValue);

		const startDate = (startDateInput?.value || '').trim();
		const endDate = (endDateInput?.value || '').trim();

		if (currentPeriod === 'daily' && (!startDate || !endDate)) {
			list.innerHTML = '<p class="loading">Start date and end date are required.</p>';
			updateStats([]);
			updatePaginationUI(0);
			return;
		}

		const params = new URLSearchParams({
			period: currentPeriod,
			window: String(windowValue),
		});

		if (currentPeriod === 'daily') {
			params.set('start_date', startDate);
			params.set('end_date', endDate);
		}

		const selectedItem = (itemFilter?.value || '').trim();
		if (selectedItem) {
			params.set('item_id', selectedItem);
		}

		const selectedWarehouse = (warehouseFilter?.value || '').trim();
		if (selectedWarehouse) {
			params.set('warehouse_code', selectedWarehouse);
		}

		list.innerHTML = '<p class="loading">Loading history...</p>';
		const response = await fetch(`/api/history?${params.toString()}`);
		if (!response.ok) throw new Error(await response.text() || 'Fetch failed');

		cachedRows = await response.json();
		currentPage = 1;
		render(cachedRows);
	}

	function bindEvents() {
		modeDailyBtn?.addEventListener('click', () => {
			setModeUI('daily');
			if (windowInput) windowInput.value = String(defaultWindowByMode.daily);
			loadStatements().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading history: ${err.message}</p>`;
				updateStats([]);
				updatePaginationUI(0);
			});
		});

		modeMonthlyBtn?.addEventListener('click', () => {
			setModeUI('monthly');
			if (windowInput) windowInput.value = String(defaultWindowByMode.monthly);
			loadStatements().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading history: ${err.message}</p>`;
				updateStats([]);
				updatePaginationUI(0);
			});
		});

		applyFilterBtn?.addEventListener('click', () => {
			loadStatements().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading history: ${err.message}</p>`;
				updateStats([]);
				updatePaginationUI(0);
			});
		});

		clearFilterBtn?.addEventListener('click', () => {
			if (windowInput) windowInput.value = String(defaultWindowByMode[currentPeriod] || 7);
			if (currentPeriod === 'daily') {
				setDefaultDates();
			} else {
				if (startDateInput) startDateInput.value = '';
				if (endDateInput) endDateInput.value = '';
			}
			if (itemFilter) itemFilter.value = '';
			if (warehouseFilter) warehouseFilter.value = '';
			loadStatements().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading history: ${err.message}</p>`;
				updateStats([]);
				updatePaginationUI(0);
			});
		});

		prevPageBtn?.addEventListener('click', () => {
			currentPage -= 1;
			render(cachedRows);
		});

		nextPageBtn?.addEventListener('click', () => {
			currentPage += 1;
			render(cachedRows);
		});
	}

	async function init() {
		setModeUI('daily');
		setDefaultDates();
		if (windowInput) windowInput.value = String(defaultWindowByMode.daily);
		bindEvents();
		await Promise.all([populateItemsFilter(), populateWarehouseFilter()]);
		await loadStatements();
	}

	init().catch((err) => {
		if (list) list.innerHTML = `<p class="loading">Error loading history: ${err.message}</p>`;
		updateStats([]);
		updatePaginationUI(0);
	});
})();
