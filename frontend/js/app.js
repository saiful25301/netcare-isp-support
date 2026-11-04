import { auth } from './services/auth.js';
import { renderNavbar } from './components/navbar.js';
import { renderSidebar } from './components/sidebar.js';
import { renderLoginView, redirectUserAfterAuth } from './views/login.js';
import { renderCustomersView } from './views/customers_view.js';
import { renderTechniciansView } from './views/technicians_view.js';
import { renderAreasPackagesView } from './views/areas_packages_view.js';

class AppRouter {
  constructor() {
    this.contentContainer = document.getElementById('app-content');
    this.sidebar = document.getElementById('sidebar');
    this.navbar = document.getElementById('navbar');
  }

  init() {
    // Mobile toggle
    const toggleBtn = document.getElementById('sidebar-toggle');
    if (toggleBtn) {
      toggleBtn.onclick = () => {
        this.sidebar.classList.toggle('open');
      };
    }

    // Sidebar sign out button
    const sidebarLogout = document.getElementById('btn-sidebar-logout');
    if (sidebarLogout) {
      sidebarLogout.onclick = () => auth.logout();
    }

    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  async handleRoute() {
    const hash = window.location.hash || '';
    const isAuthed = auth.isAuthenticated();

    if (!isAuthed && hash !== '#/login') {
      window.location.hash = '#/login';
      return;
    }

    if (hash === '#/login') {
      if (isAuthed) {
        redirectUserAfterAuth();
        return;
      }
      renderLoginView(this.contentContainer);
      return;
    }

    // Authenticated state: ensure layout components are visible
    if (this.sidebar) this.sidebar.style.display = 'flex';
    if (this.navbar) this.navbar.style.display = 'flex';
    this.sidebar.classList.remove('open');

    // Default route if empty
    if (!hash || hash === '#/') {
      redirectUserAfterAuth();
      return;
    }

    // Routing table
    if (hash.startsWith('#/customers')) {
      renderNavbar('Customer Management');
      renderSidebar(hash);
      renderCustomersView(this.contentContainer);
    } else if (hash.startsWith('#/technicians')) {
      renderNavbar('Technician Fleet');
      renderSidebar(hash);
      renderTechniciansView(this.contentContainer);
    } else if (hash.startsWith('#/areas-packages')) {
      renderNavbar('ISP Master Configuration');
      renderSidebar(hash);
      renderAreasPackagesView(this.contentContainer);
    } else if (hash.startsWith('#/tickets')) {
      // Dynamic import or placeholder for Phase 3
      renderNavbar('Support Ticket Center');
      renderSidebar(hash);
      const { renderTicketListView } = await import('./views/ticket_list.js');
      renderTicketListView(this.contentContainer);
    } else if (hash.startsWith('#/ticket/')) {
      const ticketId = hash.replace('#/ticket/', '');
      renderNavbar(`Ticket #${ticketId}`);
      renderSidebar(hash);
      const { renderTicketDetailView } = await import('./views/ticket_detail.js');
      renderTicketDetailView(this.contentContainer, ticketId);
    } else if (hash.startsWith('#/customer/portal')) {
      renderNavbar('Customer Self-Service Portal');
      renderSidebar(hash);
      const { renderCustomerPortalView } = await import('./views/customer_portal.js');
      renderCustomerPortalView(this.contentContainer);
    } else if (hash.startsWith('#/customer/new-complaint')) {
      renderNavbar('Submit Internet Complaint');
      renderSidebar(hash);
      const { renderNewComplaintView } = await import('./views/customer_portal.js');
      renderNewComplaintView(this.contentContainer);
    } else if (hash.startsWith('#/customer/history')) {
      renderNavbar('My Complaint History');
      renderSidebar(hash);
      const { renderCustomerHistoryView } = await import('./views/customer_portal.js');
      renderCustomerHistoryView(this.contentContainer);
    } else if (hash.startsWith('#/technician/jobs')) {
      renderNavbar('My Assigned Field Jobs');
      renderSidebar(hash);
      const { renderTechnicianJobsView } = await import('./views/technician_view.js');
      renderTechnicianJobsView(this.contentContainer);
    } else if (hash.startsWith('#/outages')) {
      renderNavbar('Network Outage Detection');
      renderSidebar(hash);
      const { renderOutagesView } = await import('./views/outages_view.js');
      renderOutagesView(this.contentContainer);
    } else if (hash.startsWith('#/admin/analytics')) {
      renderNavbar('Executive Operations Analytics');
      renderSidebar(hash);
      const { renderAdminAnalyticsView } = await import('./views/admin_dashboard.js');
      renderAdminAnalyticsView(this.contentContainer);
    } else {
      redirectUserAfterAuth();
    }
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const router = new AppRouter();
  router.init();
});
