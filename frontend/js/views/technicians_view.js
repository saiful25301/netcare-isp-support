import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';

export async function renderTechniciansView(container) {
  const isAdmin = auth.getRole() === 'ADMIN';

  container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom: 1.25rem;">
      <div>
        <h2 class="text-xl font-bold">Technician Fleet & Dispatch</h2>
        <p class="text-sm text-muted">Monitor technician field availability, workloads, and dispatch assignments</p>
      </div>
      ${isAdmin ? `
        <button id="btn-add-tech" class="btn btn-primary">
          <span>➕</span> Add Technician
        </button>
      ` : ''}
    </div>

    <!-- Live Status Overview Cards -->
    <div class="grid grid-cols-4 gap-3" style="margin-bottom: 1.5rem;" id="tech-metrics-container">
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue">🛠</div>
        <div>
          <div class="stat-value" id="stat-total-tech">...</div>
          <div class="stat-label">Total Field Techs</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-green">🟢</div>
        <div>
          <div class="stat-value" id="stat-avail-tech">...</div>
          <div class="stat-label">Available for Dispatch</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-amber">⚡</div>
        <div>
          <div class="stat-value" id="stat-onjob-tech">...</div>
          <div class="stat-label">Currently On Job</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue">★</div>
        <div>
          <div class="stat-value" id="stat-rating-tech">...</div>
          <div class="stat-label">Fleet Avg Rating</div>
        </div>
      </div>
    </div>

    <!-- Technicians Table -->
    <div class="card">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Employee Code</th>
              <th>Technician Name</th>
              <th>Primary Service Area</th>
              <th>Technical Specialization</th>
              <th>Current Workload</th>
              <th>Rating</th>
              <th>Availability Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="tech-table-body">
            <tr><td colspan="8" class="text-muted" style="text-align: center; padding: 2rem;">Loading technicians...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  let areas = [];
  try {
    areas = await api.get('/areas');
  } catch (err) {
    console.error('Failed to load areas:', err);
  }

  async function loadTechnicians() {
    try {
      const list = await api.get('/technicians');
      const tbody = document.getElementById('tech-table-body');

      // Update counters
      const total = list.length;
      const available = list.filter(t => t.current_status === 'AVAILABLE').length;
      const onJob = list.filter(t => t.current_status === 'ON_JOB').length;
      const avgRating = total > 0 ? (list.reduce((acc, t) => acc + (t.rating_cache || 5), 0) / total).toFixed(1) : '5.0';

      document.getElementById('stat-total-tech').textContent = total;
      document.getElementById('stat-avail-tech').textContent = available;
      document.getElementById('stat-onjob-tech').textContent = onJob;
      document.getElementById('stat-rating-tech').textContent = `${avgRating} ★`;

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr><td colspan="8" class="empty-state">No technicians configured.</td></tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(t => {
        let statusBadge = 'badge-resolved';
        if (t.current_status === 'ON_JOB') statusBadge = 'badge-high';
        if (t.current_status === 'OFF_DUTY') statusBadge = 'badge-low';

        return `
          <tr>
            <td>
              <span class="font-semibold" style="color: var(--color-primary);">${t.employee_code}</span>
            </td>
            <td>
              <div class="font-semibold">${t.full_name}</div>
              <div class="text-xs text-muted">${t.phone_number} • ${t.email}</div>
            </td>
            <td>
              <span class="badge" style="background-color: #F1F5F9; color: #1E293B;">
                ${t.primary_area_name || 'All Areas'}
              </span>
            </td>
            <td>
              <div class="text-xs font-semibold text-muted">${t.specialization}</div>
            </td>
            <td>
              <div class="text-xs">
                <span class="font-semibold" style="color: ${t.active_assigned_tickets > 0 ? 'var(--color-danger)' : 'var(--color-success)'};">
                  ${t.active_assigned_tickets} Active
                </span>
                <span class="text-muted">/ ${t.completed_tickets} Done</span>
              </div>
            </td>
            <td>
              <span class="font-semibold" style="color: var(--color-warning);">${(t.rating_cache || 5.0).toFixed(1)} ★</span>
            </td>
            <td>
              <span class="badge ${statusBadge}">${t.current_status}</span>
            </td>
            <td>
              <div class="flex gap-2">
                <button class="btn btn-outline btn-sm btn-status-tech" data-id="${t.id}" data-status="${t.current_status}">
                  Toggle Status
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Wire quick status toggle
      tbody.querySelectorAll('.btn-status-tech').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          const cur = btn.getAttribute('data-status');
          const nextStatus = cur === 'AVAILABLE' ? 'ON_JOB' : (cur === 'ON_JOB' ? 'OFF_DUTY' : 'AVAILABLE');

          try {
            await api.put(`/technicians/${id}`, { current_status: nextStatus });
            toast.success(`Technician status updated to ${nextStatus}`);
            loadTechnicians();
          } catch (err) {
            toast.error(err.message);
          }
        };
      });

    } catch (err) {
      toast.error(err.message);
    }
  }

  // Add Technician Modal
  if (isAdmin) {
    document.getElementById('btn-add-tech').onclick = () => {
      const formHtml = `
        <form id="modal-tech-form">
          <div class="form-group">
            <label class="form-label">Full Name</label>
            <input type="text" id="m-tech-name" class="form-control" required placeholder="e.g. Shakil Ahmed">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" id="m-tech-email" class="form-control" required placeholder="tech@netcare.com.bd">
            </div>
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="text" id="m-tech-phone" class="form-control" required placeholder="+88017...">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="text" id="m-tech-pass" class="form-control" value="netcare123" required>
          </div>
          <div class="form-group">
            <label class="form-label">Primary Service Area</label>
            <select id="m-tech-area" class="form-select" required>
              <option value="">Select Area...</option>
              ${areas.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Technical Specialization</label>
            <input type="text" id="m-tech-spec" class="form-control" value="Fiber Splicing & Optical Line Test" required>
          </div>
        </form>
      `;

      modal.open({
        title: '➕ Register Field Technician',
        content: formHtml,
        footerButtons: [
          { text: 'Cancel', className: 'btn-outline' },
          {
            text: 'Create Technician',
            className: 'btn-primary',
            onClick: async (close) => {
              const payload = {
                full_name: document.getElementById('m-tech-name').value,
                email: document.getElementById('m-tech-email').value,
                phone_number: document.getElementById('m-tech-phone').value,
                password: document.getElementById('m-tech-pass').value,
                primary_area_id: parseInt(document.getElementById('m-tech-area').value),
                specialization: document.getElementById('m-tech-spec').value
              };

              if (!payload.full_name || !payload.email || !payload.phone_number || !payload.primary_area_id) {
                toast.error('Please fill in all mandatory fields.');
                return;
              }

              try {
                await api.post('/technicians', payload);
                toast.success('Technician registered successfully!');
                close();
                loadTechnicians();
              } catch (err) {
                toast.error(err.message);
              }
            }
          }
        ]
      });
    };
  }

  loadTechnicians();
}
