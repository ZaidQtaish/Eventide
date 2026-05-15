function getActiveSection(pathname) {
    if (pathname.startsWith('/app/users/')) return 'users';
    if (pathname.startsWith('/app/items/')) return 'items';
    if (pathname.startsWith('/app/inventory/')) return 'inventory';
    if (pathname.startsWith('/app/warehouses/')) return 'warehouses';
    if (pathname.startsWith('/app/forecast/')) return 'forecast';
    if (pathname.startsWith('/app/history/')) return 'history';
    if (pathname.startsWith('/app/events/')) return 'events';
    return 'dashboard';
}

function buildSidebar(active, role) {
    const isAdmin = String(role || '').toLowerCase() === 'admin';
    const adminSection = isAdmin
        ? `
                <div class="sidebar-separator" role="separator" aria-label="Admin section">Admin</div>
                <a class="sidebar-link ${active === 'items' ? 'active' : ''}" href="/app/items/">Items</a>
                <a class="sidebar-link ${active === 'users' ? 'active' : ''}" href="/app/users/">Users</a>
            `
        : '';

    return `
        <aside class="app-sidebar" aria-label="Primary">
            <a href="/app/" class="sidebar-logo">Eventide</a>
            <nav class="sidebar-nav">
                <a class="sidebar-link ${active === 'dashboard' ? 'active' : ''}" href="/app/">Dashboard</a>
                <a class="sidebar-link ${active === 'inventory' ? 'active' : ''}" href="/app/inventory/">Inventory</a>
                <a class="sidebar-link ${active === 'history' ? 'active' : ''}" href="/app/history/">History</a>
                <a class="sidebar-link ${active === 'forecast' ? 'active' : ''}" href="/app/forecast/">Forecast</a>
                <a class="sidebar-link ${active === 'warehouses' ? 'active' : ''}" href="/app/warehouses/">Warehouses</a>
                <a class="sidebar-link ${active === 'events' ? 'active' : ''}" href="/app/events/">Events</a>
                ${adminSection}
            </nav>
            <div class="sidebar-footer">
                <a class="sidebar-link sidebar-link-logout" href="/logout">Logout</a>
            </div>
        </aside>
    `;
}

export const fetchSessionRole = async function() {
    try {
        const res = await fetch('/api/session');
        if (!res.ok) return '';
        const payload = await res.json();
        return String(payload.role || '');
    } catch (_) {
        return '';
    }
}

async function initSidebar() {
    const root = document.getElementById('sidebar-root');
    if (!root) return;

    const active = getActiveSection(window.location.pathname || '/');
    const role = await fetchSessionRole();
    root.innerHTML = buildSidebar(active, role);
    document.body.classList.add('has-sidebar');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSidebar);
} else {
    initSidebar();
}
