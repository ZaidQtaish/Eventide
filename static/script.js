import { fetchSessionRole } from './shared/sidebar.js';

const role = await fetchSessionRole();
if (role === 'admin') {
    renderAdminDashboard();
}

// Fetch latest 5 events and display them
async function fetchWithFallback(primaryPath, fallbackPath) {
    const primary = await fetch(primaryPath);
    if (primary.ok) return primary;
    if (primary.status !== 404 || !fallbackPath) return primary;
    return fetch(fallbackPath);
}

function normalizeInventoryRow(item) {
    return {
        minimumQuantity: item.MinimumQuantity ?? item.minimum_quantity ?? item.minimum_stock ?? 0,
        currentQuantity: item.CurrentQuantity ?? item.current_quantity ?? item.quantity ?? 0,
        warehouseCode: item.WarehouseCode ?? item.warehouse_code ?? item.code,
        warehouseID: item.WarehouseID ?? item.warehouse_id,
        name: item.Name ?? item.name,
        sku: item.SKU ?? item.sku,
        lastUpdated: item.LastUpdated ?? item.last_updated,
    };
}

function normalizeEventRow(evt) {
    return {
        type: evt.type ?? evt.EventType,
        itemName: evt.item_name ?? evt.ItemName,
        username: evt.username ?? evt.Username,
        warehouseCode: evt.warehouse_code ?? evt.WarehouseCode,
        warehouseID: evt.warehouse_id ?? evt.WarehouseID,
        timestamp: evt.timestamp ?? evt.Timestamp,
        quantityChange: evt.quantity_change ?? evt.QuantityChange ?? 0,
    };
}

async function loadRecentEvents() {
    const container = document.getElementById('recent-events');
    if (!container) return;

    try {
        const response = await fetchWithFallback('/api/events', '/events');
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }

        const events = await response.json();
        const recent = (events || []).map(normalizeEventRow).slice(0, 5);

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

// Fetch inventory to compute stats and low-stock list
async function loadInventoryStats() {
    const totalEl = document.getElementById('stat-total-items');
    const belowMinEl = document.getElementById('stat-below-min');
    const warehousesEl = document.getElementById('stat-warehouses');
    const lastUpdateEl = document.getElementById('stat-last-update');
    const lowStockContainer = document.getElementById('low-stock');
    if (!totalEl || !belowMinEl || !warehousesEl || !lastUpdateEl || !lowStockContainer) return;

    try {
        const response = await fetchWithFallback('/api/inventory', '/inventory');
        if (!response.ok) {
            throw new Error('Failed to fetch inventory');
        }

        const rawStock = await response.json();
        const stock = (rawStock || []).map(normalizeInventoryRow);
        const totalItems = stock.length;
        const belowMin = stock.filter(item => item.minimumQuantity && item.currentQuantity < item.minimumQuantity);
        const uniqueWarehouses = new Set(stock.map(item => item.warehouseCode).filter(Boolean));

        totalEl.textContent = totalItems;
        belowMinEl.textContent = belowMin.length;
        warehousesEl.textContent = uniqueWarehouses.size || '--';
        const lastUpdated = stock.reduce((latest, item) => {
            const ts = item.lastUpdated ? new Date(item.lastUpdated) : null;
            if (!ts) return latest;
            return !latest || ts > latest ? ts : latest;
        }, null);
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

function renderLowStockRow(item) {
    const warehouseLabel = item.warehouseCode || (item.warehouseID ? `WH ${item.warehouseID}` : '');

    return `
        <div class="low-row">
            <div>
                <div class="low-title">${item.name || 'Item'}</div>
                <div class="low-meta">SKU: ${item.sku || 'n/a'}${warehouseLabel ? ` • ${warehouseLabel}` : ''}</div>
            </div>
            <div class="low-qty">
                <span class="pill danger">${item.currentQuantity ?? 0} / ${item.minimumQuantity ?? '-'} min</span>
            </div>
        </div>
    `;
}

function renderEventRow(evt) {
    const isInbound = evt.type === 'inbound';
    const directionClass = isInbound ? 'event-in' : 'event-out';
    const sign = isInbound ? '+' : '-';
    const icon = isInbound ? '⬆' : '⬇';
    const warehouseLabel = evt.warehouseCode || (evt.warehouseID ? `WH ${evt.warehouseID}` : '');
    const warehouse = warehouseLabel ? ` • ${warehouseLabel}` : '';

    return `
        <div class="event-row ${directionClass}">
            <div class="event-icon">${icon}</div>
            <div class="event-details">
                <div class="event-title">${evt.itemName || 'Item'} ${warehouse}</div>
                <div class="event-meta">${evt.username || 'user'} • ${new Date(evt.timestamp).toLocaleString()}</div>
            </div>
            <div class="event-qty">${sign}${Math.abs(evt.quantityChange)}</div>
        </div>
    `;
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadRecentEvents();
    loadInventoryStats();
});
