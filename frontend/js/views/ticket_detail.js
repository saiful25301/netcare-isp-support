import { api } from '../services/api.js';
import { auth } from '../services/auth.js';
import { toast } from '../services/toast.js';
import { modal } from '../components/modal.js';
import { renderPriorityBadge, renderStatusBadge } from '../components/badge.js';

export async function renderTicketDetailView(container, ticketId) {
  const role = auth.getRole();
  const isStaff = role === 'ADMIN' || role === 'AGENT';
  const isTech = role === 'TECHNICIAN';
  const isCustomer = role === 'CUSTOMER';

  container.innerHTML = `
    <div style="margin-bottom: 1rem;">
      <a href="#/tickets" class="btn btn-outline btn-sm">← Back to Ticket List</a>
    </div>
    <div id="ticket-detail-content">
      <div class="card" style="padding: 2.5rem; text-align: center; color: var(--color-text-muted);">
        Loading ticket dossier...
      </div>
    </div>
  `;

  async function loadDetail() {
    try {
      const t = await api.get(`/tickets/${ticketId}`);
      const contentEl = document.getElementById('ticket-detail-content');

      const isResolved = t.status === 'RESOLVED';
      const isClosed = t.status === 'CLOSED';
      const isInProgress = t.status === 'IN_PROGRESS';
      const isAssigned = t.status === 'ASSIGNED';
      const isNew = t.status === 'NEW';

      contentEl.innerHTML = `
        <!-- Main Header Bar -->
        <div class="card" style="margin-bottom: 1.25rem;">
          <div class="card-header" style="flex-wrap: wrap; gap: 1rem;">
            <div>
              <div class="flex items-center gap-3">
                <h2 class="text-2xl font-bold" style="color: var(--color-primary); font-family: monospace;">${t.ticket_id}</h2>
                ${renderPriorityBadge(t.priority)}
                ${renderStatusBadge(t.status)}
              </div>
              <h3 class="text-lg font-semibold" style="margin-top: 0.25rem;">${t.problem_title}</h3>
              <div class="text-xs text-muted">
                Category: <strong>${t.category_name}</strong> • SLA Target: <strong>${t.sla_target_hours} Hours</strong> • Filed: ${new Date(t.created_at).toLocaleString()}
              </div>
            </div>

            <!-- Contextual Action Buttons -->
            <div class="flex gap-2" id="ticket-actions-bar">
              ${isStaff ? `
                <button id="btn-assign-tech" class="btn btn-primary btn-sm">🛠 Assign Technician</button>
                <button id="btn-change-priority" class="btn btn-outline btn-sm">⚙ Change Priority</button>
                <button id="btn-change-status" class="btn btn-secondary btn-sm">🔄 Update Status</button>
              ` : ''}

              ${isTech ? `
                ${isAssigned ? `<button id="btn-tech-start" class="btn btn-primary btn-sm">⚡ Start Work (In Progress)</button>` : ''}
                ${(isAssigned || isInProgress) ? `<button id="btn-tech-resolve" class="btn btn-success btn-sm">✓ Submit Resolution</button>` : ''}
              ` : ''}

              ${isCustomer ? `
                ${isResolved ? `
                  <button id="btn-cust-rate" class="btn btn-success btn-sm">★ Rate Service & Close</button>
                  <button id="btn-cust-reopen" class="btn btn-danger btn-sm">↺ Issue Not Fixed (Reopen)</button>
                ` : ''}
                ${isClosed ? `
                  <button id="btn-cust-reopen" class="btn btn-outline btn-sm">↺ Reopen Ticket</button>
                ` : ''}
              ` : ''}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-4">
          <!-- Left Column: Details & Timeline (Span 2) -->
          <div style="grid-column: span 2;" class="flex flex-col gap-4">
            <!-- Problem Description & Resolution Card -->
            <div class="card">
              <div class="card-header">
                <div class="font-bold">📋 Problem Description & Resolution Details</div>
              </div>
              <div class="card-body">
                <p style="white-space: pre-wrap; font-size: 0.95rem; line-height: 1.6;">${t.problem_description}</p>
                
                ${t.resolution_notes ? `
                  <div style="margin-top: 1.25rem; padding: 1rem; background-color: var(--color-success-bg); border-left: 4px solid var(--color-success); border-radius: 4px;">
                    <div class="font-bold text-sm" style="color: #166534; margin-bottom: 0.25rem;">✓ Official Resolution Notes:</div>
                    <p style="color: #14532D; font-size: 0.88rem; white-space: pre-wrap;">${t.resolution_notes}</p>
                    <div class="text-xs text-muted" style="margin-top: 0.5rem;">Resolved at: ${new Date(t.resolved_at).toLocaleString()}</div>
                  </div>
                ` : ''}
              </div>
            </div>

            <!-- Customer Feedback Card (If Rated) -->
            ${t.feedback ? `
              <div class="card" style="border-left: 4px solid var(--color-accent);">
                <div class="card-header" style="background-color: #FFFBEB;">
                  <div class="font-bold text-warning">★ Customer Rating & Satisfaction</div>
                  <span class="badge" style="background-color: #FEF3C7; color: #92400E;">${t.feedback.rating} / 5 Stars</span>
                </div>
                <div class="card-body">
                  <div style="font-size: 1.25rem; color: #F59E0B; margin-bottom: 0.35rem;">
                    ${'★'.repeat(t.feedback.rating)}${'☆'.repeat(5 - t.feedback.rating)}
                  </div>
                  <p class="text-sm">"${t.feedback.customer_comments || 'No written comment'}"</p>
                  <div class="text-xs text-muted" style="margin-top: 0.5rem;">
                    Issue Actually Resolved: <strong>${t.feedback.is_issue_resolved ? 'Yes' : 'No'}</strong> • Submitted: ${new Date(t.feedback.submitted_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Audit Trail & Status History Timeline -->
            <div class="card">
              <div class="card-header">
                <div class="font-bold">⏱ Lifecycle Status History & Audit Trail</div>
              </div>
              <div class="card-body">
                <div style="position: relative; padding-left: 1.5rem; border-left: 2px solid var(--color-border);">
                  ${t.status_history.map(h => `
                    <div style="position: relative; margin-bottom: 1.25rem;">
                      <div style="position: absolute; left: -1.95rem; top: 0.15rem; width: 14px; height: 14px; border-radius: 50%; background-color: var(--color-secondary); border: 2px solid white; box-shadow: var(--shadow-sm);"></div>
                      <div class="flex items-center gap-2">
                        <span class="font-bold text-sm">${h.new_status}</span>
                        <span class="text-xs text-muted">• by ${h.changed_by_name} (${h.changed_by_role})</span>
                      </div>
                      <p class="text-sm text-muted" style="margin-top: 0.15rem;">${h.reason || 'Status updated'}</p>
                      <div class="text-xs text-light" style="margin-top: 0.15rem;">${new Date(h.changed_at).toLocaleString()}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Communication & Comments Stream -->
            <div class="card">
              <div class="card-header">
                <div class="font-bold">💬 Discussion & Activity Log</div>
              </div>
              <div class="card-body">
                <div style="max-height: 350px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.25rem;" id="comments-container">
                  ${t.comments.length === 0 ? '<p class="text-xs text-muted">No messages posted on this ticket yet.</p>' : t.comments.map(c => `
                    <div style="padding: 0.75rem 1rem; border-radius: 8px; background-color: ${c.is_internal_note ? '#FEF3C7' : '#F8FAFC'}; border: 1px solid ${c.is_internal_note ? '#FDE68A' : 'var(--color-border)'};">
                      <div class="flex items-center justify-between" style="margin-bottom: 0.35rem;">
                        <span class="font-semibold text-xs" style="color: ${c.is_internal_note ? '#92400E' : 'var(--color-primary)'};">
                          ${c.user_name} (${c.user_role}) ${c.is_internal_note ? '🔒 [Internal Staff Note]' : ''}
                        </span>
                        <span class="text-xs text-light">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p class="text-sm" style="white-space: pre-wrap;">${c.comment_text}</p>
                    </div>
                  `).join('')}
                </div>

                <!-- Add Comment Input Box -->
                <form id="form-add-comment" class="flex flex-col gap-2">
                  <textarea id="comment-input" class="form-control" style="min-height: 60px;" placeholder="Type your message or technical update..." required></textarea>
                  <div class="flex items-center justify-between">
                    ${!isCustomer ? `
                      <label class="flex items-center gap-2 text-xs font-semibold text-muted" style="cursor: pointer;">
                        <input type="checkbox" id="comment-is-internal">
                        🔒 Internal Staff Note (Hide from Customer)
                      </label>
                    ` : '<div></div>'}
                    <button type="submit" class="btn btn-secondary btn-sm">Post Update</button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <!-- Right Column: Customer Dossier & Technician Assigned (Span 1) -->
          <div class="flex flex-col gap-4">
            <!-- Customer Dossier Card -->
            <div class="card">
              <div class="card-header">
                <div class="font-bold">👤 Subscriber Profile</div>
              </div>
              <div class="card-body text-sm flex flex-col gap-2">
                <div>
                  <span class="text-xs text-muted">Name & ID</span>
                  <div class="font-bold">${t.customer_name}</div>
                  <div class="text-xs font-semibold" style="color: var(--color-primary);">${t.customer_code}</div>
                </div>
                <div>
                  <span class="text-xs text-muted">Contact Phone</span>
                  <div class="font-semibold">${t.customer_phone}</div>
                </div>
                <div>
                  <span class="text-xs text-muted">Service Area</span>
                  <div><span class="badge" style="background-color: #F1F5F9; color: #1E293B;">${t.service_area_name}</span></div>
                </div>
                <div>
                  <span class="text-xs text-muted">Internet Plan</span>
                  <div class="font-semibold">${t.package_name || 'Broadband'} (${t.speed_mbps || 0} Mbps)</div>
                </div>
                <div>
                  <span class="text-xs text-muted">Installation Address</span>
                  <div class="text-xs text-muted">${t.installation_address}</div>
                </div>
                <div style="border-top: 1px dashed var(--color-border); padding-top: 0.5rem; margin-top: 0.25rem;">
                  <span class="text-xs text-muted">Network Parameters</span>
                  <div class="text-xs" style="font-family: monospace;">IP: ${t.ip_address || 'DHCP'}</div>
                  <div class="text-xs" style="font-family: monospace;">ONU MAC: ${t.onu_mac_address || 'N/A'}</div>
                </div>
              </div>
            </div>

            <!-- Assigned Technician Card -->
            <div class="card">
              <div class="card-header">
                <div class="font-bold">🛠 Field Technician</div>
              </div>
              <div class="card-body text-sm">
                ${t.assigned_technician_name ? `
                  <div class="font-bold text-md">${t.assigned_technician_name}</div>
                  <div class="text-xs font-semibold" style="color: var(--color-secondary);">${t.assigned_technician_code}</div>
                  <div class="text-xs text-muted" style="margin-top: 0.35rem;">📞 ${t.assigned_technician_phone || 'N/A'}</div>
                ` : `
                  <p class="text-xs text-muted" style="margin-bottom: 0.5rem;">No technician assigned to this ticket yet.</p>
                  ${isStaff ? `<button id="btn-assign-tech-side" class="btn btn-outline btn-sm w-full">Assign Field Tech</button>` : ''}
                `}
              </div>
            </div>
          </div>
        </div>
      `;

      // ---------------- Wire Action Buttons ----------------

      // Comment submission
      document.getElementById('form-add-comment').onsubmit = async (e) => {
        e.preventDefault();
        const input = document.getElementById('comment-input');
        const isInternalCheckbox = document.getElementById('comment-is-internal');

        const payload = {
          comment_text: input.value,
          is_internal_note: isInternalCheckbox ? isInternalCheckbox.checked : false
        };

        try {
          await api.post(`/tickets/${t.ticket_id}/comments`, payload);
          toast.success('Update posted!');
          loadDetail();
        } catch (err) {
          toast.error(err.message);
        }
      };

      // Assign Technician Modal
      const openAssignModal = async () => {
        let techList = [];
        try {
          techList = await api.get('/technicians');
        } catch (e) {
          console.error(e);
        }

        const modalHtml = `
          <form id="form-assign">
            <div class="form-group">
              <label class="form-label">Select Field Technician</label>
              <select id="a-tech-id" class="form-select" required>
                <option value="">Choose technician...</option>
                ${techList.map(tech => `
                  <option value="${tech.id}" ${t.assigned_technician_id === tech.id ? 'selected' : ''}>
                    ${tech.full_name} (${tech.employee_code}) - ${tech.primary_area_name} [${tech.current_status}] (${tech.rating_cache} ★)
                  </option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Dispatch Instructions / Notes</label>
              <textarea id="a-notes" class="form-control" placeholder="Specific fiber pole, tools, or appointment time..."></textarea>
            </div>
          </form>
        `;

        modal.open({
          title: `Assign Technician – ${t.ticket_id}`,
          content: modalHtml,
          footerButtons: [
            { text: 'Cancel', className: 'btn-outline' },
            {
              text: 'Assign & Dispatch',
              className: 'btn-primary',
              onClick: async (close) => {
                const techId = document.getElementById('a-tech-id').value;
                const notes = document.getElementById('a-notes').value;
                if (!techId) {
                  toast.error('Please select a technician.');
                  return;
                }
                try {
                  await api.post(`/tickets/${t.ticket_id}/assign`, { technician_id: techId, notes });
                  toast.success('Technician assigned and dispatched!');
                  close();
                  loadDetail();
                } catch (err) {
                  toast.error(err.message);
                }
              }
            }
          ]
        });
      };

      if (document.getElementById('btn-assign-tech')) {
        document.getElementById('btn-assign-tech').onclick = openAssignModal;
      }
      if (document.getElementById('btn-assign-tech-side')) {
        document.getElementById('btn-assign-tech-side').onclick = openAssignModal;
      }

      // Change Status Modal (Staff)
      if (document.getElementById('btn-change-status')) {
        document.getElementById('btn-change-status').onclick = () => {
          const content = `
            <form id="form-st">
              <div class="form-group">
                <label class="form-label">New Status</label>
                <select id="st-val" class="form-select">
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                  <option value="WAITING">WAITING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Reason / Resolution Note</label>
                <textarea id="st-reason" class="form-control" placeholder="Justification for status transition..."></textarea>
              </div>
            </form>
          `;

          modal.open({
            title: `Update Status: ${t.ticket_id}`,
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Apply Status',
                className: 'btn-secondary',
                onClick: async (close) => {
                  const new_status = document.getElementById('st-val').value;
                  const reason = document.getElementById('st-reason').value;
                  try {
                    await api.post(`/tickets/${t.ticket_id}/status`, {
                      new_status,
                      reason,
                      resolution_notes: new_status === 'RESOLVED' ? reason : null
                    });
                    toast.success('Ticket status updated!');
                    close();
                    loadDetail();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }
              }
            ]
          });
        };
      }

      // Change Priority Modal
      if (document.getElementById('btn-change-priority')) {
        document.getElementById('btn-change-priority').onclick = () => {
          const content = `
            <div class="form-group">
              <label class="form-label">Select Priority</label>
              <select id="prio-select" class="form-select">
                <option value="CRITICAL" ${t.priority === 'CRITICAL' ? 'selected' : ''}>CRITICAL</option>
                <option value="HIGH" ${t.priority === 'HIGH' ? 'selected' : ''}>HIGH</option>
                <option value="MEDIUM" ${t.priority === 'MEDIUM' ? 'selected' : ''}>MEDIUM</option>
                <option value="LOW" ${t.priority === 'LOW' ? 'selected' : ''}>LOW</option>
              </select>
            </div>
          `;

          modal.open({
            title: 'Change Priority Level',
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Update Priority',
                className: 'btn-primary',
                onClick: async (close) => {
                  const p = document.getElementById('prio-select').value;
                  try {
                    await api.put(`/tickets/${t.ticket_id}/priority`, { priority: p });
                    toast.success(`Priority updated to ${p}`);
                    close();
                    loadDetail();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }
              }
            ]
          });
        };
      }

      // Technician: Start Work
      if (document.getElementById('btn-tech-start')) {
        document.getElementById('btn-tech-start').onclick = async () => {
          try {
            await api.post(`/tickets/${t.ticket_id}/status`, {
              new_status: 'IN_PROGRESS',
              reason: 'Technician on site and started technical diagnostics.'
            });
            toast.success('Ticket marked In Progress!');
            loadDetail();
          } catch (err) {
            toast.error(err.message);
          }
        };
      }

      // Technician: Submit Resolution
      if (document.getElementById('btn-tech-resolve')) {
        document.getElementById('btn-tech-resolve').onclick = () => {
          const content = `
            <div class="form-group">
              <label class="form-label">Technical Resolution Details *</label>
              <textarea id="res-notes" class="form-control" style="min-height: 100px;" placeholder="Explain what was fixed (e.g. Optical fiber respliced, ONU optical power restored to -19 dBm, router reconfigured)..." required></textarea>
            </div>
          `;

          modal.open({
            title: `✓ Submit Work Resolution – ${t.ticket_id}`,
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Mark as Resolved',
                className: 'btn-success',
                onClick: async (close) => {
                  const notes = document.getElementById('res-notes').value;
                  if (!notes.trim()) {
                    toast.error('Resolution notes are required.');
                    return;
                  }
                  try {
                    await api.post(`/tickets/${t.ticket_id}/status`, {
                      new_status: 'RESOLVED',
                      resolution_notes: notes
                    });
                    toast.success('Complaint resolved! Customer notified.');
                    close();
                    loadDetail();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }
              }
            ]
          });
        };
      }

      // Customer: Rate and Close Ticket
      if (document.getElementById('btn-cust-rate')) {
        document.getElementById('btn-cust-rate').onclick = () => {
          const content = `
            <div class="flex flex-col gap-3">
              <div class="form-group">
                <label class="form-label">How would you rate the technician's service?</label>
                <div class="flex gap-2" id="star-rating-group" style="font-size: 1.75rem; cursor: pointer;">
                  <span class="star-btn" data-val="1">★</span>
                  <span class="star-btn" data-val="2">★</span>
                  <span class="star-btn" data-val="3">★</span>
                  <span class="star-btn" data-val="4">★</span>
                  <span class="star-btn" data-val="5" style="color: #F59E0B;">★</span>
                </div>
                <input type="hidden" id="cust-rating-val" value="5">
              </div>
              <div class="form-group">
                <label class="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" id="cust-fixed-check" checked>
                  My internet connection is completely restored and working properly.
                </label>
              </div>
              <div class="form-group">
                <label class="form-label">Feedback Comments (Optional)</label>
                <textarea id="cust-comments" class="form-control" placeholder="Share your experience..."></textarea>
              </div>
            </div>
          `;

          modal.open({
            title: `★ Review Service & Close Ticket`,
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Submit Rating & Close',
                className: 'btn-success',
                onClick: async (close) => {
                  const rating = parseInt(document.getElementById('cust-rating-val').value);
                  const isFixed = document.getElementById('cust-fixed-check').checked;
                  const comments = document.getElementById('cust-comments').value;

                  try {
                    // 1. Submit feedback
                    await api.post('/feedback', {
                      ticket_id: t.id,
                      rating,
                      is_issue_resolved: isFixed,
                      customer_comments: comments
                    });

                    // 2. Transition status to CLOSED
                    await api.post(`/tickets/${t.ticket_id}/status`, {
                      new_status: 'CLOSED',
                      reason: `Customer verified resolution (${rating}/5 stars).`
                    });

                    toast.success('Thank you for your feedback! Ticket closed.');
                    close();
                    loadDetail();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }
              }
            ]
          });

          // Star rating click handler
          let currentRating = 5;
          const stars = document.querySelectorAll('.star-btn');
          const ratingInput = document.getElementById('cust-rating-val');

          stars.forEach(s => {
            s.onclick = () => {
              currentRating = parseInt(s.getAttribute('data-val'));
              ratingInput.value = currentRating;
              stars.forEach(st => {
                const v = parseInt(st.getAttribute('data-val'));
                st.style.color = v <= currentRating ? '#F59E0B' : '#CBD5E1';
              });
            };
          });
        };
      }

      // Customer: Reopen Ticket
      if (document.getElementById('btn-cust-reopen')) {
        document.getElementById('btn-cust-reopen').onclick = () => {
          const content = `
            <div class="form-group">
              <label class="form-label">Why are you reopening this complaint? *</label>
              <textarea id="reopen-reason" class="form-control" style="min-height: 90px;" placeholder="Please explain what is still not working..." required></textarea>
            </div>
          `;

          modal.open({
            title: `↺ Reopen Complaint – ${t.ticket_id}`,
            content,
            footerButtons: [
              { text: 'Cancel', className: 'btn-outline' },
              {
                text: 'Confirm Reopen',
                className: 'btn-danger',
                onClick: async (close) => {
                  const reason = document.getElementById('reopen-reason').value;
                  if (!reason.trim()) {
                    toast.error('A reason is mandatory when reopening.');
                    return;
                  }
                  try {
                    await api.post(`/tickets/${t.ticket_id}/status`, {
                      new_status: 'REOPENED',
                      reason
                    });
                    toast.warning('Complaint reopened and escalated to support desk.');
                    close();
                    loadDetail();
                  } catch (err) {
                    toast.error(err.message);
                  }
                }
              }
            ]
          });
        };
      }

    } catch (err) {
      toast.error(err.message);
    }
  }

  loadDetail();
}
