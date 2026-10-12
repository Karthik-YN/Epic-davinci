/**
 * settings.js — Application Settings & Data Management Page
 * Handles daily nutrition targets, waist measurements, budget configuration,
 * validation limits, JSON/CSV data export, and database backup/restore guidance.
 */

import {
  api, showToast, formatDate, escapeHtml, getActiveChallenge,
  CHALLENGE_START, CHALLENGE_END, REVIEW_DATE, TOTAL_DAYS,
} from '../utils.js';

// Daily nutrition targets shown on every Daily Log
const NUTRITION_FIELDS = [
  { key: 'calorie_target_kcal', label: 'Calories',  unit: 'kcal', step: '10',  icon: '🔥' },
  { key: 'protein_target_g',    label: 'Protein',   unit: 'g',    step: '1',   icon: '🥩' },
  { key: 'carbs_target_g',      label: 'Carbs',     unit: 'g',    step: '1',   icon: '🍚' },
  { key: 'fat_target_g',        label: 'Fat',       unit: 'g',    step: '1',   icon: '🥑' },
  { key: 'fiber_target_g',      label: 'Fiber',     unit: 'g',    step: '1',   icon: '🥦' },
  { key: 'water_target_l',      label: 'Water',     unit: 'L',    step: '0.1', icon: '💧' },
];

