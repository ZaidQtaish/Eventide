(() => {
    const modeDailyBtn = document.getElementById('mode-daily');
    const modeMonthlyBtn = document.getElementById('mode-monthly');
    const windowInput = document.getElementById('window-filter');
    const itemFilter = document.getElementById('item-filter');
    const warehouseFilter = document.getElementById('warehouse-filter');
    const applyBtn = document.getElementById('apply-forecast-filter');
    const clearBtn = document.getElementById('clear-forecast-filter');
    const tableBody = document.getElementById('forecast-table-body');
    const forecastForPill = document.getElementById('forecast-for-pill');
    const windowPill = document.getElementById('window-pill');
    const meta = document.getElementById('forecast-meta');

    const statRows = document.getElementById('forecast-stat-rows');
    const statIn = document.getElementById('forecast-stat-in');
    const statOut = document.getElementById('forecast-stat-out');
    const statNet = document.getElementById('forecast-stat-net');

    const itemsById = new Map();
    const defaultWindowByMode = { daily: 7, monthly: 3 };
    let currentPeriod = 'daily';
    let activeLoadToken = 0;

    function toNumber(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function getAverageNet(row) {
        const net = row.average_net_change;
        if (net !== undefined && net !== null) return toNumber(net, 0);
        return toNumber(row.average_in_quantity, 0) - toNumber(row.average_out_quantity, 0);
    }

    function getAIForecast(row) {
        const value = row.ai_forecast ?? row.ai_forecast_net ?? row.ai_forecast_quantity;
        if (value === undefined || value === null) return null;
        const parsed = toNumber(value, 0);
        return parsed === 0 ? null : parsed;
    }

    function getAIForecastIn(row) {
        const value = row.ai_forecast_in;
        if (value === undefined || value === null) return null;
        return toNumber(value, 0);
    }

    function getAIForecastOut(row) {
        const value = row.ai_forecast_out;
        if (value === undefined || value === null) return null;
        return toNumber(value, 0);
    }

    function forecastRowKey(row) {
        const itemId = row.item_id ?? '';
        const warehouseId = row.warehouse_id ?? '';
        const warehouseCode = row.warehouse_code ?? '';
        return `${itemId}|${warehouseId}|${warehouseCode}`;
    }

    function suppressZeroInOut(rows) {
        return (rows || []).filter((row) => {
            const avgIn = toNumber(row.average_in_quantity, 0);
            const avgOut = toNumber(row.average_out_quantity, 0);
            return !(avgIn === 0 && avgOut === 0);
        });
    }

    function tomorrowIsoDate() {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().slice(0, 10);
    }

    function setModeUI(period) {
        const isDaily = period === 'daily';
        currentPeriod = isDaily ? 'daily' : 'monthly';

        modeDailyBtn?.classList.toggle('active', isDaily);
        modeMonthlyBtn?.classList.toggle('active', !isDaily);

        if (windowInput) {
            if (isDaily) {
                windowInput.min = '1';
                windowInput.max = '90';
                windowInput.placeholder = 'Window (days)';
            } else {
                windowInput.min = '1';
                windowInput.max = '24';
                windowInput.placeholder = 'Window (months)';
            }
        }
    }

    function setStats(rows) {
        const totalRows = rows.length;
        const totalIn = rows.reduce((sum, row) => sum + toNumber(row.average_in_quantity, 0), 0);
        const totalOut = rows.reduce((sum, row) => sum + toNumber(row.average_out_quantity, 0), 0);
        const totalNet = rows.reduce((sum, row) => sum + getAverageNet(row), 0);

        statRows.textContent = String(totalRows);
        statIn.textContent = totalIn.toFixed(0);
        statOut.textContent = totalOut.toFixed(0);
        statNet.textContent = totalNet.toFixed(0);
    }

    function renderRows(rows, options = {}) {
        const { aiLoading = false } = options;

        if (!rows.length) {
            tableBody.innerHTML = '<tr><td colspan="9" class="loading">No forecast rows found for current filters.</td></tr>';
            return;
        }

        tableBody.innerHTML = rows.map((row) => {
            const item = row.item_name || `Item #${row.item_id || '-'}`;
            const warehouse = row.warehouse_code || (row.warehouse_id ? `WH ${row.warehouse_id}` : '-');
            const avgIn = toNumber(row.average_in_quantity, 0);
            const avgOut = toNumber(row.average_out_quantity, 0);
            const avgNet = getAverageNet(row);
            const netClass = avgNet >= 0 ? 'forecast-net-up' : 'forecast-net-down';

            // AI forecast values
            const aiIn = getAIForecastIn(row);
            const aiOut = getAIForecastOut(row);
            const aiNet = aiIn !== null && aiOut !== null ? aiIn - aiOut : null;

            let aiInHtml = '—';
            let aiOutHtml = '—';
            let aiNetHtml = '—';

            if (aiLoading) {
                aiInHtml = '<span class="loading">Loading...</span>';
                aiOutHtml = '<span class="loading">Loading...</span>';
                aiNetHtml = '<span class="loading">Loading...</span>';
            } else {
                if (aiIn !== null) {
                    aiInHtml = `<span class="forecast-value">${aiIn >= 0 ? '+' : ''}${aiIn.toFixed(0)}</span>`;
                }
                if (aiOut !== null) {
                    aiOutHtml = `<span class="forecast-value">${aiOut >= 0 ? '+' : ''}${aiOut.toFixed(0)}</span>`;
                }
                if (aiNet !== null) {
                    const aiNetClass = aiNet >= 0 ? 'forecast-net-up' : 'forecast-net-down';
                    aiNetHtml = `<span class="forecast-net ${aiNetClass}">${aiNet >= 0 ? '+' : ''}${aiNet.toFixed(0)}</span>`;
                }
            }

            return `
                <tr>
                    <td>${item}</td>
                    <td>${warehouse}</td>
                    <td>${avgIn.toFixed(0)}</td>
                    <td>${avgOut.toFixed(0)}</td>
                    <td><span class="forecast-net ${netClass}">${avgNet >= 0 ? '+' : ''}${avgNet.toFixed(0)}</span></td>
                    <td class="separator-col"></td>
                    <td>${aiInHtml}</td>
                    <td>${aiOutHtml}</td>
                    <td>${aiNetHtml}</td>
                </tr>
            `;
        }).join('');
    }

    function buildForecastParams(windowValue, includeAI) {
        const params = new URLSearchParams({
            period: currentPeriod,
            window: String(windowValue),
            include_ai: includeAI ? 'true' : 'false',
        });

        const selectedItem = (itemFilter.value || '').trim();
        const selectedWarehouse = (warehouseFilter.value || '').trim();

        if (selectedItem) params.set('item_id', selectedItem);
        if (selectedWarehouse) params.set('warehouse_code', selectedWarehouse);

        return params;
    }

    async function fetchForecastPayload(params) {
        const response = await fetch(`/api/forecast?${params.toString()}`);
        if (!response.ok) {
            throw new Error(await response.text() || 'Failed to load forecast');
        }
        return response.json();
    }

    function normalizeForecastPayload(payload, fallbackWindow) {
        const rows = Array.isArray(payload) ? payload : (payload.forecasts || []);
        const filteredRows = suppressZeroInOut(rows);
        const effectiveWindow = Array.isArray(payload) ? fallbackWindow : toNumber(payload.window, fallbackWindow);
        const effectivePeriod = Array.isArray(payload) ? currentPeriod : String(payload.period || currentPeriod).toLowerCase();
        const forecastFor = Array.isArray(payload) ? tomorrowIsoDate() : (payload.forecast_for || tomorrowIsoDate());

        return {
            rows,
            filteredRows,
            effectiveWindow,
            effectivePeriod,
            forecastFor,
        };
    }

    function setMeta(selectedItem, selectedWarehouse) {
        const parts = [];
        if (selectedItem) {
            const itemData = itemsById.get(Number(selectedItem));
            const label = itemData ? `${itemData.name} (${itemData.sku || 'SKU N/A'})` : `Item #${selectedItem}`;
            parts.push(`Item: ${label}`);
        }
        if (selectedWarehouse) {
            parts.push(`Warehouse: ${selectedWarehouse}`);
        }

        if (!parts.length) {
            meta.hidden = true;
            meta.innerHTML = '';
            return;
        }

        meta.hidden = false;
        meta.innerHTML = parts.map((part) => `<span class="warehouse-context-pill">${part}</span>`).join('');
    }

    async function populateItemsFilter() {
        const response = await fetch('/api/items');
        if (!response.ok) return;

        const items = await response.json();
        itemFilter.innerHTML = '<option value="">All items</option>';
        itemsById.clear();

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
    }

    async function populateWarehouseFilter() {
        const response = await fetch('/api/warehouses');
        if (!response.ok) return;

        const warehouses = await response.json();
        warehouseFilter.innerHTML = '<option value="">All warehouses</option>';

        (warehouses || []).forEach((warehouse) => {
            const code = String(warehouse.code || '').trim();
            if (!code) return;
            const option = document.createElement('option');
            option.value = code;
            option.textContent = code;
            warehouseFilter.appendChild(option);
        });
    }

    async function loadForecast() {
        const loadToken = ++activeLoadToken;
        const defaultWindow = defaultWindowByMode[currentPeriod] || 7;
        const inputMax = currentPeriod === 'monthly' ? 24 : 90;
        const windowValue = Math.min(inputMax, Math.max(1, parseInt(windowInput.value || String(defaultWindow), 10) || defaultWindow));
        windowInput.value = String(windowValue);

        const selectedItem = (itemFilter.value || '').trim();
        const selectedWarehouse = (warehouseFilter.value || '').trim();

        tableBody.innerHTML = '<tr><td colspan="9" class="loading">Loading forecast...</td></tr>';

        const baselinePayload = await fetchForecastPayload(buildForecastParams(windowValue, false));
        if (loadToken !== activeLoadToken) return;

        const baseline = normalizeForecastPayload(baselinePayload, windowValue);

        forecastForPill.textContent = baseline.effectivePeriod === 'monthly' ? `Next month (${baseline.forecastFor})` : `Tomorrow (${baseline.forecastFor})`;
        windowPill.textContent = baseline.effectivePeriod === 'monthly' ? `Window ${baseline.effectiveWindow} months` : `Window ${baseline.effectiveWindow} days`;
        setMeta(selectedItem, selectedWarehouse);
        setStats(baseline.filteredRows);
        renderRows(baseline.filteredRows, { aiLoading: true });

        if (!baseline.filteredRows.length) return;

        try {
            const aiPayload = await fetchForecastPayload(buildForecastParams(windowValue, true));
            if (loadToken !== activeLoadToken) return;

            const ai = normalizeForecastPayload(aiPayload, windowValue);
            const aiByKey = new Map(ai.filteredRows.map((row) => [forecastRowKey(row), row]));
            const mergedRows = baseline.filteredRows.map((baselineRow) => {
                const aiRow = aiByKey.get(forecastRowKey(baselineRow));
                if (!aiRow) return baselineRow;

                return {
                    ...baselineRow,
                    ai_forecast_in: aiRow.ai_forecast_in,
                    ai_forecast_out: aiRow.ai_forecast_out,
                };
            });

            renderRows(mergedRows, { aiLoading: false });
        } catch {
            if (loadToken !== activeLoadToken) return;
            renderRows(baseline.filteredRows, { aiLoading: false });
        }
    }

    function attachEvents() {
        modeDailyBtn?.addEventListener('click', () => {
            setModeUI('daily');
            windowInput.value = String(defaultWindowByMode.daily);
            loadForecast().catch((err) => {
                tableBody.innerHTML = `<tr><td colspan="9" class="loading">Error loading forecast: ${err.message}</td></tr>`;
            });
        });

        modeMonthlyBtn?.addEventListener('click', () => {
            setModeUI('monthly');
            windowInput.value = String(defaultWindowByMode.monthly);
            loadForecast().catch((err) => {
                tableBody.innerHTML = `<tr><td colspan="9" class="loading">Error loading forecast: ${err.message}</td></tr>`;
            });
        });

        applyBtn?.addEventListener('click', () => {
            loadForecast().catch((err) => {
                tableBody.innerHTML = `<tr><td colspan="9" class="loading">Error loading forecast: ${err.message}</td></tr>`;
            });
        });

        clearBtn?.addEventListener('click', () => {
            windowInput.value = String(defaultWindowByMode[currentPeriod] || 7);
            itemFilter.value = '';
            warehouseFilter.value = '';
            loadForecast().catch((err) => {
                tableBody.innerHTML = `<tr><td colspan="6" class="loading">Error loading forecast: ${err.message}</td></tr>`;
            });
        });
    }

    async function init() {
        setModeUI('daily');
        attachEvents();
        await Promise.all([populateItemsFilter(), populateWarehouseFilter()]);
        await loadForecast();
    }

    init().catch((err) => {
        tableBody.innerHTML = `<tr><td colspan="6" class="loading">Error loading forecast: ${err.message}</td></tr>`;
    });
})();
