// Fetch latest 5 events and display them
async function loadRecentEvents() {
    const container = document.getElementById('recent-events');

    try {
        const response = await fetch('/events');
        if (!response.ok) {
            throw new Error('Failed to fetch events');
        }

        const events = await response.json();
        const recent = (events || []).slice(0, 5);

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

    try {
        const response = await fetch('/inventory');
        if (!response.ok) {
            throw new Error('Failed to fetch inventory');
        }

        const stock = await response.json();
        const totalItems = stock.length;
        const belowMin = stock.filter(item => item.minimum_stock && item.current_quantity < item.minimum_stock);

        totalEl.textContent = totalItems;
        belowMinEl.textContent = belowMin.length;
        warehousesEl.textContent = '—'; // not in payload yet
        const lastUpdated = stock.reduce((latest, item) => {
            const ts = item.last_updated ? new Date(item.last_updated) : null;
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
    return `
        <div class="low-row">
            <div>
                <div class="low-title">${item.name || 'Item'}</div>
                <div class="low-meta">SKU: ${item.sku || 'n/a'}</div>
            </div>
            <div class="low-qty">
                <span class="pill danger">${item.current_quantity ?? 0} / ${item.minimum_stock ?? '-'} min</span>
            </div>
        </div>
    `;
}

function renderEventRow(evt) {
    const isInbound = evt.type === 'inbound';
    const directionClass = isInbound ? 'event-in' : 'event-out';
    const sign = isInbound ? '+' : '-';
    const icon = isInbound ? '⬆' : '⬇';
    const warehouse = evt.warehouse_id ? ` • WH ${evt.warehouse_id}` : '';

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

// Smooth scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Load data when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadRecentEvents();
    loadInventoryStats();
});
