/**
 * sidebar.js — Active challenge card + priorities & notes panel
 * Rendered into the sidebar whenever a challenge is selected. On mobile the
 * sidebar slides in as a drawer from the top bar's "Notes" button.
 */

import {
  api, showToast, showConfirm, escapeHtml, formatDate, formatDateShort,
  getActiveChallenge, getChallengeDay, todayStr, TOTAL_DAYS, REVIEW_DATE,
} from './utils.js';

export const NOTE_CATEGORIES = [
  { key: 'priority',  label: 'Priority',  icon: '🎯' },
  { key: 'important', label: 'Important', icon: '⚠️' },
  { key: 'reminder',  label: 'Reminder',  icon: '⏰' },
  { key: 'note',      label: 'Note',      icon: '📝' },
];

export const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

let _notes = [];

/** Wire up drawer controls and re-render on challenge changes. Call once on boot. */
export function initSidebar() {
  window.addEventListener('challenge-changed', () => renderSidebar());

  document.getElementById('mobile-notes-btn')?.addEventListener('click', () => _toggleDrawer());
  document.getElementById('sidebar-backdrop')?.addEventListener('click', () => _toggleDrawer(false));
  // Close the drawer after following a nav link on mobile
  document.getElementById('sidebar')?.addEventListener('click', (e) => {
    if (e.target.closest('.nav-link')) _toggleDrawer(false);
  });

  renderSidebar();
}

/** Re-render the challenge card and notes for the active challenge. */
export async function renderSidebar() {
  const challenge = getActiveChallenge();
  document.body.classList.toggle('has-challenge', !!challenge);

  _renderChallengeCard(challenge);
  _renderMobileBar(challenge);

  const notesEl = document.getElementById('sidebar-notes');
  if (!notesEl) return;
  if (!challenge) {
    notesEl.innerHTML = '';
    _notes = [];
    return;
  }

  notesEl.innerHTML = '<div class="text-xs sidebar-muted">Loading notes…</div>';
  try {
    _notes = await api.get(`/api/challenges/${challenge.id}/notes`);
  } catch (err) {
    _notes = [];
    showToast(`Could not load notes: ${err.message}`, 'error');
  }
  // Challenge may have changed while the request was in flight
  if (getActiveChallenge()?.id !== challenge.id) return;
  _renderNotes(notesEl, challenge);
}

// ─── Challenge card ─────────────────────────────────────────────
function _renderChallengeCard(challenge) {
  const el = document.getElementById('sidebar-challenge');
  if (!el) return;

  if (!challenge) {
    el.innerHTML = `
      <div class="sidebar-challenge-empty">
        <div class="text-sm font-semibold">No challenge selected</div>
        <a href="#challenges" class="nav-link sidebar-switch" data-page="challenges">Choose or create one →</a>
      </div>
    `;
    return;
  }

  const today  = todayStr();
  const dayNum = getChallengeDay(today);
  const status = today < challenge.start_date ? 'Starts ' + formatDateShort(challenge.start_date)
    : today > challenge.end_date ? 'Completed'
    : `Day ${dayNum} of ${TOTAL_DAYS}`;
  const pct = dayNum ? Math.round((dayNum / TOTAL_DAYS) * 100) : (today > challenge.end_date ? 100 : 0);

  el.innerHTML = `
    <div class="sidebar-challenge-card priority-${escapeHtml(challenge.priority)}">
      <div class="flex items-center justify-between gap-2">
        <span class="priority-pill priority-${escapeHtml(challenge.priority)}">${PRIORITY_LABELS[challenge.priority] || 'Medium'} priority</span>
        <a href="#challenges" class="nav-link sidebar-switch" data-page="challenges">Switch</a>
      </div>
      <div class="sidebar-challenge-name">${escapeHtml(challenge.name)}</div>
      <div class="sidebar-challenge-dates">${formatDateShort(challenge.start_date)} – ${formatDate(challenge.end_date)} · ${TOTAL_DAYS} days</div>
      <div class="sidebar-progress"><div class="sidebar-progress-fill" style="width:${pct}%"></div></div>
      <div class="sidebar-challenge-status">${status} · Review ${formatDateShort(REVIEW_DATE)}</div>
    </div>
  `;
}

