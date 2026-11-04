import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';

export async function renderOutagesView(container) {
  const isAdmin = auth.getRole() === 'ADMIN' || auth.getRole() === 'AGENT';

  container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom: 1.25rem;">
      <div>
        <h2 class="text-xl font-bold">Network Outage Correlation Monitor</h2>
        <p class="text-sm text-muted">Automated cluster detection flags area-wide fiber breaks and switch failures</p>
      </div>
    </div>

    <!-- Alert Explanation Box -->
    <div class="alert alert-info" style="margin-bottom: 1.5rem;">
      <div style="font-size: 1.25rem;">ℹ️</div>
      <div class="text-xs" style="line-height: 1.5;">
        <strong>How it works:</strong> The NetCare correlation engine monitors real-time complaint density. If ≥ 3 connection failure tickets are filed in the same service area within 30 minutes, an outage incident is automatically flagged as <strong>SUSPECTED</strong> for operational verification before dispatching field splicing crews.
      </div>
    </div>

    <!-- Outage Incidents Table -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <div class="font-bold">🚨 Incident Reports</div>
        <div class="flex gap-2">
          <select id="outage-status-filter" class="form-select" style="width: auto; padding: 0.25rem 0.65rem;">
            <option value="">All Statuses</option>
            <option value="SUSPECTED">SUSPECTED</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="INVESTIGATING">INVESTIGATING</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Incident Code</th>
              <th>Service Area</th>
              <th>Correlated Complaints</th>
              <th>Suspected Diagnosis</th>
              <th>Status</th>
              <th>Detected At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="outages-tbody">
            <tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">Loading outage reports...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  async function loadOutages() {
    const filter = document.getElementById('outage-status-filter').value;
    let url = '/outages';
    if (filter) url += `?status=${filter}`;

    try {
      const list = await api.get(url);
      const tbody = document.getElementById('outages-tbody');

      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="empty-state">
              <div class="empty-state-icon">🟢</div>
              <p>No area network outages active or recorded.</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(o => {
        let statusBadge = 'badge-medium';
        if (o.status === 'CONFIRMED') statusBadge = 'badge-critical';
        if (o.status === 'INVESTIGATING') statusBadge = 'badge-assigned';
        if (o.status === 'RESOLVED') statusBadge = 'badge-resolved';

        return `
          <tr>
            <td>
              <span class="font-bold" style="color: var(--color-danger); font-family: monospace;">${o.outage_code}</span>
            </td>
            <td>
              <div class="font-semibold">${o.service_area_name}</div>
              <span class="badge" style="background-color: #F1F5F9; color: #475569;">${o.service_area_code || 'AREA'}</span>
            </td>
            <td>
              <span class="badge badge-critical" style="font-size: 0.8rem;">
                ${o.correlated_ticket_count} Clustered Tickets
              </span>
            </td>
            <td>
              <div class="text-sm font-semibold">${o.suspected_cause || 'Network anomaly detected'}</div>
              ${o.verified_by_name ? `<div class="text-xs text-muted">Verified by: ${o.verified_by_name}</div>` : ''}
            </td>
            <td>
              <span class="badge ${statusBadge}">${o.status}</span>
            </td>
            <td>
              <div class="text-xs text-muted">${new Date(o.detected_at).toLocaleString()}</div>
            </td>
            <td>
              ${isAdmin ? `
                <button class="btn btn-outline btn-sm btn-manage-outage" data-id="${o.id}">
                  Manage Incident
                </button>
              ` : `
                <span class="text-xs text-muted">Read Only</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      // Wire Manage button
      tbody.querySelectorAll('.btn-manage-outage').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const incident = list.find(x => x.id === id);
          if (!incident) return;

          const content = `
            <form id="form-manage-outage">
              <div class="form-group">
                <label class="form-label">Incident Status</label>
                <select id="mo-status" class="form-select">
                  <option value="SUSPECTED" ${incident.status === 'SUSPECTED' ? 'selected' : ''}>SUSPECTED (Requires Verification)</option>
                  <option value="CONFIRMED" ${incident.status === 'CONFIRMED' ? 'selected' : ''}>CONFIRMED (Area Outage Declared)</option>
                  <option value="INVESTIGATING" ${incident.status === 'INVESTIGATING' ? 'selected' : ''}>INVESTIGATING (Crew Dispatched)</option>
                  <option value="RESOLVED" ${incident.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED (Service Restored)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Root Cause & Field Diagnosis</label>
                <textarea id="mo-cause" class="form-control" style="min-height: 80px;" placeholder="Document root cause (e.g. Backhoe cut 24-core backbone cable near Ring Road)...">${incident.suspected_cause || ''}</textarea>
              </div>
            </form>
          `;

          modal.open({
            title: `Manage Network Incident: ${incident.outage_code}`,
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Update Incident',
                className: 'btn-primary',
                onClick: async (close) => {
                  const payload = {
                    status: document.getElementById('mo-status').value,
                    suspected_cause: document.getElementById('mo-cause').value
                  };

                  try {
                    await api.put(`/outages/${id}`, payload);
                    toast.success('Incident status updated!');
                    close();
                    loadOutages();
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

  document.getElementById('outage-status-filter').onchange = loadOutages;
  loadOutages();
}
