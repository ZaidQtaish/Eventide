import { fetchSessionRole } from './shared/sidebar.js';
import { renderBasicDashboard, renderManagerDashboard, renderAdminDashboard } from './dashboards.js';

async function initDashboard() {
    const role = await fetchSessionRole();

    // Show manager metrics section for managers and admins
    const managerDashboard = document.getElementById('manager-dashboard');
    if (managerDashboard && (role === 'admin' || role === 'manager' || role === 'warehouse_manager' || role === 'sales_manager')) {
        managerDashboard.style.display = 'block';
    }

    if (role === 'admin') {
        await renderAdminDashboard();
    } else if (role === 'manager' || role === 'warehouse_manager' || role === 'sales_manager') {
        await renderManagerDashboard();
    } else {
        await renderBasicDashboard();
    }
}

// Load dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);
