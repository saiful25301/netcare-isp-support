import { API_BASE } from '../config.js';
import { toast } from './toast.js';

class AuthService {
  constructor() {
    this.tokenKey = 'netcare_token';
    this.userKey = 'netcare_user';
  }

  getToken() {
    return localStorage.getItem(this.tokenKey);
  }

  getUser() {
    const raw = localStorage.getItem(this.userKey);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  isAuthenticated() {
    return !!this.getToken();
  }

  getRole() {
    const user = this.getUser();
    return user ? user.role : null;
  }

  setSession(token, user) {
    localStorage.setItem(this.tokenKey, token);
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  async login(username, password) {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      this.setSession(data.access_token, {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role
      });

      // Fetch comprehensive profile details
      await this.fetchProfile();
      toast.success(`Welcome back, ${data.full_name}!`);
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async registerCustomer(payload) {
    try {
      const res = await fetch(`${API_BASE}/auth/register-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      this.setSession(data.access_token, {
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role
      });

      await this.fetchProfile();
      toast.success('Registration successful! Welcome to NetCare.');
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    }
  }

  async fetchProfile() {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.status === 401) {
        this.logout();
        return null;
      }

      if (res.ok) {
        const profile = await res.json();
        localStorage.setItem(this.userKey, JSON.stringify(profile));
        return profile;
      }
    } catch (e) {
      console.error('Error fetching profile:', e);
    }
    return this.getUser();
  }

  logout() {
    this.clearSession();
    window.location.hash = '#/login';
    window.location.reload();
  }
}

export const auth = new AuthService();
