import { auth } from '../services/auth.js';
import { USER_ROLES } from '../config.js';

export function renderSidebar(currentHash = '') {
  const container = document.getElementById('sidebar-links');
  if (!container) return;

  const role = auth.getRole();
  if (!role) {
    container.innerHTML = '';
    return;
  }

  let navItems = [];

  if (role === USER_ROLES.ADMIN) {
    navItems = [
      { header: 'Operations' },
      { label: 'Executive Analytics', icon: '📊', hash: '#/admin/analytics' },
      { label: 'Support Tickets', icon: '🎫', hash: '#/tickets' },
      { label: 'Network Outages', icon: '🚨', hash: '#/outages' },
      { header: 'ISP Management' },
      { label: 'Customer Base', icon: '👥', hash: '#/customers' },
      { label: 'Technician Fleet', icon: '🛠', hash: '#/technicians' },
      { label: 'Areas & Packages', icon: '📍', hash: '#/areas-packages' },
    ];
  } else if (role === USER_ROLES.AGENT) {
    navItems = [
      { header: 'Support Desk' },
      { label: 'Active Ticket Queue', icon: '🎫', hash: '#/tickets' },
      { label: 'Customer Lookup', icon: '👥', hash: '#/customers' },
      { label: 'Technician Status', icon: '🛠', hash: '#/technicians' },
      { label: 'Network Outage Alerts', icon: '🚨', hash: '#/outages' },
    ];
  } else if (role === USER_ROLES.TECHNICIAN) {
    navItems = [
      { header: 'Field Operations' },
      { label: 'My Assigned Jobs', icon: '📋', hash: '#/technician/jobs' },
      { label: 'Ticket Directory', icon: '🎫', hash: '#/tickets' },
    ];
  } else if (role === USER_ROLES.CUSTOMER) {
    navItems = [
      { header: 'Customer Portal' },
      { label: 'Overview & Status', icon: '🏠', hash: '#/customer/portal' },
      { label: 'Submit Complaint', icon: '➕', hash: '#/customer/new-complaint' },
      { label: 'Complaint History', icon: '📜', hash: '#/customer/history' },
    ];
  }

  let html = '';
  navItems.forEach(item => {
    if (item.header) {
      html += `<div class="nav-header">${item.header}</div>`;
    } else {
      const isActive = currentHash.startsWith(item.hash) ? 'active' : '';
      html += `
        <a href="${item.hash}" class="nav-link ${isActive}">
          <span class="nav-link-icon">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `;
    }
  });

  container.innerHTML = html;
}
