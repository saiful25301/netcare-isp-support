import { auth } from '../services/auth.js';
import { api } from '../services/api.js';
import { toast } from '../services/toast.js';

export async function renderLoginView(container) {
  // Hide layout header and sidebar on login screen
  const sidebar = document.getElementById('sidebar');
  const navbar = document.getElementById('navbar');
  if (sidebar) sidebar.style.display = 'none';
  if (navbar) navbar.style.display = 'none';

  // Fetch areas and packages for customer self-registration form
  let areas = [];
  let packages = [];
  try {
    areas = await api.get('/areas?is_active=true');
    packages = await api.get('/packages?is_active=true');
  } catch (e) {
    console.warn('Could not fetch areas/packages for registration:', e);
  }

  container.innerHTML = `
    <div style="min-height: 85vh; display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="width: 100%; max-width: 480px;">
        <!-- Brand Header -->
        <div style="text-align: center; margin-bottom: 1.75rem;">
          <div style="display: inline-flex; width: 54px; height: 54px; border-radius: 12px; background: linear-gradient(135deg, var(--color-primary), var(--color-secondary)); color: white; align-items: center; justify-content: center; font-size: 1.75rem; font-weight: 800; margin-bottom: 0.75rem; box-shadow: var(--shadow-md);">
            NC
          </div>
          <h1 style="font-size: 1.6rem; font-weight: 700; color: var(--color-text-main); letter-spacing: -0.02em;">NetCare Portal</h1>
          <p class="text-sm text-muted">Smart ISP Customer Support & Complaint Management System</p>
        </div>

        <!-- Auth Card -->
        <div class="card" style="box-shadow: var(--shadow-lg); border-color: var(--color-border);">
          <div class="card-header" style="padding: 0.75rem 1.25rem; background-color: #F8FAFC;">
            <div style="display: flex; width: 100%; gap: 0.5rem;">
              <button id="tab-login" class="btn btn-secondary w-full btn-sm">Sign In</button>
              <button id="tab-register" class="btn btn-outline w-full btn-sm">Register as Customer</button>
            </div>
          </div>

          <div class="card-body" style="padding: 1.5rem;">
            <!-- Login Form -->
            <form id="form-login">
              <div class="form-group">
                <label class="form-label">Email or Phone Number</label>
                <input type="text" id="login-username" class="form-control" placeholder="admin@netcare.com.bd or 01711..." required>
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="login-password" class="form-control" placeholder="••••••••" required>
              </div>
              <button type="submit" id="btn-login-submit" class="btn btn-primary w-full" style="margin-top: 0.5rem; padding: 0.65rem;">
                Sign In to NetCare
              </button>
            </form>

            <!-- Customer Self-Registration Form (Hidden initially) -->
            <form id="form-register" class="hidden">
              <div class="form-group">
                <label class="form-label">Full Name</label>
                <input type="text" id="reg-name" class="form-control" placeholder="e.g. Arif Rahman" required>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="form-group">
                  <label class="form-label">Email Address</label>
                  <input type="email" id="reg-email" class="form-control" placeholder="name@gmail.com" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Phone Number</label>
                  <input type="text" id="reg-phone" class="form-control" placeholder="+88017..." required>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Password</label>
                <input type="password" id="reg-password" class="form-control" placeholder="Minimum 6 characters" minlength="6" required>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div class="form-group">
                  <label class="form-label">Service Area</label>
                  <select id="reg-area" class="form-select" required>
                    <option value="">Select Area...</option>
                    ${areas.map(a => `<option value="${a.id}">${a.name} (${a.code})</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Internet Package</label>
                  <select id="reg-pkg" class="form-select" required>
                    <option value="">Select Package...</option>
                    ${packages.map(p => `<option value="${p.id}">${p.name} - ৳${p.monthly_fee}</option>`).join('')}
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Installation Address</label>
                <textarea id="reg-address" class="form-control" style="min-height: 60px;" placeholder="House, Road, Block, Sector..." required></textarea>
              </div>
              <button type="submit" id="btn-reg-submit" class="btn btn-success w-full" style="margin-top: 0.5rem;">
                Create Account & Connect
              </button>
            </form>

            <!-- Quick Demo One-Click Access -->
            <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px dashed var(--color-border);">
              <div class="text-xs font-semibold text-muted" style="text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.65rem; text-align: center;">
                ⚡ Quick Demo One-Click Sign In
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button type="button" class="btn btn-outline btn-sm demo-login-btn" data-user="admin@netcare.com.bd" data-pass="password123" style="font-size: 0.78rem;">
                  👑 Admin
                </button>
                <button type="button" class="btn btn-outline btn-sm demo-login-btn" data-user="agent@netcare.com.bd" data-pass="password123" style="font-size: 0.78rem;">
                  🎧 Support Agent
                </button>
                <button type="button" class="btn btn-outline btn-sm demo-login-btn" data-user="tech1@netcare.com.bd" data-pass="password123" style="font-size: 0.78rem;">
                  🛠 Field Technician
                </button>
                <button type="button" class="btn btn-outline btn-sm demo-login-btn" data-user="customer1@netcare.com.bd" data-pass="password123" style="font-size: 0.78rem;">
                  👤 Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Tabs switching
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  tabLogin.onclick = () => {
    tabLogin.className = 'btn btn-secondary w-full btn-sm';
    tabRegister.className = 'btn btn-outline w-full btn-sm';
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  };

  tabRegister.onclick = () => {
    tabRegister.className = 'btn btn-secondary w-full btn-sm';
    tabLogin.className = 'btn btn-outline w-full btn-sm';
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  };

  // Login handler
  formLogin.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;

    const ok = await auth.login(u, p);
    btn.disabled = false;
    btn.textContent = 'Sign In to NetCare';

    if (ok) {
      redirectUserAfterAuth();
    }
  };

  // Demo buttons handler
  document.querySelectorAll('.demo-login-btn').forEach(btn => {
    btn.onclick = async () => {
      const u = btn.getAttribute('data-user');
      const p = btn.getAttribute('data-pass');
      btn.textContent = 'Connecting...';
      const ok = await auth.login(u, p);
      if (ok) {
        redirectUserAfterAuth();
      } else {
        btn.textContent = btn.getAttribute('data-user');
      }
    };
  });

  // Customer self-registration handler
  formRegister.onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-reg-submit');
    btn.disabled = true;
    btn.textContent = 'Registering...';

    const payload = {
      full_name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      phone_number: document.getElementById('reg-phone').value,
      password: document.getElementById('reg-password').value,
      service_area_id: parseInt(document.getElementById('reg-area').value),
      package_id: parseInt(document.getElementById('reg-pkg').value),
      installation_address: document.getElementById('reg-address').value
    };

    const ok = await auth.registerCustomer(payload);
    btn.disabled = false;
    btn.textContent = 'Create Account & Connect';

    if (ok) {
      redirectUserAfterAuth();
    }
  };
}

export function redirectUserAfterAuth() {
  const role = auth.getRole();
  if (role === 'ADMIN') {
    window.location.hash = '#/admin/analytics';
  } else if (role === 'AGENT') {
    window.location.hash = '#/tickets';
  } else if (role === 'TECHNICIAN') {
    window.location.hash = '#/technician/jobs';
  } else if (role === 'CUSTOMER') {
    window.location.hash = '#/customer/portal';
  } else {
    window.location.hash = '#/tickets';
  }
}
