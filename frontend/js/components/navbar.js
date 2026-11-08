import { auth } from '../services/auth.js';
import { renderRoleBadge } from './badge.js';

export function renderNavbar(pageTitle = 'Dashboard') {
  const titleEl = document.getElementById('page-title');
  if (titleEl) {
    titleEl.textContent = pageTitle;
  }

  const userArea = document.getElementById('navbar-user-area');
  if (!userArea) return;

  const user = auth.getUser();
  if (!user) {
    userArea.innerHTML = '';
    return;
  }

  const initials = user.full_name
    ? user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U';

  userArea.innerHTML = `
    <div class="user-profile-badge">
      <div class="user-avatar">${initials}</div>
      <div class="flex flex-col user-info-col" style="line-height: 1.15;">
        <span class="text-xs font-semibold user-name-label">${user.full_name}</span>
        <div class="user-role-badge-container" style="margin-top: 2px;">${renderRoleBadge(user.role)}</div>
      </div>
    </div>
    <button id="btn-navbar-logout" class="btn btn-outline btn-sm btn-logout" title="Sign Out">
      Sign Out
    </button>
  `;

  document.getElementById('btn-navbar-logout').onclick = () => auth.logout();
}
