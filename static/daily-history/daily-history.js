(() => {
	const list = document.getElementById('daily-history-list');
	const startDateInput = document.getElementById('start-date-filter');
	const endDateInput = document.getElementById('end-date-filter');
	const itemFilter = document.getElementById('item-filter');
	const applyFilterBtn = document.getElementById('apply-filter');
	const clearFilterBtn = document.getElementById('clear-filter');
	const prevPageBtn = document.getElementById('history-prev-page');
	const nextPageBtn = document.getElementById('history-next-page');
	const pageInfo = document.getElementById('history-page-info');

	const statRowsEl = document.getElementById('stat-history-rows');
	const statInEl = document.getElementById('stat-history-in');
	const statOutEl = document.getElementById('stat-history-out');
	const statNetEl = document.getElementById('stat-history-net');

	let cachedRows = [];
	let currentPage = 1;
	const PAGE_SIZE = 12;

	function setDefaultDates() {
		const today = new Date();
		const lastWeek = new Date(today);
		lastWeek.setDate(today.getDate() - 7);

		if (startDateInput) startDateInput.value = lastWeek.toISOString().slice(0, 10);;
		if (endDateInput) endDateInput.value = today.toISOString().slice(0, 10);
	}

	function formatDate(raw) {
		if (!raw) return 'N/A';
		const d = new Date(raw);
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

	function render(rows) {
		if (!list) return;

		if (!rows || rows.length === 0) {
			list.innerHTML = '<p class="loading">No statements for selected filters.</p>';
			updatePaginationUI(0);
			updateStats([]);
			return;
		}

		updateStats(rows);

		const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
		if (currentPage > totalPages) currentPage = totalPages;
		if (currentPage < 1) currentPage = 1;

		const start = (currentPage - 1) * PAGE_SIZE;
		const paginated = rows.slice(start, start + PAGE_SIZE);

		list.innerHTML = '';
		paginated.forEach((row) => {
			const net = Number(row.net_change || 0);
			const rowClass = net >= 0 ? 'event-in' : 'event-out';
			const card = document.createElement('div');
			card.className = `event-row ${rowClass}`;
			card.innerHTML = `
				<div class="event-details">
					<div class="event-title">${row.item_name || 'Unknown item'} (ID: ${row.item_id ?? '-'})</div>
					<div class="event-meta">${formatDate(row.date)} · In ${row.in_quantity ?? 0} · Out ${row.out_quantity ?? 0}</div>
				</div>
				<div class="event-qty">${net >= 0 ? '+' : ''}${net}</div>
			`;
			list.appendChild(card);
		});

		updatePaginationUI(totalPages);
	}

	async function populateItemsFilter() {
		if (!itemFilter) return;
		try {
			const res = await fetch('/api/items');
			if (!res.ok) return;

			const items = await res.json();
			itemFilter.innerHTML = '<option value="">All items</option>';
			(items || []).forEach((item) => {
				const id = Number(item.item_id);
				if (!Number.isFinite(id)) return;
				const option = document.createElement('option');
				option.value = String(id);
				option.textContent = `${item.name || 'Unnamed item'} (${item.sku || 'SKU N/A'})`;
				itemFilter.appendChild(option);
			});
		} catch (err) {
			console.error('Failed to load items filter', err);
		}
	}

	async function loadStatements() {
		if (!list) return;
		const startDate = (startDateInput?.value || '').trim();
		const endDate = (endDateInput?.value || '').trim();

		if (!startDate || !endDate) {
			list.innerHTML = '<p class="loading">Start date and end date are required.</p>';
			updateStats([]);
			updatePaginationUI(0);
			return;
		}

		const params = new URLSearchParams({
			start_date: startDate,
			end_date: endDate,
		});

		const selectedItem = (itemFilter?.value || '').trim();
		if (selectedItem) {
			params.set('item_id', selectedItem);
		}

		list.innerHTML = '<p class="loading">Loading daily history...</p>';
		const response = await fetch(`/api/daily-statements?${params.toString()}`);
		if (!response.ok) throw new Error(await response.text() || 'Fetch failed');

		cachedRows = await response.json();
		currentPage = 1;
		render(cachedRows);
	}

	function bindEvents() {
		applyFilterBtn?.addEventListener('click', () => {
			loadStatements().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading daily history: ${err.message}</p>`;
				updateStats([]);
				updatePaginationUI(0);
			});
		});

		clearFilterBtn?.addEventListener('click', () => {
			setDefaultDates();
			if (itemFilter) itemFilter.value = '';
			loadStatements().catch((err) => {
				if (list) list.innerHTML = `<p class="loading">Error loading daily history: ${err.message}</p>`;
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
		setDefaultDates();
		bindEvents();
		await populateItemsFilter();
		await loadStatements();
	}

	init().catch((err) => {
		if (list) list.innerHTML = `<p class="loading">Error loading daily history: ${err.message}</p>`;
		updateStats([]);
		updatePaginationUI(0);
	});
})();
