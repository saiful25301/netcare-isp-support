import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';

export async function renderCustomersView(container) {
  container.innerHTML = `
    <div class="page-header-flex">
      <div>
        <h2 class="text-xl font-bold">Customer Management</h2>
        <p class="text-sm text-muted">Manage ISP customer subscriptions, line assignments, and accounts</p>
      </div>
      <button id="btn-add-customer" class="btn btn-primary">
        <span>➕</span> Add New Customer
      </button>
    </div>

    <!-- Filters Bar -->
    <div class="card" style="margin-bottom: 1.25rem; padding: 1rem;">
      <div class="grid grid-cols-3 gap-3">
        <div>
          <input type="text" id="cust-search" class="form-control" placeholder="Search by name, code, phone, address...">
        </div>
        <div>
          <select id="cust-filter-area" class="form-select">
            <option value="">All Service Areas</option>
          </select>
        </div>
        <div>
          <select id="cust-filter-status" class="form-select">
            <option value="">All Connection Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="SUSPENDED">SUSPENDED</option>
            <option value="TERMINATED">TERMINATED</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Customer Table Card -->
    <div class="card">
      <div class="table-responsive">
        <table class="table">
          <thead>
            <tr>
              <th>Customer Code</th>
              <th>Customer Name</th>
              <th>Contact Details</th>
              <th>Service Area</th>
              <th>Package</th>
              <th>Network IP / ONU</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="customers-table-body">
            <tr><td colspan="8" class="text-muted" style="text-align: center; padding: 2rem;">Loading customers...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Fetch areas for filter dropdown
  let areas = [];
  let packages = [];
  try {
    areas = await api.get('/areas');
    packages = await api.get('/packages');
    const areaSelect = document.getElementById('cust-filter-area');
    areas.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name} (${a.code})`;
      areaSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load areas/packages for filter:', err);
  }

  async function loadCustomers() {
    const search = document.getElementById('cust-search').value;
    const areaId = document.getElementById('cust-filter-area').value;
    const status = document.getElementById('cust-filter-status').value;

    let url = '/customers?';
    if (search) url += `search=${encodeURIComponent(search)}&`;
    if (areaId) url += `service_area_id=${encodeURIComponent(areaId)}&`;
    if (status) url += `status=${encodeURIComponent(status)}&`;

    try {
      const list = await api.get(url);
      const tbody = document.getElementById('customers-table-body');
      if (list.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" class="empty-state">
              <div class="empty-state-icon">👥</div>
              <p>No customers found matching your criteria.</p>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = list.map(c => `
        <tr>
          <td>
            <span class="font-semibold" style="color: var(--color-primary);">${c.customer_code}</span>
          </td>
          <td>
            <div class="font-semibold">${c.full_name}</div>
            <div class="text-xs text-muted">${c.installation_address.slice(0, 35)}...</div>
          </td>
          <td>
            <div class="text-sm">${c.phone_number}</div>
            <div class="text-xs text-muted">${c.email}</div>
          </td>
          <td>
            <span class="badge" style="background-color: #F1F5F9; color: #334155;">
              ${c.service_area_name || 'N/A'}
            </span>
          </td>
          <td>
            <div class="font-semibold">${c.package_name || 'N/A'}</div>
            <div class="text-xs text-muted">${c.speed_mbps || 0} Mbps - ৳${c.monthly_fee || 0}/mo</div>
          </td>
          <td>
            <div class="text-xs" style="font-family: monospace;">IP: ${c.ip_address || 'Dynamic DHCP'}</div>
            <div class="text-xs text-muted" style="font-family: monospace;">MAC: ${c.onu_mac_address || 'N/A'}</div>
          </td>
          <td>
            <span class="badge ${c.status === 'ACTIVE' ? 'badge-resolved' : (c.status === 'SUSPENDED' ? 'badge-high' : 'badge-critical')}">
              ${c.status}
            </span>
          </td>
          <td>
            <div class="flex gap-2">
              <button class="btn btn-outline btn-sm btn-view-cust" data-id="${c.id}">View</button>
              ${auth.getRole() === 'ADMIN' ? `<button class="btn btn-outline btn-sm btn-edit-cust" data-id="${c.id}">Edit</button>` : ''}
            </div>
          </td>
        </tr>
      `).join('');

      // Wire View button
      tbody.querySelectorAll('.btn-view-cust').forEach(b => {
        b.onclick = () => showCustomerDetailModal(b.getAttribute('data-id'));
      });

      // Wire Edit button
      tbody.querySelectorAll('.btn-edit-cust').forEach(b => {
        b.onclick = () => showEditCustomerModal(b.getAttribute('data-id'), list.find(x => x.id === b.getAttribute('data-id')));
      });

    } catch (err) {
      toast.error(err.message);
    }
  }

  // Filter event listeners with debounce
  let searchTimer;
  document.getElementById('cust-search').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadCustomers, 300);
  };
  document.getElementById('cust-filter-area').onchange = loadCustomers;
  document.getElementById('cust-filter-status').onchange = loadCustomers;

  // Add Customer Modal
  document.getElementById('btn-add-customer').onclick = () => {
    const formHtml = `
      <form id="modal-cust-form">
        <div class="form-group">
          <label class="form-label">Customer Full Name</label>
          <input type="text" id="m-cust-name" class="form-control" required placeholder="e.g. Tanvir Hasan">
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" id="m-cust-email" class="form-control" required placeholder="cust@gmail.com">
          </div>
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="text" id="m-cust-phone" class="form-control" required placeholder="+88017...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Default Password</label>
          <input type="text" id="m-cust-pass" class="form-control" value="netcare123" required>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="form-group">
            <label class="form-label">Service Area</label>
            <select id="m-cust-area" class="form-select" required>
              <option value="">Select Area...</option>
              ${areas.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Internet Package</label>
            <select id="m-cust-pkg" class="form-select" required>
              <option value="">Select Package...</option>
              ${packages.map(p => `<option value="${p.id}">${p.name} - ৳${p.monthly_fee}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Installation Address</label>
          <textarea id="m-cust-address" class="form-control" required placeholder="House, Road, Apartment #"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="form-group">
            <label class="form-label">Assigned Static IP (Optional)</label>
            <input type="text" id="m-cust-ip" class="form-control" placeholder="103.145.x.x">
          </div>
          <div class="form-group">
            <label class="form-label">ONU MAC Address (Optional)</label>
            <input type="text" id="m-cust-mac" class="form-control" placeholder="F4:8C:50:...">
          </div>
        </div>
      </form>
    `;

    modal.open({
      title: '➕ Onboard New Customer',
      content: formHtml,
      footerButtons: [
        { text: 'Cancel', className: 'btn-outline' },
        {
          text: 'Save Customer',
          className: 'btn-primary',
          onClick: async (close) => {
            const payload = {
              full_name: document.getElementById('m-cust-name').value,
              email: document.getElementById('m-cust-email').value,
              phone_number: document.getElementById('m-cust-phone').value,
              password: document.getElementById('m-cust-pass').value,
              service_area_id: parseInt(document.getElementById('m-cust-area').value),
              package_id: parseInt(document.getElementById('m-cust-pkg').value),
              installation_address: document.getElementById('m-cust-address').value,
              ip_address: document.getElementById('m-cust-ip').value || null,
              onu_mac_address: document.getElementById('m-cust-mac').value || null,
              status: 'ACTIVE'
            };

            if (!payload.full_name || !payload.email || !payload.phone_number || !payload.service_area_id || !payload.package_id) {
              toast.error('Please fill in all mandatory fields.');
              return;
            }

            try {
              await api.post('/customers', payload);
              toast.success('Customer registered successfully!');
              close();
              loadCustomers();
            } catch (e) {
              toast.error(e.message);
            }
          }
        }
      ]
    });
  };

  async function showCustomerDetailModal(customerId) {
    try {
      const data = await api.get(`/customers/${customerId}`);
      const content = `
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between" style="padding-bottom: 0.75rem; border-bottom: 1px solid var(--color-border);">
            <div>
              <span class="text-xs text-muted">Customer Code</span>
              <div class="text-lg font-bold" style="color: var(--color-primary);">${data.customer_code}</div>
            </div>
            <div>
              <span class="badge ${data.status === 'ACTIVE' ? 'badge-resolved' : 'badge-high'}">${data.status}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-sm">
            <div><strong>Full Name:</strong> ${data.full_name}</div>
            <div><strong>Phone:</strong> ${data.phone_number}</div>
            <div><strong>Email:</strong> ${data.email}</div>
            <div><strong>Service Area:</strong> ${data.service_area_name} (${data.service_area_code})</div>
            <div><strong>Subscribed Plan:</strong> ${data.package_name} (${data.speed_mbps} Mbps)</div>
            <div><strong>Monthly Bill:</strong> ৳${data.monthly_fee} / month</div>
            <div><strong>Assigned IP:</strong> ${data.ip_address || 'DHCP Dynamic'}</div>
            <div><strong>ONU MAC:</strong> ${data.onu_mac_address || 'Not Recorded'}</div>
          </div>

          <div class="text-sm">
            <strong>Installation Address:</strong>
            <p class="text-muted" style="margin-top: 0.25rem;">${data.installation_address}</p>
          </div>

          <div style="margin-top: 0.75rem;">
            <h4 class="text-sm font-bold" style="margin-bottom: 0.5rem;">Complaint History (${data.complaint_history ? data.complaint_history.length : 0})</h4>
            ${!data.complaint_history || data.complaint_history.length === 0 ? '<p class="text-xs text-muted">No past complaints on record.</p>' : `
              <div style="max-height: 160px; overflow-y: auto; border: 1px solid var(--color-border); border-radius: 6px;">
                <table class="table" style="font-size: 0.75rem;">
                  <thead><tr><th>Ticket ID</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    ${data.complaint_history.map(t => `
                      <tr>
                        <td class="font-semibold">${t.ticket_id}</td>
                        <td>${t.category}</td>
                        <td><span class="badge badge-${t.status.toLowerCase()}">${t.status}</span></td>
                        <td>${new Date(t.created_at).toLocaleDateString()}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>
      `;

      modal.open({
        title: `Customer Dossier – ${data.full_name}`,
        content,
        footerButtons: [{ text: 'Close', className: 'btn-outline' }]
      });
    } catch (e) {
      toast.error(e.message);
    }
  }

  function showEditCustomerModal(customerId, cust) {
    if (!cust) return;
    const formHtml = `
      <form id="edit-cust-form">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" id="e-name" class="form-control" value="${cust.full_name}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Phone Number</label>
          <input type="text" id="e-phone" class="form-control" value="${cust.phone_number}" required>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="form-group">
            <label class="form-label">Service Area</label>
            <select id="e-area" class="form-select" required>
              ${areas.map(a => `<option value="${a.id}" ${a.id === cust.service_area_id ? 'selected' : ''}>${a.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Internet Package</label>
            <select id="e-pkg" class="form-select" required>
              ${packages.map(p => `<option value="${p.id}" ${p.id === cust.package_id ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Connection Status</label>
          <select id="e-status" class="form-select" required>
            <option value="ACTIVE" ${cust.status === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="SUSPENDED" ${cust.status === 'SUSPENDED' ? 'selected' : ''}>SUSPENDED</option>
            <option value="TERMINATED" ${cust.status === 'TERMINATED' ? 'selected' : ''}>TERMINATED</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Installation Address</label>
          <textarea id="e-address" class="form-control">${cust.installation_address}</textarea>
        </div>
      </form>
    `;

    modal.open({
      title: `Edit Customer: ${cust.customer_code}`,
      content: formHtml,
      footerButtons: [
        { text: 'Cancel', className: 'btn-outline' },
        {
          text: 'Save Changes',
          className: 'btn-primary',
          onClick: async (close) => {
            const payload = {
              full_name: document.getElementById('e-name').value,
              phone_number: document.getElementById('e-phone').value,
              service_area_id: parseInt(document.getElementById('e-area').value),
              package_id: parseInt(document.getElementById('e-pkg').value),
              status: document.getElementById('e-status').value,
              installation_address: document.getElementById('e-address').value
            };

            try {
              await api.put(`/customers/${customerId}`, payload);
              toast.success('Customer updated successfully!');
              close();
              loadCustomers();
            } catch (err) {
              toast.error(err.message);
            }
          }
        }
      ]
    });
  }

  // Initial load
  loadCustomers();
}
