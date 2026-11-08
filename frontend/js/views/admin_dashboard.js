import { api } from '../services/api.js';
import { toast } from '../services/toast.js';

export async function renderAdminAnalyticsView(container) {
  container.innerHTML = `
    <div class="page-header-flex">
      <div>
        <h2 class="text-xl font-bold">Executive Operations & Analytics Dashboard</h2>
        <p class="text-sm text-muted">Real-time ISP operational health, customer satisfaction, and dispatch metrics</p>
      </div>
      <button id="btn-refresh-analytics" class="btn btn-outline btn-sm">
        🔄 Refresh Metrics
      </button>
    </div>

    <!-- 10 Operational KPI Metric Cards -->
    <div class="grid grid-cols-4 gap-3" style="margin-bottom: 1.5rem;">
      <div class="stat-card">
        <div class="stat-icon stat-icon-blue">👥</div>
        <div>
          <div class="stat-value" id="kpi-total-cust">...</div>
          <div class="stat-label">Total Customers</div>
          <div class="text-xs text-muted" id="kpi-active-cust">...</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon-amber">🎫</div>
        <div>
          <div class="stat-value" id="kpi-total-tickets">...</div>
          <div class="stat-label">Total Complaints</div>
          <div class="text-xs text-muted" id="kpi-new-tickets">...</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon-red">⚡</div>
        <div>
          <div class="stat-value" id="kpi-critical-tickets" style="color: var(--color-danger);">...</div>
          <div class="stat-label">Critical Outages</div>
          <div class="text-xs text-muted" id="kpi-pending-tickets">...</div>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon stat-icon-green">★</div>
        <div>
          <div class="stat-value" id="kpi-csat-score" style="color: var(--color-success);">...</div>
          <div class="stat-label">Customer CSAT</div>
          <div class="text-xs text-muted" id="kpi-avg-resolution">...</div>
        </div>
      </div>
    </div>

    <!-- Charts & Breakdown Section -->
    <div class="grid grid-cols-2 gap-4" style="margin-bottom: 1.5rem;">
      <!-- Daily Trend Chart (Last 7 Days) -->
      <div class="card">
        <div class="card-header">
          <div class="font-bold">📈 Daily Complaint Volume (Last 7 Days)</div>
        </div>
        <div class="card-body">
          <div id="daily-trend-chart" style="height: 180px; display: flex; align-items: flex-end; justify-content: space-around; gap: 0.5rem; padding-top: 1.5rem;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>

      <!-- Area-wise Complaints -->
      <div class="card">
        <div class="card-header">
          <div class="font-bold">📍 Area-wise Complaint Distribution</div>
        </div>
        <div class="card-body" id="area-distribution-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
          <!-- Rendered dynamically -->
        </div>
      </div>
    </div>

    <!-- Category Breakdown & Technician Leaderboard -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Complaint Category Breakdown -->
      <div class="card">
        <div class="card-header">
          <div class="font-bold">🏷️ Complaint Categories</div>
        </div>
        <div class="card-body" id="category-distribution-container" style="display: flex; flex-direction: column; gap: 0.65rem;">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Technician Performance Leaderboard -->
      <div class="card">
        <div class="card-header">
          <div class="font-bold">🏆 Technician Resolution Leaderboard</div>
        </div>
        <div class="table-responsive" style="border: none;">
          <table class="table">
            <thead>
              <tr>
                <th>Technician</th>
                <th>Resolved Jobs</th>
                <th>Satisfaction</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="leaderboard-tbody">
              <tr><td colspan="4" class="text-center text-muted" style="padding: 1rem;">Loading leaderboard...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  async function loadDashboard() {
    try {
      const data = await api.get('/analytics/dashboard');
      const kpi = data.kpi;

      // 1. Fill KPI Cards
      document.getElementById('kpi-total-cust').textContent = kpi.total_customers;
      document.getElementById('kpi-active-cust').textContent = `${kpi.active_customers} Active Lines`;

      document.getElementById('kpi-total-tickets').textContent = kpi.total_complaints;
      document.getElementById('kpi-new-tickets').textContent = `${kpi.new_complaints} New • ${kpi.in_progress_complaints} In Progress`;

      document.getElementById('kpi-critical-tickets').textContent = kpi.critical_tickets;
      document.getElementById('kpi-pending-tickets').textContent = `${kpi.pending_complaints} Total Pending`;

      document.getElementById('kpi-csat-score').textContent = `${kpi.csat_score.toFixed(1)} / 5.0`;
      document.getElementById('kpi-avg-resolution').textContent = `Avg SLA: ${kpi.avg_resolution_hours} Hours`;

      // 2. Render Daily Trend Chart (Pure CSS Column Chart)
      const maxDaily = Math.max(...data.daily_trends.map(d => d.count), 1);
      const chartEl = document.getElementById('daily-trend-chart');
      chartEl.innerHTML = data.daily_trends.map(d => {
        const heightPct = Math.max((d.count / maxDaily) * 100, 10);
        return `
          <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; height: 100%; justify-content: flex-end;">
            <span class="text-xs font-bold" style="color: var(--color-primary);">${d.count}</span>
            <div style="width: 100%; max-width: 36px; height: ${heightPct}%; background: linear-gradient(180deg, var(--color-secondary), var(--color-primary)); border-radius: 6px 6px 0 0; transition: height 0.3s ease;"></div>
            <span class="text-xs text-muted" style="margin-top: 4px;">${d.date}</span>
          </div>
        `;
      }).join('');

      // 3. Render Area Distribution
      const totalTickets = kpi.total_complaints || 1;
      const areaEl = document.getElementById('area-distribution-container');
      areaEl.innerHTML = data.area_breakdown.map(a => {
        const pct = Math.round((a.count / totalTickets) * 100);
        return `
          <div>
            <div class="flex justify-between text-xs font-semibold" style="margin-bottom: 0.25rem;">
              <span>${a.area}</span>
              <span>${a.count} tickets (${pct}%)</span>
            </div>
            <div style="height: 8px; width: 100%; background-color: #E2E8F0; border-radius: 9999px; overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background-color: var(--color-secondary); border-radius: 9999px;"></div>
            </div>
          </div>
        `;
      }).join('');

      // 4. Render Category Distribution
      const catEl = document.getElementById('category-distribution-container');
      catEl.innerHTML = data.category_breakdown.map(c => {
        const pct = Math.round((c.count / totalTickets) * 100);
        return `
          <div>
            <div class="flex justify-between text-xs font-semibold" style="margin-bottom: 0.25rem;">
              <span>${c.category}</span>
              <span>${c.count} (${pct}%)</span>
            </div>
            <div style="height: 7px; width: 100%; background-color: #F1F5F9; border-radius: 9999px; overflow: hidden;">
              <div style="height: 100%; width: ${pct}%; background-color: var(--color-primary); border-radius: 9999px;"></div>
            </div>
          </div>
        `;
      }).join('');

      // 5. Render Technician Leaderboard
      const tb = document.getElementById('leaderboard-tbody');
      if (data.tech_leaderboard.length === 0) {
        tb.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No technicians active.</td></tr>`;
      } else {
        tb.innerHTML = data.tech_leaderboard.map(tech => `
          <tr>
            <td>
              <div class="font-semibold text-sm">${tech.name}</div>
              <div class="text-xs text-muted">${tech.employee_code}</div>
            </td>
            <td>
              <span class="font-bold text-sm" style="color: var(--color-success);">${tech.resolved_tickets}</span>
            </td>
            <td>
              <span class="font-bold text-sm" style="color: var(--color-warning);">${(tech.rating || 5.0).toFixed(1)} ★</span>
            </td>
            <td>
              <span class="badge ${tech.status === 'AVAILABLE' ? 'badge-resolved' : 'badge-high'}">${tech.status}</span>
            </td>
          </tr>
        `).join('');
      }

    } catch (err) {
      toast.error(err.message);
    }
  }

  document.getElementById('btn-refresh-analytics').onclick = loadDashboard;
  loadDashboard();
}
