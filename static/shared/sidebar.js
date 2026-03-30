(() => {
    function getActiveSection(pathname) {
        if (pathname.startsWith('/app/items/')) return 'items';
        if (pathname.startsWith('/app/inventory/')) return 'inventory';
        if (pathname.startsWith('/app/events/')) return 'events';
        return 'dashboard';
    }

    function buildSidebar(active) {
        return `
            <aside class="app-sidebar" aria-label="Primary">
                <a href="/app/" class="sidebar-logo">Eventide</a>
                <nav class="sidebar-nav">
                    <a class="sidebar-link ${active === 'dashboard' ? 'active' : ''}" href="/app/">Dashboard</a>
                    <a class="sidebar-link ${active === 'inventory' ? 'active' : ''}" href="/app/inventory/">Inventory</a>
                    <a class="sidebar-link ${active === 'items' ? 'active' : ''}" href="/app/items/">Items</a>
                    <a class="sidebar-link ${active === 'events' ? 'active' : ''}" href="/app/events/">Events</a>
                </nav>
                <div class="sidebar-footer">
                    <a class="sidebar-link sidebar-link-logout" href="/logout">Logout</a>
                </div>
            </aside>
        `;
    }

    function initSidebar() {
        const root = document.getElementById('sidebar-root');
        if (!root) return;

        const active = getActiveSection(window.location.pathname || '/');
        root.innerHTML = buildSidebar(active);
        document.body.classList.add('has-sidebar');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
