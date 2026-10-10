/**
 * settings.js — Application Settings & Data Management Page
 * Handles waist measurements, budget configuration, validation limits,
 * JSON/CSV data export, and database backup/restore guidance.
 */

import { api, showToast, formatDate } from '../utils.js';

export class Settings {
  async render(container) {
    container.innerHTML = `
      <div class="settings-page">
        <header class="page-header mb-6">
          <h1 class="page-title">Application Settings</h1>
          <p class="page-subtitle text-muted">Configure challenge parameters, waist measurements, and data backups</p>
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

    content.innerHTML = `
      <!-- Challenge Metadata Card -->
      <div class="card p-6">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
          <span>📅</span> Challenge Overview
        </h2>
        <div class="grid-3 gap-4">
          <div class="p-3 bg-surface-2 rounded-md">
            <div class="text-xs text-muted">Start Date</div>
            <div class="font-bold mt-1">${formatDate(settings.start_date)}</div>
          </div>
          <div class="p-3 bg-surface-2 rounded-md">
            <div class="text-xs text-muted">End Date</div>
            <div class="font-bold mt-1">${formatDate(settings.end_date)}</div>
          </div>
          <div class="p-3 bg-surface-2 rounded-md">
            <div class="text-xs text-muted">Final Review Date</div>
            <div class="font-bold mt-1">${formatDate(settings.review_date)}</div>
          </div>
        </div>
      </div>

      <!-- Settings Form -->
      <form id="settings-form" class="flex flex-col gap-6" onsubmit="return false;">
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
              <input type="date" id="waist_start_date" name="waist_start_date" value="${settings.waist_start_date ?? '2026-10-12'}">
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
              <input type="date" id="waist_end_date" name="waist_end_date" value="${settings.waist_end_date ?? '2026-11-01'}">
            </div>
          </div>
        </div>

        <!-- Budget & Range Settings -->
        <div class="card p-6">
          <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span> Budget & Input Boundaries
          </h2>
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
          <h3 class="font-bold text-sm mb-2">Local Storage Location & Backup:</h3>
          <p class="text-xs text-muted mb-2">
            Your data is stored safely in a local SQLite file on your laptop:
          </p>
          <code class="block bg-surface-2 p-3 rounded text-xs font-mono mb-3">
            epic-davinci/data/tracker.db
          </code>
          <p class="text-xs text-muted">
            To create a manual backup, simply copy <code class="font-mono">tracker.db</code> to another directory or external drive while the application is running or stopped.
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

    try {
      await api.put('/api/settings', payload);
      showToast('Settings saved successfully', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error');
    }
  }
}
