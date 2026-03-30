(() => {
    function getActiveSection(pathname) {
        if (pathname.startsWith('/items/')) return 'items';
        if (pathname.startsWith('/inventory/')) return 'inventory';
        if (pathname.startsWith('/events/')) return 'events';
        return 'dashboard';
    }

    function buildSidebar(active) {
        return `
            <aside class="app-sidebar" aria-label="Primary">
                <a href="/" class="sidebar-logo">Eventide</a>
                <nav class="sidebar-nav">
                    <a class="sidebar-link ${active === 'dashboard' ? 'active' : ''}" href="/">Dashboard</a>
                    <a class="sidebar-link ${active === 'items' ? 'active' : ''}" href="/items/">Items</a>
                    <a class="sidebar-link ${active === 'inventory' ? 'active' : ''}" href="/inventory/">Inventory</a>
                    <a class="sidebar-link ${active === 'events' ? 'active' : ''}" href="/events/">Events</a>
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
