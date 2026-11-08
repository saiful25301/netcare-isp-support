import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';
import { renderStatusBadge, renderPriorityBadge } from '../components/badge.js';

export async function renderCustomerPortalView(container) {
  const user = auth.getUser();
  const custProfile = user.customer_profile || {};

  container.innerHTML = `
    <!-- Top Area Outage Alert Container -->
    <div id="customer-outage-alert"></div>

    <!-- Welcome & Subscription Summary Card -->
    <div class="card" style="margin-bottom: 1.5rem; background: linear-gradient(135deg, #1E3A8A, #2563EB); color: white;">
      <div class="card-body">
        <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: 1rem;">
          <div>
            <span class="text-xs" style="text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85;">Customer Account</span>
            <h2 class="text-2xl font-bold">${user.full_name}</h2>
            <div class="text-sm" style="opacity: 0.9;">
              Customer ID: <strong>${custProfile.customer_code || 'NC-CUST'}</strong> • Area: <strong>${custProfile.service_area_name || 'Dhaka'}</strong>
            </div>
          </div>
          <div class="flex gap-2">
            <a href="#/customer/new-complaint" class="btn btn-primary" style="background-color: white; color: var(--color-primary); font-weight: 700;">
              ➕ Report Problem / Submit Complaint
            </a>
          </div>
        </div>

        <div class="customer-stats-grid">
          <div>
            <div class="text-xs" style="opacity: 0.8;">Subscribed Plan</div>
            <div class="text-lg font-bold">${custProfile.package_name || 'Broadband'}</div>
          </div>
          <div>
            <div class="text-xs" style="opacity: 0.8;">Bandwidth Speed</div>
            <div class="text-lg font-bold">${custProfile.speed_mbps || 20} Mbps</div>
          </div>
          <div>
            <div class="text-xs" style="opacity: 0.8;">Line Status</div>
            <div class="text-lg font-bold" style="color: #86EFAC;">● ${custProfile.status || 'ACTIVE'}</div>
          </div>
          <div>
            <div class="text-xs" style="opacity: 0.8;">Installation Address</div>
            <div class="text-xs" style="opacity: 0.95;">${(custProfile.installation_address || 'Dhaka').slice(0, 45)}...</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Tickets & Tracking Section -->
    <div style="margin-bottom: 1.5rem;">
      <div class="flex items-center justify-between" style="margin-bottom: 0.75rem;">
        <h3 class="text-lg font-bold">📡 Active Support Complaints</h3>
        <a href="#/customer/history" class="text-sm font-semibold">View Past History →</a>
      </div>
      <div id="active-tickets-container">
        <div class="card" style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
          Checking ticket status...
        </div>
      </div>
    </div>
  `;

  // 1. Check for Active Outages in customer's area
  try {
    const banners = await api.get('/outages/active/banner');
    const myAreaId = custProfile.service_area_id;
    const relevantOutage = banners.find(b => b.service_area_id === myAreaId);

    if (relevantOutage) {
      document.getElementById('customer-outage-alert').innerHTML = `
        <div class="alert alert-warning" style="box-shadow: var(--shadow-md);">
          <div style="font-size: 1.5rem;">⚠️</div>
          <div style="flex: 1;">
            <div class="font-bold">Notice: Suspected Network Outage in ${relevantOutage.service_area_name} (${relevantOutage.outage_code})</div>
            <p class="text-xs" style="margin-top: 2px;">
              Our automated systems have detected network instability or an upstream fiber cut in your area. Our fiber engineering team has been alerted and is investigating.
            </p>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Outage check error:', err);
  }

  // 2. Load active tickets
  try {
    const tickets = await api.get('/tickets');
    const active = tickets.filter(t => t.status !== 'CLOSED');
    const containerEl = document.getElementById('active-tickets-container');

    if (active.length === 0) {
      containerEl.innerHTML = `
        <div class="card" style="padding: 2.5rem; text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
          <h4 class="font-bold text-md">Your Connection is Healthy!</h4>
          <p class="text-sm text-muted" style="margin-top: 0.25rem;">You have no active unresolved complaints.</p>
          <div style="margin-top: 1rem;">
            <a href="#/customer/new-complaint" class="btn btn-outline btn-sm">Report a Problem</a>
          </div>
        </div>
      `;
      return;
    }

    containerEl.innerHTML = active.map(t => {
      // Stepper calculation
      const stepIndex = {
        NEW: 1,
        ASSIGNED: 2,
        IN_PROGRESS: 3,
        WAITING: 3,
        RESOLVED: 4
      }[t.status] || 1;

      return `
        <div class="card" style="margin-bottom: 1rem;">
          <div class="card-header">
            <div>
              <span class="font-bold" style="color: var(--color-primary); font-family: monospace;">${t.ticket_id}</span>
              <span class="text-sm font-semibold" style="margin-left: 0.5rem;">${t.problem_title}</span>
            </div>
            <div>
              ${renderStatusBadge(t.status)}
            </div>
          </div>
          <div class="card-body">
            <!-- 4-Step Stepper -->
            <div class="stepper-container">
              <div class="stepper-track"></div>
              
              <div class="stepper-step">
                <div class="stepper-circle" style="background-color: ${stepIndex >= 1 ? 'var(--color-primary)' : 'var(--color-border)'};">1</div>
                <div class="stepper-label">Reported</div>
              </div>

              <div class="stepper-step">
                <div class="stepper-circle" style="background-color: ${stepIndex >= 2 ? 'var(--color-primary)' : 'var(--color-border)'};">2</div>
                <div class="stepper-label">Technician Assigned</div>
                <div class="text-xs text-muted text-truncate">${t.assigned_technician_name || ''}</div>
              </div>

              <div class="stepper-step">
                <div class="stepper-circle" style="background-color: ${stepIndex >= 3 ? 'var(--color-primary)' : 'var(--color-border)'};">3</div>
                <div class="stepper-label">Diagnostics & Repair</div>
              </div>

              <div class="stepper-step">
                <div class="stepper-circle" style="background-color: ${stepIndex >= 4 ? 'var(--color-success)' : 'var(--color-border)'};">✓</div>
                <div class="stepper-label">Resolved</div>
              </div>
            </div>
          </div>
          <div class="card-footer flex items-center justify-between">
            <span class="text-xs text-muted">Created: ${new Date(t.created_at).toLocaleString()}</span>
            <a href="#/ticket/${t.ticket_id}" class="btn btn-secondary btn-sm">
              View Ticket Details & Chat →
            </a>
          </div>
        </div>
      `;
    }).join('');

  } catch (e) {
    toast.error(e.message);
  }
}

export async function renderNewComplaintView(container) {
  let categories = [];
  try {
    categories = await api.get('/categories');
  } catch (err) {
    console.error(err);
  }

  container.innerHTML = `
    <div style="max-width: 640px; margin: 0 auto;">
      <div style="margin-bottom: 1.25rem;">
        <a href="#/customer/portal" class="btn btn-outline btn-sm">← Back to Portal</a>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <h2 class="text-xl font-bold">Report an Internet Issue</h2>
            <p class="text-xs text-muted">Select the symptom below and describe what you are seeing.</p>
          </div>
        </div>
        <div class="card-body">
          <form id="form-cust-complaint">
            <div class="form-group">
              <label class="form-label">What kind of problem are you having?</label>
              <div class="grid grid-cols-2 gap-2" id="category-selector-grid">
                ${categories.map((c, idx) => `
                  <div class="card cat-card ${idx === 0 ? 'selected-cat' : ''}" data-id="${c.id}" style="padding: 0.75rem; cursor: pointer; border: 2px solid ${idx === 0 ? 'var(--color-secondary)' : 'var(--color-border)'};">
                    <div class="font-bold text-sm">${c.name}</div>
                    <div class="text-xs text-muted" style="margin-top: 2px;">${c.description.slice(0, 45)}...</div>
                    <div class="text-xs font-semibold" style="color: var(--color-secondary); margin-top: 4px;">SLA: ${c.sla_target_hours}h</div>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="selected-cat-id" value="${categories[0] ? categories[0].id : 1}">
            </div>

            <div class="form-group">
              <label class="form-label">Brief Summary of the Problem</label>
              <input type="text" id="cust-p-title" class="form-control" placeholder="e.g. Red LOS light blinking on router" required>
            </div>

            <div class="form-group">
              <label class="form-label">Please explain what happened:</label>
              <textarea id="cust-p-desc" class="form-control" style="min-height: 100px;" placeholder="When did the connection drop? Have you tried restarting your router/ONU?" required></textarea>
            </div>

            <button type="submit" id="btn-submit-ticket" class="btn btn-primary w-full" style="padding: 0.75rem;">
              Submit Complaint to Support Desk
            </button>
          </form>
        </div>
      </div>
    </div>
  `;

  // Category card selector
  const catCards = document.querySelectorAll('.cat-card');
  const catInput = document.getElementById('selected-cat-id');

  catCards.forEach(card => {
    card.onclick = () => {
      catCards.forEach(c => c.style.borderColor = 'var(--color-border)');
      card.style.borderColor = 'var(--color-secondary)';
      catInput.value = card.getAttribute('data-id');
    };
  });

  // Submit Handler
  document.getElementById('form-cust-complaint').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-ticket');
    btn.disabled = true;
    btn.textContent = 'Registering complaint...';

    const payload = {
      category_id: parseInt(catInput.value),
      problem_title: document.getElementById('cust-p-title').value,
      problem_description: document.getElementById('cust-p-desc').value
    };

    try {
      const res = await api.post('/tickets', payload);
      toast.success(`Complaint registered! Ticket #${res.ticket_id}`);
      window.location.hash = `#/ticket/${res.ticket_id}`;
    } catch (err) {
      toast.error(err.message);
      btn.disabled = false;
      btn.textContent = 'Submit Complaint to Support Desk';
    }
  };
}

export async function renderCustomerHistoryView(container) {
  container.innerHTML = `
    <div style="margin-bottom: 1.25rem;">
      <a href="#/customer/portal" class="btn btn-outline btn-sm">← Back to Portal</a>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="text-xl font-bold">📜 Your Complaint History</h2>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Problem Title</th>
              <th>Category</th>
              <th>Status</th>
              <th>Date Filed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="cust-history-tbody">
            <tr><td colspan="6" class="text-center text-muted" style="padding: 2rem;">Loading history...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  try {
    const list = await api.get('/tickets');
    const tbody = document.getElementById('cust-history-tbody');

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No previous complaints on file.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(t => `
      <tr>
        <td>
          <a href="#/ticket/${t.ticket_id}" class="font-bold" style="color: var(--color-primary); font-family: monospace;">
            ${t.ticket_id}
          </a>
        </td>
        <td>
          <div class="font-semibold">${t.problem_title}</div>
        </td>
        <td>${t.category_name}</td>
        <td>${renderStatusBadge(t.status)}</td>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
        <td>
          <a href="#/ticket/${t.ticket_id}" class="btn btn-outline btn-sm">Open Dossier</a>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    toast.error(err.message);
  }
}
