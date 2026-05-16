// BASIC DASHBOARD - All roles
export async function renderBasicDashboard() {
    // Load data
    await loadInventoryStats();
    await loadRecentEvents();
}

// MANAGER DASHBOARD - warehouse_manager, sales_manager, manager, + admin
export async function renderManagerDashboard() {
    // Load data
    await loadInventoryStats();
    await loadRecentEvents();
    await loadMostActive();
    await loadDeadStock();
    await loadDemandSpikes();
}

// ADMIN DASHBOARD - admin only
export async function renderAdminDashboard() {
    // Load data
    await loadInventoryStats();
    await loadRecentEvents();
    await loadMostActive();
    await loadDeadStock();
    await loadDemandSpikes();
}

// DATA LOADING FUNCTIONS
async function loadInventoryStats() {
    const totalEl = document.getElementById('stat-total-items');
    const belowMinEl = document.getElementById('stat-below-min');
    const warehousesEl = document.getElementById('stat-warehouses');
    const lastUpdateEl = document.getElementById('stat-last-update');
    const lowStockContainer = document.getElementById('low-stock');
    
    // Only run if elements exist
    if (!totalEl || !belowMinEl || !warehousesEl || !lastUpdateEl || !lowStockContainer) return;

    try {
        const response = await fetch('/api/inventory');
        if (!response.ok) throw new Error('Failed to fetch inventory');

        const stock = await response.json() || [];
        const totalItems = stock.length;
        const belowMin = stock.filter(item => item.MinimumQuantity && item.CurrentQuantity < item.MinimumQuantity);
        const uniqueWarehouses = new Set(stock.map(item => item.WarehouseCode));

        totalEl.textContent = totalItems;
        belowMinEl.textContent = belowMin.length;
        warehousesEl.textContent = uniqueWarehouses.size || '--';
        const lastUpdated = new Date(Math.max(...stock.map(item => new Date(item.LastUpdated).getTime())));
        lastUpdateEl.textContent = lastUpdated ? lastUpdated.toLocaleString() : '—';

        if (!belowMin.length) {
            lowStockContainer.innerHTML = '<p class="loading">All items above minimum</p>';
            return;
        }

        lowStockContainer.innerHTML = belowMin.slice(0, 5).map(renderLowStockRow).join('');
    } catch (error) {
        console.error('Error loading inventory stats:', error);
        totalEl.textContent = '--';
        belowMinEl.textContent = '--';
        warehousesEl.textContent = '--';
        lastUpdateEl.textContent = '--';
        lowStockContainer.innerHTML = '<p class="loading">Error loading inventory.</p>';
    }
}

async function loadRecentEvents() {
    const container = document.getElementById('recent-events');
    if (!container) return;

    try {
        const response = await fetch('/api/events');
        if (!response.ok) throw new Error('Failed to fetch events');

        const events = await response.json() || [];
        const recent = events.slice(0, 5);

        if (!recent.length) {
            container.innerHTML = '<p class="loading">No recent changes</p>';
            return;
        }

        container.innerHTML = recent.map(renderEventRow).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        container.innerHTML = '<p class="loading">Error loading events. Please try again.</p>';
    }
}

async function loadMostActive() {
    const container = document.getElementById('most-active');
    if (!container) return;

    try {
        const response = await fetch('/api/most-active');
        if (!response.ok) throw new Error('Failed to fetch most active items');

        const items = await response.json();
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="loading">No data available</p>';
            return;
        }

        container.innerHTML = items.slice(0, 5).map(renderMostActiveRow).join('');
    } catch (error) {
        console.error('Error loading most active:', error);
        container.innerHTML = '<p class="loading">Error loading data.</p>';
    }
}

async function loadDeadStock() {
    const container = document.getElementById('dead-stock');
    if (!container) return;

    try {
        const response = await fetch('/api/dead-stock');
        if (!response.ok) throw new Error('Failed to fetch dead stock');

        const items = await response.json();
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="loading">No dead stock items</p>';
            return;
        }

        container.innerHTML = items.slice(0, 5).map(renderDeadStockRow).join('');
    } catch (error) {
        console.error('Error loading dead stock:', error);
        container.innerHTML = '<p class="loading">Error loading data.</p>';
    }
}

async function loadDemandSpikes() {
    const container = document.getElementById('demand-spikes');
    if (!container) return;

    try {
        const response = await fetch('/api/demand-spikes');
        if (!response.ok) throw new Error('Failed to fetch demand spikes');

        const items = await response.json();
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="loading">No demand spikes detected</p>';
            return;
        }

        container.innerHTML = items.slice(0, 5).map(renderDemandSpikeRow).join('');
    } catch (error) {
        console.error('Error loading demand spikes:', error);
        container.innerHTML = '<p class="loading">Error loading data.</p>';
    }
}

// RENDER FUNCTIONS
function renderLowStockRow(item) {
    const warehouseLabel = item.WarehouseCode || (item.WarehouseID ? `WH ${item.WarehouseID}` : '');

    return `
        <div class="low-row">
            <div>
                <div class="low-title">${item.Name || 'Item'}</div>
                <div class="low-meta">SKU: ${item.SKU || 'n/a'}${warehouseLabel ? ` • ${warehouseLabel}` : ''}</div>
            </div>
            <div class="low-qty">
                <span class="pill danger">${item.CurrentQuantity ?? 0} / ${item.MinimumQuantity ?? '-'} min</span>
            </div>
        </div>
    `;
}

function renderEventRow(evt) {
    const isInbound = evt.type === 'inbound';
    const directionClass = isInbound ? 'event-in' : 'event-out';
    const sign = isInbound ? '+' : '-';
    const icon = isInbound ? '⬆' : '⬇';
    const warehouseLabel = evt.warehouse_code || (evt.warehouse_id ? `WH ${evt.warehouse_id}` : '');
    const warehouse = warehouseLabel ? ` • ${warehouseLabel}` : '';

    return `
        <div class="event-row ${directionClass}">
            <div class="event-icon">${icon}</div>
            <div class="event-details">
                <div class="event-title">${evt.item_name || 'Item'} ${warehouse}</div>
                <div class="event-meta">${evt.username || 'user'} • ${new Date(evt.timestamp).toLocaleString()}</div>
            </div>
            <div class="event-qty">${sign}${Math.abs(evt.quantity_change)}</div>
        </div>
    `;
}

function renderMostActiveRow(item) {
    return `
        <div class="item-row">
            <div>
                <div class="item-title">${item.Name || 'Item'}</div>
                <div class="item-meta">SKU: ${item.SKU || 'n/a'}</div>
            </div>
            <div class="item-stat">
                <span class="pill">${item.EventCount || 0} events</span>
            </div>
        </div>
    `;
}

function renderDeadStockRow(item) {
    return `
        <div class="item-row">
            <div>
                <div class="item-title">${item.Name || 'Item'}</div>
                <div class="item-meta">SKU: ${item.SKU || 'n/a'} • No activity for ${item.DaysInactive || 'unknown'} days</div>
            </div>
            <div class="item-stat">
                <span class="pill warning">${item.CurrentQuantity || 0} units</span>
            </div>
        </div>
    `;
}

function renderDemandSpikeRow(item) {
    return `
        <div class="item-row">
            <div>
                <div class="item-title">${item.Name || 'Item'}</div>
                <div class="item-meta">SKU: ${item.SKU || 'n/a'}</div>
            </div>
            <div class="item-stat">
                <span class="pill alert">${item.RecentActivity || 0} units (7 days)</span>
            </div>
        </div>
    `;
}