export class Settings {
  async render(container) {
    container.innerHTML = `
      <div class="settings-page">
        <header class="page-header mb-6">
          <h1 class="page-title">Application Settings</h1>
          <p class="page-subtitle text-muted">Configure nutrition targets, challenge parameters, waist measurements, and data backups</p>
        </header>

        <div id="settings-content" class="flex flex-col gap-6">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    try {
      const settings = await api.get('/api/settings');
      this._renderSettings(container, settings);
    } catch (err) {
      container.querySelector('#settings-content').innerHTML = `
        <div class="card p-6 text-center text-error">
          Failed to load settings: ${err.message}
        </div>
      `;
    }
  }

  _renderSettings(container, settings) {
    const content = container.querySelector('#settings-content');
    const challenge = getActiveChallenge();

    content.innerHTML = `
      <!-- Challenge Metadata Card -->
      <div class="card p-6">
        <div class="flex justify-between items-center flex-wrap gap-3 mb-4">
          <h2 class="text-xl font-bold flex items-center gap-2">
            <span>📅</span> ${challenge ? escapeHtml(challenge.name) : 'Challenge Overview'}
          </h2>
          <a href="#challenges" class="btn btn-secondary btn-sm">${challenge ? 'Change dates / switch' : 'Choose a challenge'}</a>
        </div>
        ${challenge ? `
          <div class="grid-3 gap-4">
            <div class="p-3 bg-surface-2 rounded-md">
              <div class="text-xs text-muted">Start Date</div>
              <div class="font-bold mt-1">${formatDate(CHALLENGE_START)}</div>
            </div>
            <div class="p-3 bg-surface-2 rounded-md">
              <div class="text-xs text-muted">End Date (${TOTAL_DAYS} days)</div>
              <div class="font-bold mt-1">${formatDate(CHALLENGE_END)}</div>
            </div>
            <div class="p-3 bg-surface-2 rounded-md">
              <div class="text-xs text-muted">Final Review Date</div>
              <div class="font-bold mt-1">${formatDate(REVIEW_DATE)}</div>
            </div>
          </div>
        ` : `
          <p class="text-sm text-muted">No challenge selected. Dates are set per challenge in the Challenges page.</p>
        `}
      </div>

      <!-- Settings Form -->
      <form id="settings-form" class="flex flex-col gap-6" onsubmit="return false;">
        <!-- Daily Nutrition Targets -->
        <div class="card p-6">
          <h2 class="text-xl font-bold mb-1 flex items-center gap-2">
            <span>🍽️</span> Daily Nutrition Targets
          </h2>
          <p class="text-sm text-muted mb-4">Your daily goals. Each Daily Log shows what you've eaten against these. Leave a field empty to hide it.</p>
          <div class="grid-3 gap-4">
            ${NUTRITION_FIELDS.map(f => `
              <div class="form-group">
                <label for="${f.key}">${f.icon} ${f.label} target</label>
                <div class="input-with-unit">
                  <input type="number" step="${f.step}" min="0" id="${f.key}" name="${f.key}" value="${settings[f.key] ?? ''}">
                  <span class="unit">${f.unit}</span>
                </div>
                <span class="field-error" id="err-${f.key}"></span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Waist Measurements -->
        <div class="card p-6">
          <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📏</span> Waist Circumference Measurements
          </h2>
          <div class="grid-2 gap-4">
            <div class="form-group">
              <label for="waist_start_cm">Starting Waist Circumference (cm)</label>
              <div class="input-with-unit">
                <input type="number" step="0.1" id="waist_start_cm" name="waist_start_cm" value="${settings.waist_start_cm ?? ''}" placeholder="e.g. 85.0" min="0">
                <span class="unit">cm</span>
              </div>
            </div>

            <div class="form-group">
              <label for="waist_start_date">Starting Measurement Date</label>
              <input type="date" id="waist_start_date" name="waist_start_date" value="${settings.waist_start_date ?? CHALLENGE_START}">
            </div>

            <div class="form-group">
              <label for="waist_end_cm">Ending Waist Circumference (cm)</label>
              <div class="input-with-unit">
                <input type="number" step="0.1" id="waist_end_cm" name="waist_end_cm" value="${settings.waist_end_cm ?? ''}" placeholder="e.g. 82.5" min="0">
                <span class="unit">cm</span>
              </div>
            </div>

            <div class="form-group">
              <label for="waist_end_date">Ending Measurement Date</label>
              <input type="date" id="waist_end_date" name="waist_end_date" value="${settings.waist_end_date ?? CHALLENGE_END}">
            </div>
          </div>
        </div>

        <!-- Budget & Range Settings -->
        <div class="card p-6">
          <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span> Budget & Input Boundaries
          </h2>
          <p class="text-sm text-muted mb-4">The budget applies to any challenge that doesn't set its own.</p>
          <div class="grid-3 gap-4">
            <div class="form-group">
              <label for="budget_inr">Extra Spending Budget (₹)</label>
              <div class="input-with-unit">
                <span class="unit-prefix">₹</span>
                <input type="number" id="budget_inr" name="budget_inr" value="${settings.budget_inr ?? 1500}" min="0">
              </div>
            </div>

            <div class="form-group">
              <label for="weight_min">Minimum Allowed Weight (kg)</label>
              <div class="input-with-unit">
                <input type="number" step="1" id="weight_min" name="weight_min" value="${settings.weight_min ?? 30}">
                <span class="unit">kg</span>
              </div>
            </div>

            <div class="form-group">
              <label for="weight_max">Maximum Allowed Weight (kg)</label>
              <div class="input-with-unit">
                <input type="number" step="1" id="weight_max" name="weight_max" value="${settings.weight_max ?? 200}">
                <span class="unit">kg</span>
              </div>
            </div>
          </div>

          <div class="mt-4 flex justify-end">
            <button type="button" id="save-settings-btn" class="btn btn-primary">
              Save Settings
            </button>
          </div>
        </div>
      </form>

      <!-- Data Export & Backup Section -->
      <div class="card p-6">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
          <span>💾</span> Data Backup & Export
        </h2>
        <p class="text-sm text-muted mb-4">
          Export your complete challenge logs and settings at any time to preserve records.
        </p>

        <div class="flex flex-wrap gap-4 mb-6">
          <a href="/api/export/json" download="epic-davinci-export.json" class="btn btn-primary">
            Export Data as JSON
          </a>
          <a href="/api/export/csv" download="epic-davinci-export.csv" class="btn btn-secondary">
            Export Data as CSV
          </a>
        </div>

        <div class="border-t pt-4">
          <h3 class="font-bold text-sm mb-2">Copy Saved on This Device:</h3>
          <p class="text-xs text-muted mb-2">
            Every change is also saved in this browser. If the server loses its data (Render's free plan
            resets it when the app sleeps or redeploys), the app puts this copy back automatically the
            next time you open it here.
          </p>
          <p class="text-xs text-muted">
            The copy lives only in this browser on this device — clearing site data removes it, so
            exporting JSON now and then is still a good extra backup.
          </p>
        </div>
      </div>
    `;

    // Bind save button event
    const saveBtn = content.querySelector('#save-settings-btn');
    saveBtn.addEventListener('click', () => this._saveSettings());
  }

  async _saveSettings() {
    const form = document.getElementById('settings-form');
    if (!form) return;

    const payload = {
      budget_inr: parseFloat(document.getElementById('budget_inr').value),
      weight_min: parseFloat(document.getElementById('weight_min').value),
      weight_max: parseFloat(document.getElementById('weight_max').value),
      waist_start_cm: document.getElementById('waist_start_cm').value ? parseFloat(document.getElementById('waist_start_cm').value) : null,
      waist_start_date: document.getElementById('waist_start_date').value || null,
      waist_end_cm: document.getElementById('waist_end_cm').value ? parseFloat(document.getElementById('waist_end_cm').value) : null,
      waist_end_date: document.getElementById('waist_end_date').value || null,
    };
    for (const { key } of NUTRITION_FIELDS) {
      const raw = document.getElementById(key).value;
      payload[key] = raw === '' ? null : parseFloat(raw);
    }

    form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });

    try {
      await api.put('/api/settings', payload);
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      for (const [field, msg] of Object.entries(err.data?.errors || {})) {
        const el = document.getElementById(`err-${field}`);
        if (el) el.textContent = msg;
      }
      showToast(err.message || 'Failed to save settings', 'error');
    }
  }
}
