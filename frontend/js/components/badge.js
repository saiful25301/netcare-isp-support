export function renderPriorityBadge(priority) {
  const p = (priority || 'LOW').toUpperCase();
  const classMap = {
    CRITICAL: 'badge-critical',
    HIGH: 'badge-high',
    MEDIUM: 'badge-medium',
    LOW: 'badge-low'
  };
  return `<span class="badge ${classMap[p] || 'badge-low'}">${p}</span>`;
}

export function renderStatusBadge(status) {
  const s = (status || 'NEW').toUpperCase();
  const classKey = s.toLowerCase();
  const labelMap = {
    NEW: 'New',
    ASSIGNED: 'Assigned',
    IN_PROGRESS: 'In Progress',
    WAITING: 'Waiting for Cust',
    RESOLVED: 'Resolved',
    CLOSED: 'Closed',
    REOPENED: 'Reopened'
  };
  return `<span class="badge badge-${classKey}">${labelMap[s] || s}</span>`;
}

export function renderRoleBadge(role) {
  const r = (role || 'CUSTOMER').toUpperCase();
  const labelMap = {
    ADMIN: 'Admin',
    AGENT: 'Support Agent',
    TECHNICIAN: 'Technician',
    CUSTOMER: 'Customer'
  };
  return `<span class="badge badge-role-${r.toLowerCase()}">${labelMap[r] || r}</span>`;
}
