// Fetch items from API and display them
async function loadItems() {
    const container = document.getElementById('items-container');
    
    try {
        const response = await fetch('/inventory');
        if (!response.ok) {
            throw new Error('Failed to fetch items');
        }
        
        const stock = await response.json();
        
        if (!stock || stock.length === 0) {
            container.innerHTML = '<p class="loading">No items found</p>';
            return;
        }
        
        container.innerHTML = stock.map(item => {
            return `
            <div class="item-row">
                <div class="item-info">
                    <div class="item-id">ID: ${item.ItemID}</div>
                    <div class="item-id">Item: ${item.Name}</div>
                    <div class="item-sku">Quantity: ${item.CurrentQuantity}</div>
                    <div class="item-name">Last Updated: ${new Date(item.LastUpdated).toLocaleString()}</div>
                </div>
            </div>
        `;
        }).join('');
    } catch (error) {
        console.error('Error loading items:', error);
        container.innerHTML = '<p class="loading">Error loading items. Please try again.</p>';
    }
}

// Subscribe to event sources for inventory updates
function subscribeToInventoryUpdates() {
    try {
        const eventSource = new EventSource('/events/inventory');
        
        eventSource.onmessage = function(event) {
            console.log('Inventory update received:', event.data);
            loadItems();
        };
        
        eventSource.onerror = function(error) {
            console.error('Event source error:', error);
            eventSource.close();
        };
    } catch (error) {
        console.log('Event sources not available, using polling fallback');
    }
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
    loadItems();
    subscribeToInventoryUpdates();
});