function _renderMobileBar(challenge) {
  const name = document.getElementById('mobile-challenge-name');
  if (name) name.textContent = challenge ? challenge.name : 'Epic Davinci';
}

// ─── Notes panel ────────────────────────────────────────────────
function _renderNotes(el, challenge) {
  const groups = NOTE_CATEGORIES
    .map(cat => ({ ...cat, items: _notes.filter(n => n.category === cat.key) }))
    .filter(g => g.items.length > 0);

  el.innerHTML = `
    <div class="sidebar-section-title">📌 Priorities & Notes</div>
    <form class="note-form" id="note-form" autocomplete="off">
      <select id="note-category" aria-label="Note type">
        ${NOTE_CATEGORIES.map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
      </select>
      <div class="note-input-row">
        <input type="text" id="note-content" maxlength="1000" placeholder="Add a priority or note…" aria-label="Note text">
        <button type="submit" class="btn btn-primary btn-sm" aria-label="Add note">Add</button>
      </div>
    </form>
    <div class="note-groups">
      ${groups.length === 0 ? `
        <p class="sidebar-muted text-xs">Nothing yet. Add your top priorities and important reminders for this challenge — they'll stay here on every page.</p>
      ` : groups.map(g => `
        <div class="note-group">
          <div class="note-group-title cat-${g.key}">${g.icon} ${g.label}</div>
          <ul class="note-list">
            ${g.items.map(n => `
              <li class="note-item ${n.done ? 'done' : ''}" data-id="${n.id}">
                <input type="checkbox" class="note-done" ${n.done ? 'checked' : ''} aria-label="Mark as done">
                <span class="note-text">${escapeHtml(n.content)}</span>
                <button type="button" class="note-delete" aria-label="Delete note">×</button>
              </li>
            `).join('')}
          </ul>
        </div>
      `).join('')}
    </div>
  `;

  el.querySelector('#note-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = el.querySelector('#note-content');
    const content = input.value.trim();
    if (!content) return;
    try {
      const note = await api.post(`/api/challenges/${challenge.id}/notes`, {
        category: el.querySelector('#note-category').value,
        content,
      });
      _notes.push(note);
      _sortNotes();
      _renderNotes(el, challenge);
      el.querySelector('#note-content').focus();
    } catch (err) {
      showToast(err.message || 'Failed to add note', 'error');
    }
  });

  el.querySelectorAll('.note-item').forEach(item => {
    const id = Number(item.dataset.id);

    item.querySelector('.note-done').addEventListener('change', async (e) => {
      try {
        const updated = await api.put(`/api/challenges/${challenge.id}/notes/${id}`, { done: e.target.checked ? 1 : 0 });
        _notes = _notes.map(n => (n.id === id ? updated : n));
        _sortNotes();
        _renderNotes(el, challenge);
      } catch (err) {
        e.target.checked = !e.target.checked;
        showToast(err.message || 'Failed to update note', 'error');
      }
    });

    item.querySelector('.note-delete').addEventListener('click', async () => {
      const ok = await showConfirm('Delete this note?');
      if (!ok) return;
      try {
        await api.delete(`/api/challenges/${challenge.id}/notes/${id}`);
        _notes = _notes.filter(n => n.id !== id);
        _renderNotes(el, challenge);
      } catch (err) {
        showToast(err.message || 'Failed to delete note', 'error');
      }
    });
  });
}

/** Same order as the API: open items first, then by category, then oldest first. */
function _sortNotes() {
  const rank = Object.fromEntries(NOTE_CATEGORIES.map((c, i) => [c.key, i]));
  _notes.sort((a, b) => (a.done - b.done) || (rank[a.category] - rank[b.category]) || (a.id - b.id));
}

// ─── Mobile drawer ──────────────────────────────────────────────
function _toggleDrawer(force) {
  const open = force ?? !document.body.classList.contains('sidebar-open');
  document.body.classList.toggle('sidebar-open', open);
}
