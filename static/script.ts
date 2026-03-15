// Fetch items from API and display them
async function loadItems() {
    const container = document.getElementById('items-container');
    
    try {
        const response = await fetch('/api/items');
        if (!response.ok) {
            throw new Error('Failed to fetch items');
        }
        
        const items = await response.json();
        
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="loading">No items found</p>';
            return;
        }
        
        container.innerHTML = items.map(item => `
            <div class="item-row">
                <div class="item-info">
                    <div class="item-id">ID: ${item.item_id}</div>
                    <div class="item-sku">SKU: ${item.sku}</div>
                    <div class="item-name">${item.name}</div>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading items:', error);
        container.innerHTML = '<p class="loading">Error loading items. Please try again.</p>';
    }
}

// Smooth scroll to section
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

// Load items when page loads
document.addEventListener('DOMContentLoaded', loadItems);

// Refresh items every 30 seconds for live updates
setInterval(loadItems, 30000);
