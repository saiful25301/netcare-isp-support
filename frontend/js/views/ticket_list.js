import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';
import { renderPriorityBadge, renderStatusBadge } from '../components/badge.js';

export async function renderTicketListView(container) {
  const role = auth.getRole();
  const isStaff = role === 'ADMIN' || role === 'AGENT';

  container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom: 1.25rem;">
      <div>
        <h2 class="text-xl font-bold">Support Tickets & Complaint Center</h2>
        <p class="text-sm text-muted">Track, assign, and resolve customer network issues with SLA compliance</p>
      </div>
      <button id="btn-create-ticket" class="btn btn-primary">
        <span>➕</span> Open New Ticket
      </button>
    </div>

    <!-- Quick Status Tabs -->
    <div class="flex gap-2" style="margin-bottom: 1rem; overflow-x: auto; padding-bottom: 4px;">
      <button class="btn btn-sm btn-secondary filter-tab" data-status="">All Tickets</button>
      <button class="btn btn-sm btn-outline filter-tab" data-status="NEW">New Complaints</button>
      <button class="btn btn-sm btn-outline filter-tab" data-status="ASSIGNED">Assigned</button>
      <button class="btn btn-sm btn-outline filter-tab" data-status="IN_PROGRESS">In Progress</button>
      <button class="btn btn-sm btn-outline filter-tab" data-priority="CRITICAL">⚠️ Critical Only</button>
      <button class="btn btn-sm btn-outline filter-tab" data-status="RESOLVED">Resolved</button>
    </div>

    <!-- Filter Bar -->
    <div class="card" style="margin-bottom: 1.25rem; padding: 1rem;">
      <div class="grid grid-cols-4 gap-3">
        <div>
          <input type="text" id="ticket-search" class="form-control" placeholder="Search ticket #, title, customer...">
        </div>
        <div>
          <select id="ticket-filter-area" class="form-select">
            <option value="">All Service Areas</option>
          </select>
        </div>
        <div>
          <select id="ticket-filter-category" class="form-select">
            <option value="">All Problem Categories</option>
          </select>
        </div>
        <div>
          <select id="ticket-filter-priority" class="form-select">
            <option value="">All Priorities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Tickets Table Card -->
    <div class="card">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Ticket ID</th>
              <th>Customer</th>
              <th>Category & Problem</th>
              <th>Area</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned Tech</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tickets-table-body">
            <tr><td colspan="9" class="text-center text-muted" style="padding: 2rem;">Loading support tickets...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Fetch Areas and Categories for filter dropdowns
  let areas = [];
  let categories = [];
  try {
    [areas, categories] = await Promise.all([
      api.get('/areas'),
      api.get('/categories')
    ]);

    const areaSelect = document.getElementById('ticket-filter-area');
    areas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      areaSelect.appendChild(opt);
    });

    const catSelect = document.getElementById('ticket-filter-category');
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  } catch (e) {
    console.error('Filter dropdown load error:', e);
  }

  let activeStatusTab = '';
  let activePriorityTab = '';

  async function loadTickets() {
    const search = document.getElementById('ticket-search').value;
    const areaId = document.getElementById('ticket-filter-area').value;
    const categoryId = document.getElementById('ticket-filter-category').value;
    const prioritySelect = document.getElementById('ticket-filter-priority').value;

    let url = '/tickets?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (areaId) url += `service_area_id=${encodeURIComponent(areaId)}&`;
    if (categoryId) url += `category_id=${encodeURIComponent(categoryId)}&`;

    const statusParam = activeStatusTab;
    const priorityParam = activePriorityTab || prioritySelect;
    if (statusParam) url += `status=${encodeURIComponent(statusParam)}&`;
    if (priorityParam) url += `priority=${encodeURIComponent(priorityParam)}&`;

    try {
      const list = await api.get(url);
      const tbody = document.getElementById('tickets-table-body');

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="9" class="empty-state">
              <div class="empty-state-icon">🎫</div>
              <p>No complaints found matching this criteria.</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(t => {
        const isCritical = t.priority === 'CRITICAL';
        const rowBg = isCritical ? 'style="background-color: #FEF2F2;"' : '';

        return `
          <tr ${rowBg}>
            <td>
              <a href="#/ticket/${t.ticket_id}" class="font-bold" style="color: var(--color-primary); font-family: monospace;">
                ${t.ticket_id}
              </a>
            </td>
            <td>
              <div class="font-semibold">${t.customer_name}</div>
              <div class="text-xs text-muted">${t.customer_code} • ${t.customer_phone}</div>
            </td>
            <td>
              <div class="font-semibold text-sm">${t.problem_title}</div>
              <div class="text-xs text-muted">${t.category_name}</div>
            </td>
            <td>
              <span class="text-xs font-semibold">${t.service_area_name}</span>
            </td>
            <td>${renderPriorityBadge(t.priority)}</td>
            <td>${renderStatusBadge(t.status)}</td>
            <td>
              ${t.assigned_technician_name ? `
                <div class="text-sm font-semibold">${t.assigned_technician_name}</div>
                <div class="text-xs text-muted">${t.assigned_technician_code}</div>
              ` : `
                <span class="text-xs text-muted italic">Unassigned</span>
              `}
            </td>
            <td>
              <div class="text-xs text-muted">${new Date(t.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </td>
            <td>
              <a href="#/ticket/${t.ticket_id}" class="btn btn-outline btn-sm">
                Open
              </a>
            </td>
          </tr>
        `;
      }).join('');

    } catch (err) {
      toast.error(err.message);
    }
  }

  // Tab switcher
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.className = 'btn btn-sm btn-outline filter-tab');
      tab.className = 'btn btn-sm btn-secondary filter-tab';

      activeStatusTab = tab.getAttribute('data-status') || '';
      activePriorityTab = tab.getAttribute('data-priority') || '';
      loadTickets();
    };
  });

  // Filter input listeners
  let searchTimer;
  document.getElementById('ticket-search').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTickets, 300);
  };
  document.getElementById('ticket-filter-area').onchange = loadTickets;
  document.getElementById('ticket-filter-category').onchange = loadTickets;
  document.getElementById('ticket-filter-priority').onchange = loadTickets;

  // New Ticket Button
  document.getElementById('btn-create-ticket').onclick = async () => {
    if (isStaff) {
      // Staff creating on behalf of customer: fetch customer list
      let custList = [];
      try {
        custList = await api.get('/customers');
      } catch (e) {
        console.error(e);
      }

      const formHtml = `
        <form id="form-new-ticket">
          <div class="form-group">
            <label class="form-label">Select Customer Account</label>
            <select id="t-cust-id" class="form-select" required>
              <option value="">Choose customer...</option>
              ${custList.map(c => `<option value="${c.id}">${c.customer_code} - ${c.full_name} (${c.service_area_name})</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="form-group">
              <label class="form-label">Complaint Category</label>
              <select id="t-cat-id" class="form-select" required>
                ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Priority Override</label>
              <select id="t-priority" class="form-select">
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="MEDIUM" selected>MEDIUM</option>
                <option value="LOW">LOW</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Problem Summary</label>
            <input type="text" id="t-title" class="form-control" required placeholder="e.g. Fiber link red LOS light on ONU">
          </div>
          <div class="form-group">
            <label class="form-label">Detailed Symptoms & Description</label>
            <textarea id="t-desc" class="form-control" required placeholder="Include customer statement, power readings, etc."></textarea>
          </div>
        </form>
      `;

      modal.open({
        title: '🎫 Create Ticket on Customer Behalf',
        content: formHtml,
        footerButtons: [
          { text: 'Cancel', className: 'btn-outline' },
          {
            text: 'Submit Complaint',
            className: 'btn-primary',
            onClick: async (close) => {
              const payload = {
                customer_id: document.getElementById('t-cust-id').value,
                category_id: parseInt(document.getElementById('t-cat-id').value),
                priority: document.getElementById('t-priority').value,
                problem_title: document.getElementById('t-title').value,
                problem_description: document.getElementById('t-desc').value
              };
              if (!payload.customer_id || !payload.category_id || !payload.problem_title) {
                toast.error('Please fill in all mandatory ticket details.');
                return;
              }
              try {
                await api.post('/tickets/on-behalf', payload);
                toast.success('Support ticket created successfully!');
                close();
                loadTickets();
              } catch (e) {
                toast.error(e.message);
              }
            }
          }
        ]
      });

    } else {
      // Customer self-submission
      const formHtml = `
        <form id="form-new-ticket">
          <div class="form-group">
            <label class="form-label">Complaint Category</label>
            <select id="t-cat-id" class="form-select" required>
              ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Brief Problem Summary</label>
            <input type="text" id="t-title" class="form-control" required placeholder="e.g. WiFi connects but no internet">
          </div>
          <div class="form-group">
            <label class="form-label">What issue are you experiencing?</label>
            <textarea id="t-desc" class="form-control" required placeholder="Explain when it started, lights on router/ONU, etc."></textarea>
          </div>
        </form>
      `;

      modal.open({
        title: '🎫 Submit Internet Complaint',
        content: formHtml,
        footerButtons: [
          { text: 'Cancel', className: 'btn-outline' },
          {
            text: 'Submit Complaint',
            className: 'btn-primary',
            onClick: async (close) => {
              const payload = {
                category_id: parseInt(document.getElementById('t-cat-id').value),
                problem_title: document.getElementById('t-title').value,
                problem_description: document.getElementById('t-desc').value
              };
              if (!payload.category_id || !payload.problem_title || !payload.problem_description) {
                toast.error('Please describe your issue thoroughly.');
                return;
              }
              try {
                await api.post('/tickets', payload);
                toast.success('Complaint registered! A technician will be assigned.');
                close();
                loadTickets();
              } catch (e) {
                toast.error(e.message);
              }
            }
          }
        ]
      });
    }
  };

  loadTickets();
}
