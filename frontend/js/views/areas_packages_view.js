import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';

export async function renderAreasPackagesView(container) {
  const isAdmin = auth.getRole() === 'ADMIN';

  container.innerHTML = `
    <div class="flex items-center justify-between" style="margin-bottom: 1.25rem;">
      <div>
        <h2 class="text-xl font-bold">ISP Master Configuration</h2>
        <p class="text-sm text-muted">Manage network coverage areas, bandwidth tiers, and pricing</p>
      </div>
      ${isAdmin ? `
        <div class="flex gap-2">
          <button id="btn-new-area" class="btn btn-outline btn-sm">➕ Add Service Area</button>
          <button id="btn-new-pkg" class="btn btn-primary btn-sm">➕ Add Internet Package</button>
        </div>
      ` : ''}
    </div>

    <div class="grid grid-cols-2 gap-4">
      <!-- Service Areas Card -->
      <div class="card">
        <div class="card-header">
          <div class="font-bold">📍 Service Coverage Areas</div>
          <span class="text-xs text-muted" id="area-count">Loading...</span>
        </div>
        <div class="table-responsive" style="border: none;">
          <table class="table">
            <thead>
              <tr>
                <th>Area Name</th>
                <th>Area Code</th>
                <th>City</th>
                <th>Coverage Scope</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="areas-table-body">
              <tr><td colspan="5" class="text-center text-muted" style="padding: 1.5rem;">Loading areas...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Internet Packages Card -->
      <div class="card">
        <div class="card-header">
          <div class="font-bold">🚀 Bandwidth Packages & Pricing</div>
          <span class="text-xs text-muted" id="pkg-count">Loading...</span>
        </div>
        <div class="table-responsive" style="border: none;">
          <table class="table">
            <thead>
              <tr>
                <th>Package Tier</th>
                <th>Speed (Mbps)</th>
                <th>Monthly Rate</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody id="packages-table-body">
              <tr><td colspan="5" class="text-center text-muted" style="padding: 1.5rem;">Loading packages...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  async function loadData() {
    try {
      const [areas, pkgs] = await Promise.all([
        api.get('/areas'),
        api.get('/packages')
      ]);

      document.getElementById('area-count').textContent = `${areas.length} Areas`;
      document.getElementById('pkg-count').textContent = `${pkgs.length} Packages`;

      const areaTbody = document.getElementById('areas-table-body');
      areaTbody.innerHTML = areas.map(a => `
        <tr>
          <td><span class="font-semibold">${a.name}</span></td>
          <td><span class="badge" style="background-color: #EFF6FF; color: #1E40AF;">${a.code}</span></td>
          <td>${a.city}</td>
          <td><div class="text-xs text-muted">${(a.coverage_details || 'Full Area').slice(0, 30)}...</div></td>
          <td><span class="badge ${a.is_active ? 'badge-resolved' : 'badge-low'}">${a.is_active ? 'Active' : 'Inactive'}</span></td>
        </tr>
      `).join('');

      const pkgTbody = document.getElementById('packages-table-body');
      pkgTbody.innerHTML = pkgs.map(p => `
        <tr>
          <td><span class="font-semibold">${p.name}</span></td>
          <td><span class="font-bold" style="color: var(--color-secondary);">${p.speed_mbps} Mbps</span></td>
          <td>৳${p.monthly_fee} <span class="text-xs text-muted">/mo</span></td>
          <td><span class="badge" style="background-color: #F1F5F9; color: #334155;">${p.connection_type}</span></td>
          <td><span class="badge ${p.is_active ? 'badge-resolved' : 'badge-low'}">${p.is_active ? 'Active' : 'Archived'}</span></td>
        </tr>
      `).join('');

    } catch (err) {
      toast.error(err.message);
    }
  }

  if (isAdmin) {
    // Add Area Modal
    document.getElementById('btn-new-area').onclick = () => {
      const content = `
        <form id="form-area">
          <div class="form-group">
            <label class="form-label">Area Name</label>
            <input type="text" id="area-name" class="form-control" required placeholder="e.g. Badda & Rampura">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="form-group">
              <label class="form-label">Unique Area Code</label>
              <input type="text" id="area-code" class="form-control" required placeholder="e.g. BAD-01">
            </div>
            <div class="form-group">
              <label class="form-label">City</label>
              <input type="text" id="area-city" class="form-control" value="Dhaka" required>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Coverage Details</label>
            <textarea id="area-details" class="form-control" placeholder="Coverage bounds, road numbers..."></textarea>
          </div>
        </form>
      `;

      modal.open({
        title: '📍 Add New Service Coverage Area',
        content,
        footerButtons: [
          { text: 'Cancel', className: 'btn-outline' },
          {
            text: 'Save Area',
            className: 'btn-primary',
            onClick: async (close) => {
              const payload = {
                name: document.getElementById('area-name').value,
                code: document.getElementById('area-code').value,
                city: document.getElementById('area-city').value,
                coverage_details: document.getElementById('area-details').value
              };
              if (!payload.name || !payload.code) {
                toast.error('Area name and code are required.');
                return;
              }
              try {
                await api.post('/areas', payload);
                toast.success('Service area added successfully!');
                close();
                loadData();
              } catch (e) {
                toast.error(e.message);
              }
            }
          }
        ]
      });
    };

    // Add Package Modal
    document.getElementById('btn-new-pkg').onclick = () => {
      const content = `
        <form id="form-pkg">
          <div class="form-group">
            <label class="form-label">Package Name</label>
            <input type="text" id="pkg-name" class="form-control" required placeholder="e.g. Ultra Gaming 100 Mbps">
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="form-group">
              <label class="form-label">Bandwidth Speed (Mbps)</label>
              <input type="number" id="pkg-speed" class="form-control" required placeholder="100">
            </div>
            <div class="form-group">
              <label class="form-label">Monthly Fee (BDT)</label>
              <input type="number" id="pkg-fee" class="form-control" required placeholder="2500">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Connection Type</label>
            <select id="pkg-type" class="form-select">
              <option value="Fiber">Fiber (FTTH)</option>
              <option value="Broadband">Broadband Ethernet</option>
            </select>
          </div>
        </form>
      `;

      modal.open({
        title: '🚀 Create Internet Package',
        content,
        footerButtons: [
          { text: 'Cancel', className: 'btn-outline' },
          {
            text: 'Create Package',
            className: 'btn-primary',
            onClick: async (close) => {
              const payload = {
                name: document.getElementById('pkg-name').value,
                speed_mbps: parseInt(document.getElementById('pkg-speed').value),
                monthly_fee: parseFloat(document.getElementById('pkg-fee').value),
                connection_type: document.getElementById('pkg-type').value
              };
              if (!payload.name || !payload.speed_mbps || !payload.monthly_fee) {
                toast.error('All package fields are required.');
                return;
              }
              try {
                await api.post('/packages', payload);
                toast.success('Internet package created successfully!');
                close();
                loadData();
              } catch (e) {
                toast.error(e.message);
              }
            }
          }
        ]
      });
    };
  }

  loadData();
}
