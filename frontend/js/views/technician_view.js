import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';
import { renderStatusBadge, renderPriorityBadge } from '../components/badge.js';

export async function renderTechnicianJobsView(container) {
  const user = auth.getUser();
  const techProfile = user.technician_profile || {};

  container.innerHTML = `
    <!-- Header with Availability Switch -->
    <div class="card" style="margin-bottom: 1.5rem; background-color: var(--color-surface);">
      <div class="card-body flex items-center justify-between" style="flex-wrap: wrap; gap: 1rem;">
        <div>
          <span class="text-xs text-muted" style="text-transform: uppercase; letter-spacing: 0.05em;">Field Operations Console</span>
          <h2 class="text-2xl font-bold">${user.full_name}</h2>
          <div class="text-sm text-muted">
            Code: <strong>${techProfile.employee_code || 'NC-TECH'}</strong> • Zone: <strong>${techProfile.primary_area_name || 'All'}</strong> • Rating: <strong>${techProfile.rating_cache || 5.0} ★</strong>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold">Duty Status:</span>
          <select id="tech-duty-select" class="form-select" style="width: auto; font-weight: 700;">
            <option value="AVAILABLE" ${techProfile.current_status === 'AVAILABLE' ? 'selected' : ''}>🟢 AVAILABLE</option>
            <option value="ON_JOB" ${techProfile.current_status === 'ON_JOB' ? 'selected' : ''}>⚡ ON JOB</option>
            <option value="OFF_DUTY" ${techProfile.current_status === 'OFF_DUTY' ? 'selected' : ''}>⚪ OFF DUTY</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Active Assigned Field Tasks -->
    <div style="margin-bottom: 1rem;">
      <h3 class="text-lg font-bold">📋 My Dispatched Work Orders</h3>
      <p class="text-sm text-muted">Field maintenance, fiber splicing, and on-premise customer repairs</p>
    </div>

    <div id="tech-jobs-container">
      <div class="card" style="padding: 2rem; text-align: center; color: var(--color-text-muted);">
        Loading assigned jobs...
      </div>
    </div>
  `;

  // Status selector change listener
  document.getElementById('tech-duty-select').onchange = async (e) => {
    const val = e.target.value;
    try {
      await api.put(`/technicians/${techProfile.id}`, { current_status: val });
      toast.success(`Duty status updated to ${val}`);
      await auth.fetchProfile();
    } catch (err) {
      toast.error(err.message);
    }
  };

  async function loadJobs() {
    try {
      const tickets = await api.get('/tickets');
      const containerEl = document.getElementById('tech-jobs-container');

      if (tickets.length === 0) {
        containerEl.innerHTML = `
          <div class="card" style="padding: 3rem; text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
            <h4 class="font-bold text-md">All Clear! No Pending Dispatches.</h4>
            <p class="text-sm text-muted">You have no active maintenance jobs assigned at this time.</p>
          </div>
        `;
        return;
      }

      containerEl.innerHTML = tickets.map(t => {
        const isAssigned = t.status === 'ASSIGNED';
        const isInProgress = t.status === 'IN_PROGRESS';
        const isResolved = t.status === 'RESOLVED' || t.status === 'CLOSED';

        return `
          <div class="card" style="margin-bottom: 1.25rem; border-left: 5px solid ${isResolved ? 'var(--color-success)' : (t.priority === 'CRITICAL' ? 'var(--color-danger)' : 'var(--color-secondary)')};">
            <div class="card-header flex items-center justify-between">
              <div>
                <a href="#/ticket/${t.ticket_id}" class="font-bold text-md" style="color: var(--color-primary); font-family: monospace;">
                  ${t.ticket_id}
                </a>
                <span style="margin-left: 0.5rem;">${renderPriorityBadge(t.priority)}</span>
                <span style="margin-left: 0.25rem;">${renderStatusBadge(t.status)}</span>
              </div>
              <div class="text-xs text-muted">
                Category: <strong>${t.category_name}</strong>
              </div>
            </div>

            <div class="card-body">
              <h4 class="font-bold text-md" style="margin-bottom: 0.5rem;">${t.problem_title}</h4>

              <div class="grid grid-cols-2 gap-3" style="margin: 0.75rem 0; padding: 0.75rem; background-color: #F8FAFC; border-radius: 8px;">
                <div>
                  <div class="text-xs text-muted">Customer Name</div>
                  <div class="font-semibold text-sm">${t.customer_name} (${t.customer_code})</div>
                  <div class="text-xs text-muted" style="margin-top: 2px;">
                    📞 <a href="tel:${t.customer_phone}">${t.customer_phone}</a>
                  </div>
                </div>
                <div>
                  <div class="text-xs text-muted">Service Area</div>
                  <div class="font-semibold text-sm">${t.service_area_name}</div>
                  <div class="text-xs text-muted" style="margin-top: 2px;">
                    Created: ${new Date(t.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>

              <!-- Actions on ticket -->
              <div class="flex items-center justify-between flex-wrap gap-2" style="margin-top: 1rem; border-top: 1px solid var(--color-border); padding-top: 0.75rem;">
                <a href="#/ticket/${t.ticket_id}" class="btn btn-outline btn-sm">
                  Open Dossier & Chat
                </a>

                <div class="flex flex-wrap gap-2">
                  ${isAssigned ? `
                    <button class="btn btn-primary btn-sm btn-start-job" data-code="${t.ticket_id}">
                      ⚡ Start Diagnostics
                    </button>
                  ` : ''}

                  ${(isAssigned || isInProgress) ? `
                    <button class="btn btn-success btn-sm btn-resolve-job" data-code="${t.ticket_id}">
                      ✓ Mark Resolved
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Wire quick actions
      containerEl.querySelectorAll('.btn-start-job').forEach(btn => {
        btn.onclick = async () => {
          const code = btn.getAttribute('data-code');
          try {
            await api.post(`/tickets/${code}/status`, {
              new_status: 'IN_PROGRESS',
              reason: 'Technician reached customer premises and commenced diagnosis.'
            });
            toast.success('Job marked In Progress!');
            loadJobs();
          } catch (e) {
            toast.error(e.message);
          }
        };
      });

      containerEl.querySelectorAll('.btn-resolve-job').forEach(btn => {
        btn.onclick = () => {
          const code = btn.getAttribute('data-code');
          const content = `
            <div class="form-group">
              <label class="form-label">Work Resolution Summary *</label>
              <textarea id="quick-res-notes" class="form-control" style="min-height: 90px;" placeholder="Document repairs executed (e.g. Cleared optical connector, fixed attenuation, configured PPPoE)..." required></textarea>
            </div>
          `;

          modal.open({
            title: `✓ Resolve Job – ${code}`,
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Confirm Resolved',
                className: 'btn-success',
                onClick: async (close) => {
                  const notes = document.getElementById('quick-res-notes').value;
                  if (!notes.trim()) {
                    toast.error('Resolution notes are mandatory.');
                    return;
                  }
                  try {
                    await api.post(`/tickets/${code}/status`, {
                      new_status: 'RESOLVED',
                      resolution_notes: notes
                    });
                    toast.success('Job resolved! Customer notified.');
                    close();
                    loadJobs();
                  } catch (e) {
                    toast.error(e.message);
                  }
                }
              }
            ]
          });
        };
      });

    } catch (err) {
      toast.error(err.message);
    }
  }

  loadJobs();
}
