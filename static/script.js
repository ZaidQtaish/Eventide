import { fetchSessionRole } from './shared/sidebar.js';
import { renderBasicDashboard, renderManagerDashboard, renderAdminDashboard } from './dashboards.js';

async function initDashboard() {
    const role = await fetchSessionRole();

    if (role === 'admin') {
        await renderAdminDashboard();
    } else if (role === 'manager') {
        await renderManagerDashboard();
    } else {
        await renderBasicDashboard();
    }
}

// Load dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);
