/**
 * challenges.js — Challenge Hub (landing page)
 * Create a challenge by picking a start date and a duration (3, 7, 21 days or
 * any custom end date) plus a priority, then pick one from the list to enter it.
 */

import {
  api, showToast, showConfirm, escapeHtml, formatDate, formatDateShort,
  todayStr, addDays, daysInclusive, setActiveChallenge, getActiveChallenge,
  formatCurrency,
} from '../utils.js';
import { navigate } from '../app.js';
import { PRIORITY_LABELS } from '../sidebar.js';

const DURATION_PRESETS = [3, 7, 14, 21, 30, 45, 60, 90];
const PRIORITY_ORDER   = { high: 0, medium: 1, low: 2 };

export class ChallengeHub {
  constructor() {
    this.challenges = [];
    this.editing = null; // challenge being edited, or null when creating
  }

  async render(container) {
    container.innerHTML = `
      <div class="challenges-page">
        <header class="hub-hero mb-6">
          <div>
            <h1 class="page-title hero-title">Your Challenges</h1>
            <p class="page-subtitle">Pick your dates, set a priority, and step inside. 3 days, 7 days, 21 or more — whatever fits your mindset.</p>
          </div>
          <button type="button" class="btn btn-primary" id="new-challenge-btn">＋ New Challenge</button>
        </header>
        <div id="challenge-form-slot"></div>
        <div id="challenge-list" class="flex flex-col gap-6">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    container.querySelector('#new-challenge-btn').addEventListener('click', () => {
      this.editing = null;
      this._renderForm(container, true);
    });

    try {
      this.challenges = await api.get('/api/challenges');
    } catch (err) {
      container.querySelector('#challenge-list').innerHTML = `
        <div class="card p-6 text-center text-error">Failed to load challenges: ${escapeHtml(err.message)}</div>
      `;
      return;
    }

    // First visit: no challenges yet, so open the setup form straight away
    this._renderForm(container, this.challenges.length === 0);
    this._renderList(container);
  }

  // ─── Create / edit form ───────────────────────────────────────
  _renderForm(container, open) {
    const slot = container.querySelector('#challenge-form-slot');
    if (!open) {
      slot.innerHTML = '';
      return;
    }

    const c = this.editing;
    const start = c ? c.start_date : todayStr();
    const days  = c ? daysInclusive(c.start_date, c.end_date) : 21;
    const end   = c ? c.end_date : addDays(start, days - 1);
    const priority = c ? c.priority : 'medium';

    slot.innerHTML = `
      <form class="card challenge-form mb-6" id="challenge-form" novalidate>
        <div class="card-header">
          <div class="card-title">${c ? 'Edit challenge' : 'Set up a new challenge'}</div>
          ${this.challenges.length > 0 ? '<button type="button" class="btn btn-ghost btn-sm" id="cancel-form-btn">Cancel</button>' : ''}
        </div>

        <div class="grid-2 gap-4">
          <div class="form-group col-span-2">
            <label for="ch-name">Challenge name</label>
            <input type="text" id="ch-name" maxlength="100" value="${escapeHtml(c ? c.name : '')}" placeholder="e.g. 7-Day Reset, 21-Day Discipline Sprint">
            <span class="field-error" id="err-name"></span>
          </div>

          <div class="form-group col-span-2">
            <label>Duration</label>
            <div class="chip-row" id="duration-chips">
              ${DURATION_PRESETS.map(d => `
                <button type="button" class="chip ${d === days ? 'active' : ''}" data-days="${d}">${d} days</button>
              `).join('')}
              <button type="button" class="chip ${DURATION_PRESETS.includes(days) ? '' : 'active'}" data-days="custom">Custom</button>
            </div>
          </div>

          <div class="form-group">
            <label for="ch-start">Start date</label>
            <input type="date" id="ch-start" value="${start}">
            <span class="field-error" id="err-start_date"></span>
          </div>

          <div class="form-group">
            <label for="ch-end">End date</label>
            <input type="date" id="ch-end" value="${end}" min="${start}">
            <span class="field-error" id="err-end_date"></span>
          </div>

          <div class="form-group col-span-2">
            <div class="duration-summary" id="duration-summary"></div>
          </div>

          <div class="form-group col-span-2">
            <label>Priority</label>
            <div class="priority-picker" id="priority-picker">
              ${['high', 'medium', 'low'].map(p => `
                <button type="button" class="priority-option priority-${p} ${p === priority ? 'active' : ''}" data-priority="${p}">
                  <span class="priority-dot"></span>${PRIORITY_LABELS[p]}
                </button>
              `).join('')}
            </div>
          </div>

          <div class="form-group">
            <label for="ch-budget">Extra spending budget (₹, optional)</label>
            <div class="input-with-unit">
              <span class="unit-prefix">₹</span>
              <input type="number" id="ch-budget" min="0" step="1" value="${c?.budget_inr ?? ''}" placeholder="Uses the budget in Settings">
            </div>
            <span class="field-error" id="err-budget_inr"></span>
          </div>

          <div class="form-group">
            <label for="ch-description">Goal / description (optional)</label>
            <input type="text" id="ch-description" maxlength="300" value="${escapeHtml(c?.description ?? '')}" placeholder="What do you want out of this challenge?">
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-4">
          <button type="submit" class="btn btn-primary">${c ? 'Save changes' : 'Create & start →'}</button>
        </div>
      </form>
    `;

    const form    = slot.querySelector('#challenge-form');
    const startEl = form.querySelector('#ch-start');
    const endEl   = form.querySelector('#ch-end');
    const chips   = form.querySelectorAll('#duration-chips .chip');
    let selectedPriority = priority;

    const setActiveChip = (days) => {
      chips.forEach(ch => {
        const match = ch.dataset.days === 'custom'
          ? !DURATION_PRESETS.includes(days)
          : Number(ch.dataset.days) === days;
        ch.classList.toggle('active', match);
      });
    };

    const updateSummary = () => {
      const summary = form.querySelector('#duration-summary');
      endEl.min = startEl.value || '';
      if (!startEl.value || !endEl.value || endEl.value < startEl.value) {
        summary.textContent = 'Choose a start date and an end date on or after it.';
        summary.classList.add('invalid');
        return;
      }
      const total = daysInclusive(startEl.value, endEl.value);
      summary.classList.remove('invalid');
      summary.textContent = `${total} day${total !== 1 ? 's' : ''} · ${formatDate(startEl.value)} → ${formatDate(endEl.value)} · Final review ${formatDate(addDays(endEl.value, 1))}`;
      setActiveChip(total);
    };

    chips.forEach(chip => chip.addEventListener('click', () => {
      if (chip.dataset.days === 'custom') {
        setActiveChip(-1);
        endEl.focus();
        endEl.showPicker?.();
        return;
      }
      if (!startEl.value) startEl.value = todayStr();
      endEl.value = addDays(startEl.value, Number(chip.dataset.days) - 1);
      updateSummary();
    }));

    // Moving the start date keeps the chosen duration
    let lastStart = startEl.value;
    startEl.addEventListener('change', () => {
      if (lastStart && endEl.value && startEl.value) {
        const total = daysInclusive(lastStart, endEl.value);
        if (total > 0) endEl.value = addDays(startEl.value, total - 1);
      }
      lastStart = startEl.value;
      updateSummary();
    });
    endEl.addEventListener('change', updateSummary);

    form.querySelectorAll('.priority-option').forEach(btn => btn.addEventListener('click', () => {
      selectedPriority = btn.dataset.priority;
      form.querySelectorAll('.priority-option').forEach(b => b.classList.toggle('active', b === btn));
    }));

    form.querySelector('#cancel-form-btn')?.addEventListener('click', () => {
      this.editing = null;
      this._renderForm(container, false);
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._submit(container, form, selectedPriority);
    });

    updateSummary();
    if (!c) form.querySelector('#ch-name').focus();
    slot.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async _submit(container, form, priority) {
    form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });

    const budgetRaw = form.querySelector('#ch-budget').value;
    const payload = {
      name: form.querySelector('#ch-name').value.trim(),
      start_date: form.querySelector('#ch-start').value,
      end_date: form.querySelector('#ch-end').value,
      priority,
      budget_inr: budgetRaw === '' ? null : Number(budgetRaw),
      description: form.querySelector('#ch-description').value.trim() || null,
    };

    // Overlapping challenges share the same daily logs, so make that explicit
    const overlap = this.challenges.find(ch =>
      ch.id !== this.editing?.id &&
      payload.start_date && payload.end_date &&
      ch.start_date <= payload.end_date && ch.end_date >= payload.start_date
    );
    if (overlap) {
      const ok = await showConfirm(
        `These dates overlap with "${overlap.name}". Days that fall in both challenges share the same daily log. Continue?`
      );
      if (!ok) return;
    }

    try {
      const saved = this.editing
        ? await api.put(`/api/challenges/${this.editing.id}`, payload)
        : await api.post('/api/challenges', payload);

      if (this.editing) {
        showToast('Challenge updated', 'success');
        if (getActiveChallenge()?.id === saved.id) setActiveChallenge(saved);
        this.editing = null;
        await this.render(container);
      } else {
        showToast(`"${saved.name}" created — let's go!`, 'success');
        setActiveChallenge(saved);
        navigate('dashboard');
      }
    } catch (err) {
      if (err.data?.errors) {
        for (const [field, msg] of Object.entries(err.data.errors)) {
          const el = form.querySelector(`#err-${field}`);
          if (el) el.textContent = msg;
        }
      }
      showToast(err.message || 'Failed to save challenge', 'error');
    }
  }

  // ─── List ─────────────────────────────────────────────────────
  _renderList(container) {
    const list = container.querySelector('#challenge-list');
    const today = todayStr();

    if (this.challenges.length === 0) {
      list.innerHTML = '';
      return;
    }

    const byPriority = (a, b) =>
      (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) || a.start_date.localeCompare(b.start_date);

    const groups = [
      { title: '🔥 Active now', items: this.challenges.filter(c => c.start_date <= today && c.end_date >= today).sort(byPriority) },
      { title: '🗓️ Upcoming',   items: this.challenges.filter(c => c.start_date > today).sort(byPriority) },
      { title: '🏁 Completed',  items: this.challenges.filter(c => c.end_date < today).sort((a, b) => b.end_date.localeCompare(a.end_date)) },
    ].filter(g => g.items.length > 0);

    const activeId = getActiveChallenge()?.id;

    list.innerHTML = groups.map(g => `
      <section>
        <h2 class="hub-group-title">${g.title} <span class="hub-group-count">${g.items.length}</span></h2>
        <div class="challenge-grid">
          ${g.items.map(c => this._renderCard(c, today, c.id === activeId)).join('')}
        </div>
      </section>
    `).join('');

    list.querySelectorAll('.challenge-card').forEach(card => {
      const challenge = this.challenges.find(c => c.id === Number(card.dataset.id));

      const open = () => {
        setActiveChallenge(challenge);
        navigate('dashboard');
      };
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        open();
      });
      card.addEventListener('keydown', (e) => {
        if (e.target === card && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          open();
        }
      });
      card.querySelector('.open-btn').addEventListener('click', open);

      card.querySelector('.edit-btn').addEventListener('click', () => {
        this.editing = challenge;
        this._renderForm(container, true);
      });

      card.querySelector('.delete-btn').addEventListener('click', async () => {
        const ok = await showConfirm(
          `Delete "${challenge.name}" and its notes? Your daily logs for these dates are kept.`
        );
        if (!ok) return;
        try {
          await api.delete(`/api/challenges/${challenge.id}`);
          if (getActiveChallenge()?.id === challenge.id) setActiveChallenge(null);
          showToast('Challenge deleted', 'success');
          await this.render(container);
        } catch (err) {
          showToast(err.message || 'Failed to delete challenge', 'error');
        }
      });
    });
  }

  _renderCard(c, today, isActive) {
    const total = c.total_days;
    let status, statusClass, pct;
    if (today < c.start_date) {
      const until = daysInclusive(today, c.start_date) - 1;
      status = `Starts in ${until} day${until !== 1 ? 's' : ''}`;
      statusClass = 'status-upcoming';
      pct = 0;
    } else if (today > c.end_date) {
      status = 'Completed';
      statusClass = 'status-done';
      pct = 100;
    } else {
      const day = daysInclusive(c.start_date, today);
      status = `Day ${day} of ${total}`;
      statusClass = 'status-active';
      pct = Math.round((day / total) * 100);
    }

    return `
      <article class="challenge-card priority-${escapeHtml(c.priority)} ${isActive ? 'is-current' : ''}" data-id="${c.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(c.name)}">
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="priority-pill priority-${escapeHtml(c.priority)}">${PRIORITY_LABELS[c.priority] || 'Medium'}</span>
          <span class="status-pill ${statusClass}">${status}</span>
        </div>
        <h3 class="challenge-card-name">${escapeHtml(c.name)}</h3>
        ${c.description ? `<p class="challenge-card-desc">${escapeHtml(c.description)}</p>` : ''}
        <div class="challenge-card-dates">${formatDateShort(c.start_date)} → ${formatDate(c.end_date)} · <strong>${total} days</strong></div>
        <div class="progress-bar mt-3"><div class="progress-bar-fill" style="width:${pct}%"></div></div>
        <div class="challenge-card-meta">
          <span>✅ ${c.days_logged}/${total} logged</span>
          <span>📌 ${c.notes_count} note${c.notes_count !== 1 ? 's' : ''}</span>
          ${c.budget_inr != null ? `<span>💰 ${formatCurrency(c.budget_inr)}</span>` : ''}
        </div>
        <div class="challenge-card-actions">
          <button type="button" class="btn btn-primary btn-sm open-btn">${isActive ? 'Continue →' : 'Enter →'}</button>
          <button type="button" class="btn btn-ghost btn-sm edit-btn">Edit</button>
          <button type="button" class="btn btn-ghost btn-sm delete-btn">Delete</button>
        </div>
      </article>
    `;
  }
}
