/**
 * dailyLog.js — Core daily habit and metric logging page
 * Handles all 12 sections:
 *  1. Fitness
 *  2. Nutrition & Hydration
 *  3. Sleep
 *  4. Career — AI/ML & DSA
 *  5. Oral, Skin & Hair Care
 *  6. Spirituality
 *  7. Mental Discipline
 *  8. Personal Growth
 *  9. Personal Care & Routine
 * 10. Financial Discipline
 * 11. Daily Reflection
 * 12. Daily Planning
 */

import {
  api,
  showToast,
  formatDate,
  getChallengeDay,
  todayStr,
  isValidChallengeDate,
  CHALLENGE_START,
  CHALLENGE_END,
  TOTAL_DAYS,
  withChallenge,
  calculateSleepHours,
  debounce,
  formatDuration,
  formatCurrency,
  setSaveStatus,
} from '../utils.js';

// Daily nutrition targets (from Settings) shown against what was logged.
// `limit: true` means going over the target is a warning rather than a win.
const NUTRITION_TARGETS = [
  { field: 'calories_kcal', target: 'calorie_target_kcal', label: 'Calories', unit: 'kcal', icon: '🔥', limit: true },
  { field: 'protein_g',     target: 'protein_target_g',    label: 'Protein',  unit: 'g',    icon: '🥩' },
  { field: 'carbs_g',       target: 'carbs_target_g',      label: 'Carbs',    unit: 'g',    icon: '🍚', limit: true },
  { field: 'fat_g',         target: 'fat_target_g',        label: 'Fat',      unit: 'g',    icon: '🥑', limit: true },
  { field: 'fiber_g',       target: 'fiber_target_g',      label: 'Fiber',    unit: 'g',    icon: '🥦' },
  { field: 'water_l',       target: 'water_target_l',      label: 'Water',    unit: 'L',    icon: '💧' },
];

export class DailyLog {
  constructor() {
    this.currentDate = null;
    this.formData = {};
    this.targets = {};
    this._isDirty = false;
    this._debouncedSave = debounce(() => this.save(), 1500);
  }

  isDirty() {
    return this._isDirty;
  }

  async render(container, params = {}) {
    // 1. Determine target date
    const today = todayStr();
    let targetDate = params.date || today;

    if (!isValidChallengeDate(targetDate)) {
      // If outside challenge, clamp to challenge start or end
      if (targetDate < CHALLENGE_START) targetDate = CHALLENGE_START;
      else if (targetDate > CHALLENGE_END) targetDate = CHALLENGE_END;
    }

    this.currentDate = targetDate;
    this._isDirty = false;

    // 2. Render shell structure
    container.innerHTML = `
      <div class="daily-log-page">
        <!-- Date Header & Nav -->
        <header class="page-header flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="page-title mb-0" id="log-date-display">${formatDate(this.currentDate)}</h1>
              <span class="badge badge-accent" id="log-day-badge">Day ${getChallengeDay(this.currentDate) || '?'} of ${TOTAL_DAYS}</span>
            </div>
            <p class="page-subtitle text-muted mt-1" id="log-date-status"></p>
          </div>

          <!-- Date Navigation Bar -->
          <div class="flex items-center gap-2 w-full md:w-auto justify-between">
            <button id="prev-day-btn" class="btn btn-secondary btn-sm" aria-label="Previous day">
              ← Prev
            </button>
            <input type="date" id="date-picker" value="${this.currentDate}" min="${CHALLENGE_START}" max="${CHALLENGE_END}" class="input-date-picker">
            <button id="next-day-btn" class="btn btn-secondary btn-sm" aria-label="Next day">
              Next →
            </button>
            <button id="manual-save-btn" class="btn btn-primary btn-sm ml-2">
              Save
            </button>
          </div>
        </header>

        <!-- Main Form Container -->
        <form id="daily-log-form" onsubmit="return false;" class="flex flex-col gap-6">
          <div id="form-sections" class="flex flex-col gap-6">
            <div class="page-loading"><div class="spinner"></div></div>
          </div>
        </form>
      </div>
    `;

    // 3. Bind navigation controls
    this._bindHeaderEvents(container);

    // Nutrition targets are app-wide settings; a failure just hides the comparison
    this.targets = await api.get('/api/settings').catch(() => ({}));

    // 4. Fetch data for selected date
    await this._loadDateData();
  }

  _bindHeaderEvents(container) {
    const prevBtn = container.querySelector('#prev-day-btn');
    const nextBtn = container.querySelector('#next-day-btn');
    const picker  = container.querySelector('#date-picker');
    const saveBtn = container.querySelector('#manual-save-btn');

    prevBtn.addEventListener('click', () => {
      const prev = this._offsetDate(this.currentDate, -1);
      if (isValidChallengeDate(prev)) {
        window.location.hash = `#daily-log?date=${prev}`;
      }
    });

    nextBtn.addEventListener('click', () => {
      const next = this._offsetDate(this.currentDate, 1);
      if (isValidChallengeDate(next)) {
        window.location.hash = `#daily-log?date=${next}`;
      }
    });

    picker.addEventListener('change', (e) => {
      const dateVal = e.target.value;
      if (isValidChallengeDate(dateVal)) {
        window.location.hash = `#daily-log?date=${dateVal}`;
      } else {
        showToast(`Selected date is outside this ${TOTAL_DAYS}-day challenge window`, 'warning');
        e.target.value = this.currentDate;
      }
    });

    saveBtn.addEventListener('click', () => this.save());
  }

  _offsetDate(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  async _loadDateData() {
    // Update header status
    const prevBtn = document.getElementById('prev-day-btn');
    const nextBtn = document.getElementById('next-day-btn');
    const statusText = document.getElementById('log-date-status');

    const prevDate = this._offsetDate(this.currentDate, -1);
    const nextDate = this._offsetDate(this.currentDate, 1);

    if (prevBtn) prevBtn.disabled = !isValidChallengeDate(prevDate);
    if (nextBtn) nextBtn.disabled = !isValidChallengeDate(nextDate);

    const today = todayStr();
    if (statusText) {
      if (this.currentDate === today) {
        statusText.textContent = "Today's daily record";
      } else if (this.currentDate < today) {
        statusText.textContent = "Viewing past record";
      } else {
        statusText.textContent = "Future date record";
      }
    }

    try {
      const record = await api.get(`/api/logs/${this.currentDate}`);
      this.formData = record || {};
    } catch (err) {
      if (err.status === 404) {
        this.formData = { date: this.currentDate };
      } else {
        showToast(err.message, 'error');
        this.formData = { date: this.currentDate };
      }
    }

    this._renderSections();
  }

  _renderSections() {
    const container = document.getElementById('form-sections');
    if (!container) return;

    container.innerHTML = `
      ${this._renderFitnessSection()}
      ${this._renderNutritionSection()}
      ${this._renderSleepSection()}
      ${this._renderCareerSection()}
      ${this._renderGroomingSection()}
      ${this._renderSpiritualitySection()}
      ${this._renderMentalDisciplineSection()}
      ${this._renderPersonalGrowthSection()}
      ${this._renderPersonalCareSection()}
      ${this._renderFinancialSection()}
      ${this._renderReflectionSection()}
      ${this._renderPlanningSection()}
    `;

    this._bindFormEvents(container);
  }

  // ─── Section Renderers ───────────────────────────────────────────

  _renderSectionCard(id, title, icon, contentHtml) {
    return `
      <section class="card section-card" id="section-${id}">
        <button type="button" class="section-toggle" aria-expanded="true" aria-controls="body-${id}">
          <div class="flex items-center gap-3">
            <span class="section-icon">${icon}</span>
            <h2 class="section-title mb-0">${title}</h2>
          </div>
          <span class="toggle-icon">▼</span>
        </button>
        <div class="section-body mt-4" id="body-${id}">
          ${contentHtml}
        </div>
      </section>
    `;
  }

  _renderYnToggle(field, value, labels = { 1: 'Yes', 0: 'No' }) {
    const v = value === undefined ? null : value;
    return `
      <div class="yn-toggle" data-field="${field}">
        <button type="button" class="yn-btn yes ${v === 1 ? 'active' : ''}" data-val="1">${labels[1]}</button>
        <button type="button" class="yn-btn no ${v === 0 ? 'active' : ''}" data-val="0">${labels[0]}</button>
      </div>
    `;
  }

  _renderHairCareToggle(value) {
    const v = value === undefined ? null : value;
    return `
      <div class="hair-toggle flex gap-1" data-field="hair_care">
        <button type="button" class="yn-btn yes ${v === 1 ? 'active' : ''}" data-val="1">Completed</button>
        <button type="button" class="yn-btn no ${v === 0 ? 'active' : ''}" data-val="0">Not completed</button>
        <button type="button" class="yn-btn neutral ${v === 2 ? 'active' : ''}" data-val="2">Not scheduled</button>
      </div>
    `;
  }

  // 1. Fitness
  _renderFitnessSection() {
    const d = this.formData;
    const workoutOptions = [
      '', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Upper Body', 'Full Body', 'Cardio', 'Recovery', 'Rest', 'Other'
    ];

    const content = `
      <div class="grid-2 gap-4">
        <div class="form-group">
          <label for="weight_kg">Morning Body Weight (kg)</label>
          <div class="input-with-unit">
            <input type="number" step="0.1" id="weight_kg" name="weight_kg" value="${d.weight_kg ?? ''}" placeholder="e.g. 72.5" min="30" max="200">
            <span class="unit">kg</span>
          </div>
          <span class="field-error" id="err-weight_kg"></span>
        </div>

        <div class="form-group">
          <label for="workout_type">Workout Type</label>
          <select id="workout_type" name="workout_type">
            ${workoutOptions.map(o => `<option value="${o}" ${d.workout_type === o ? 'selected' : ''}>${o || 'Select workout type…'}</option>`).join('')}
          </select>
        </div>

        <div class="form-group col-span-2">
          <label for="workout_notes">Workout Notes</label>
          <input type="text" id="workout_notes" name="workout_notes" value="${this._escape(d.workout_notes)}" placeholder="Optional workout details…">
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Cardio Completed</label>
          ${this._renderYnToggle('cardio_completed', d.cardio_completed)}
        </div>

        <div class="form-group">
          <label for="cardio_duration_min">Cardio Duration (minutes)</label>
          <div class="input-with-unit">
            <input type="number" id="cardio_duration_min" name="cardio_duration_min" value="${d.cardio_duration_min ?? ''}" placeholder="e.g. 30" min="0">
            <span class="unit">min</span>
          </div>
        </div>

        <div class="form-group">
          <label for="total_steps">Total Daily Steps</label>
          <div class="input-with-unit">
            <input type="number" id="total_steps" name="total_steps" value="${d.total_steps ?? ''}" placeholder="e.g. 10000" min="0" step="1">
            <span class="unit">steps</span>
          </div>
          <span class="field-error" id="err-total_steps"></span>
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Plank Completed</label>
          ${this._renderYnToggle('plank_completed', d.plank_completed)}
        </div>

        <div class="form-group">
          <label for="plank_duration_sec">Plank Duration (seconds)</label>
          <div class="input-with-unit">
            <input type="number" id="plank_duration_sec" name="plank_duration_sec" value="${d.plank_duration_sec ?? ''}" placeholder="e.g. 120" min="0">
            <span class="unit">sec</span>
          </div>
        </div>
      </div>
    `;
    return this._renderSectionCard('fitness', '1. Fitness', '🏋️', content);
  }

  // 2. Nutrition & Hydration
  _renderNutritionSection() {
    const d = this.formData;
    const content = `
      <div class="nutrition-targets mb-4" id="nutrition-targets">
        ${this._renderNutritionTargets()}
      </div>
      <div class="grid-2 gap-4">
        <div class="form-group">
          <label for="calories_kcal">Total Calories Consumed (kcal) ${this._targetHint('calorie_target_kcal', 'kcal')}</label>
          <div class="input-with-unit">
            <input type="number" id="calories_kcal" name="calories_kcal" value="${d.calories_kcal ?? ''}" placeholder="e.g. 2200" min="0">
            <span class="unit">kcal</span>
          </div>
        </div>

        <div class="form-group">
          <label for="protein_g">Total Protein Consumed (g) ${this._targetHint('protein_target_g', 'g')}</label>
          <div class="input-with-unit">
            <input type="number" step="0.1" id="protein_g" name="protein_g" value="${d.protein_g ?? ''}" placeholder="e.g. 140" min="0">
            <span class="unit">g</span>
          </div>
        </div>

        <div class="form-group">
          <label for="carbs_g">Total Carbs Consumed (g) ${this._targetHint('carbs_target_g', 'g')}</label>
          <div class="input-with-unit">
            <input type="number" step="0.1" id="carbs_g" name="carbs_g" value="${d.carbs_g ?? ''}" placeholder="e.g. 220" min="0">
            <span class="unit">g</span>
          </div>
        </div>

        <div class="form-group">
          <label for="fat_g">Total Fat Consumed (g) ${this._targetHint('fat_target_g', 'g')}</label>
          <div class="input-with-unit">
            <input type="number" step="0.1" id="fat_g" name="fat_g" value="${d.fat_g ?? ''}" placeholder="e.g. 70" min="0">
            <span class="unit">g</span>
          </div>
        </div>

        <div class="form-group">
          <label for="fiber_g">Total Fiber Consumed (g) ${this._targetHint('fiber_target_g', 'g')}</label>
          <div class="input-with-unit">
            <input type="number" step="0.1" id="fiber_g" name="fiber_g" value="${d.fiber_g ?? ''}" placeholder="e.g. 30" min="0">
            <span class="unit">g</span>
          </div>
        </div>

        <div class="form-group">
          <label for="water_l">Total Water Intake (L) ${this._targetHint('water_target_l', 'L')}</label>
          <div class="input-with-unit">
            <input type="number" step="0.1" id="water_l" name="water_l" value="${d.water_l ?? ''}" placeholder="e.g. 3.5" min="0">
            <span class="unit">L</span>
          </div>
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Fruits & Vegetables Eaten</label>
          ${this._renderYnToggle('fruits_veggies', d.fruits_veggies)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Junk / Outside Food Consumed</label>
          ${this._renderYnToggle('junk_food', d.junk_food)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Stayed Within Calorie Target</label>
          ${this._renderYnToggle('within_calorie_target', d.within_calorie_target)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Planned Tomorrow's Meals</label>
          ${this._renderYnToggle('planned_meals_tomorrow', d.planned_meals_tomorrow)}
        </div>

        <div class="form-group col-span-2">
          <label for="nutrition_notes">Nutrition Notes</label>
          <input type="text" id="nutrition_notes" name="nutrition_notes" value="${this._escape(d.nutrition_notes)}" placeholder="Optional notes on meals…">
        </div>
      </div>
    `;
    return this._renderSectionCard('nutrition', '2. Nutrition & Hydration', '🥗', content);
  }

  _targetHint(targetKey, unit) {
    const t = this.targets?.[targetKey];
    return t != null ? `<span class="target-hint">Target ${t} ${unit}</span>` : '';
  }

  /** Progress tiles: logged value vs the daily target from Settings. */
  _renderNutritionTargets() {
    const d = this.formData;
    const tiles = NUTRITION_TARGETS.map(({ field, target, label, unit, icon, limit }) => {
      const goal  = this.targets?.[target];
      const value = d[field];
      if (goal == null) return '';

      const pct = goal > 0 && value != null ? Math.round((value / goal) * 100) : 0;
      let state = 'pending';
      let note  = 'Not logged yet';
      if (value != null) {
        const diff = Math.round((goal - value) * 10) / 10;
        if (limit) {
          state = pct > 110 ? 'over' : pct >= 90 ? 'hit' : 'under';
          note  = diff >= 0 ? `${diff} ${unit} left` : `${Math.abs(diff)} ${unit} over`;
        } else {
          state = pct >= 100 ? 'hit' : 'under';
          note  = diff > 0 ? `${diff} ${unit} to go` : 'Target reached 🎉';
        }
      }

      return `
        <div class="target-tile target-${state}" data-target-field="${field}">
          <div class="target-tile-head">
            <span>${icon} ${label}</span>
            <span class="target-tile-pct">${value != null ? pct + '%' : '—'}</span>
          </div>
          <div class="target-tile-value">${value ?? 0} <span class="text-muted">/ ${goal} ${unit}</span></div>
          <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(100, pct)}%"></div></div>
          <div class="target-tile-note">${note}</div>
        </div>
      `;
    }).join('');

    if (!tiles.trim()) return '';
    return `
      <div class="flex justify-between items-center mb-2">
        <span class="text-sm font-semibold">Today vs your daily targets</span>
        <a href="#settings" class="text-xs">Edit targets</a>
      </div>
      <div class="target-grid">${tiles}</div>
    `;
  }

  _refreshNutritionTargets() {
    const el = document.getElementById('nutrition-targets');
    if (el) el.innerHTML = this._renderNutritionTargets();
  }

  // 3. Sleep
  _renderSleepSection() {
    const d = this.formData;
    const calcHours = calculateSleepHours(d.bedtime, d.wake_time);
    const durationDisplay = d.sleep_duration_min != null
      ? formatDuration(d.sleep_duration_min)
      : (calcHours != null ? formatDuration(calcHours * 60) : '--');

    const content = `
      <div class="grid-2 gap-4">
        <div class="form-group">
          <label for="bedtime">Bedtime</label>
          <input type="time" id="bedtime" name="bedtime" value="${d.bedtime ?? ''}">
        </div>

        <div class="form-group">
          <label for="wake_time">Wake-up Time</label>
          <input type="time" id="wake_time" name="wake_time" value="${d.wake_time ?? ''}">
        </div>

        <div class="form-group col-span-2 bg-surface-2 p-3 rounded-md flex justify-between items-center">
          <div>
            <span class="text-sm font-semibold">Total Sleep Duration:</span>
            <span class="text-lg font-bold text-accent ml-2" id="sleep-duration-val">${durationDisplay}</span>
            <div class="text-xs text-muted mt-1" id="sleep-duration-hint">
              ${d.sleep_manual_override ? 'Manually overridden' : (calcHours != null ? 'Calculated from bedtime & wake time (handles midnight)' : 'Enter bedtime and wake time')}
            </div>
          </div>
          <div class="flex items-center gap-2">
            <input type="checkbox" id="sleep_manual_override" name="sleep_manual_override" ${d.sleep_manual_override ? 'checked' : ''}>
            <label for="sleep_manual_override" class="mb-0 text-sm">Manual Override</label>
          </div>
        </div>

        <div class="form-group col-span-2 ${d.sleep_manual_override ? '' : 'hidden'}" id="manual-sleep-group">
          <label for="sleep_duration_min">Manual Sleep Duration (minutes)</label>
          <div class="input-with-unit">
            <input type="number" id="sleep_duration_min" name="sleep_duration_min" value="${d.sleep_duration_min ?? ''}" placeholder="e.g. 480 (for 8 hours)">
            <span class="unit">min</span>
          </div>
        </div>
      </div>
    `;
    return this._renderSectionCard('sleep', '3. Sleep', '😴', content);
  }

  // 4. Career
  _renderCareerSection() {
    const d = this.formData;
    const content = `
      <div class="grid-2 gap-4">
        <div class="form-group">
          <label for="career_topic">Topic Learned</label>
          <input type="text" id="career_topic" name="career_topic" value="${this._escape(d.career_topic)}" placeholder="e.g. Transformers, Backpropagation, SQL optimization…">
        </div>

        <div class="form-group">
          <label for="career_practical">Practical Work Completed</label>
          <input type="text" id="career_practical" name="career_practical" value="${this._escape(d.career_practical)}" placeholder="e.g. Built PyTorch model, solved 2 Leetcode problems…">
        </div>

        <div class="form-group">
          <label for="career_dsa">DSA Aspect</label>
          <input type="text" id="career_dsa" name="career_dsa" value="${this._escape(d.career_dsa)}" placeholder="e.g. Binary Search, Dynamic Programming…">
        </div>

        <div class="form-group">
          <label for="career_learned">One Thing I Learned / Taught Today</label>
          <input type="text" id="career_learned" name="career_learned" value="${this._escape(d.career_learned)}" placeholder="Key takeaway…">
        </div>

        <div class="form-group col-span-2">
          <label for="career_study_min">Study Duration (minutes)</label>
          <div class="input-with-unit">
            <input type="number" id="career_study_min" name="career_study_min" value="${d.career_study_min ?? ''}" placeholder="e.g. 120 (for 2 hours)" min="0">
            <span class="unit">min</span>
          </div>
        </div>
      </div>
    `;
    return this._renderSectionCard('career', '4. Career — AI/ML & DSA', '💻', content);
  }

  // 5. Grooming
  _renderGroomingSection() {
    const d = this.formData;
    const content = `
      <div class="flex flex-col gap-3">
        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Brushed Teeth Twice</label>
          ${this._renderYnToggle('brush_teeth', d.brush_teeth)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Tongue Scraped</label>
          ${this._renderYnToggle('tongue_scrape', d.tongue_scrape)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Flossed / Cleaned Between Teeth</label>
          ${this._renderYnToggle('floss', d.floss)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Morning Skincare + Sunscreen</label>
          ${this._renderYnToggle('morning_skincare', d.morning_skincare)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Night Skincare</label>
          ${this._renderYnToggle('night_skincare', d.night_skincare)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Hair / Scalp Care</label>
          ${this._renderHairCareToggle(d.hair_care)}
        </div>
      </div>
    `;
    return this._renderSectionCard('grooming', '5. Oral, Skin & Hair Care', '✨', content);
  }

  // 6. Spirituality
  _renderSpiritualitySection() {
    const d = this.formData;
    const content = `
      <div class="form-group flex justify-between items-center">
        <label class="mb-0">Hanuman Chalisa Completed</label>
        ${this._renderYnToggle('hanuman_chalisa', d.hanuman_chalisa)}
      </div>
    `;
    return this._renderSectionCard('spirituality', '6. Spirituality', '🙏', content);
  }

  // 7. Mental Discipline
  _renderMentalDisciplineSection() {
    const d = this.formData;
    const content = `
      <div class="grid-2 gap-4">
        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Porn-Free Day</label>
          ${this._renderYnToggle('porn_free', d.porn_free)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Masturbation-Free Day</label>
          ${this._renderYnToggle('masturbation_free', d.masturbation_free)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Social Media Kept Within Limit</label>
          ${this._renderYnToggle('social_media_limit', d.social_media_limit)}
        </div>

        <div class="form-group">
          <label for="pranayama_min">Pranayama Duration (minutes)</label>
          <div class="input-with-unit">
            <input type="number" id="pranayama_min" name="pranayama_min" value="${d.pranayama_min ?? ''}" placeholder="e.g. 15" min="0">
            <span class="unit">min</span>
          </div>
        </div>
      </div>
    `;
    return this._renderSectionCard('mental', '7. Mental Discipline', '🧘', content);
  }

  // 8. Personal Growth
  _renderPersonalGrowthSection() {
    const d = this.formData;
    const content = `
      <div class="flex flex-col gap-3">
        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Podcast Listened To</label>
          ${this._renderYnToggle('podcast', d.podcast)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Improved Communication Practiced</label>
          ${this._renderYnToggle('communication', d.communication)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Planned Tomorrow's Tasks</label>
          ${this._renderYnToggle('planned_tomorrow', d.planned_tomorrow)}
        </div>
      </div>
    `;
    return this._renderSectionCard('growth', '8. Personal Growth', '🌱', content);
  }

  // 9. Personal Care & Routine
  _renderPersonalCareSection() {
    const d = this.formData;
    const content = `
      <div class="flex flex-col gap-3">
        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Bed Setup Completed</label>
          ${this._renderYnToggle('bed_setup', d.bed_setup)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Body-Detox Routine Completed</label>
          ${this._renderYnToggle('body_detox', d.body_detox)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Shower & Basic Personal Hygiene</label>
          ${this._renderYnToggle('shower', d.shower)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Room / Workspace Reset</label>
          ${this._renderYnToggle('room_reset', d.room_reset)}
        </div>

        <div class="form-group flex justify-between items-center">
          <label class="mb-0">Stockings Worn as Planned</label>
          ${this._renderYnToggle('stockings', d.stockings)}
        </div>
      </div>
    `;
    return this._renderSectionCard('routine', '9. Personal Care & Routine', '🚿', content);
  }

  // 10. Financial Discipline
  _renderFinancialSection() {
    const d = this.formData;
    const categories = ['', 'Food', 'Transport', 'Personal Care', 'Entertainment', 'Shopping', 'Other'];

    const content = `
      <div class="grid-2 gap-4">
        <div class="form-group">
          <label for="extra_spent_inr">Extra Money Spent Today (₹)</label>
          <div class="input-with-unit">
            <span class="unit-prefix">₹</span>
            <input type="number" step="1" id="extra_spent_inr" name="extra_spent_inr" value="${d.extra_spent_inr ?? ''}" placeholder="0" min="0">
          </div>
        </div>

        <div class="form-group">
          <label for="spending_category">Spending Category</label>
          <select id="spending_category" name="spending_category">
            ${categories.map(c => `<option value="${c}" ${d.spending_category === c ? 'selected' : ''}>${c || 'Select category…'}</option>`).join('')}
          </select>
        </div>

        <div class="form-group col-span-2">
          <label for="spending_note">Spending Note</label>
          <input type="text" id="spending_note" name="spending_note" value="${this._escape(d.spending_note)}" placeholder="What was this expenditure for?">
        </div>

        <div class="form-group col-span-2 bg-surface-2 p-3 rounded-md flex justify-between items-center" id="budget-summary-box">
          <span class="text-sm text-muted">Budget tracker loading…</span>
        </div>
      </div>
    `;
    return this._renderSectionCard('financial', '10. Financial Discipline', '💰', content);
  }

  // 11. Daily Reflection
  _renderReflectionSection() {
    const d = this.formData;
    const content = `
      <div class="flex flex-col gap-4">
        <div class="form-group">
          <label for="best_thing">Best Thing I Did Today</label>
          <textarea id="best_thing" name="best_thing" rows="2" placeholder="What went really well today?">${this._escape(d.best_thing)}</textarea>
        </div>

        <div class="form-group">
          <label for="biggest_mistake">Biggest Mistake or Obstacle</label>
          <textarea id="biggest_mistake" name="biggest_mistake" rows="2" placeholder="What tripped you up or caused trouble?">${this._escape(d.biggest_mistake)}</textarea>
        </div>

        <div class="form-group">
          <label for="one_improvement">One Improvement for Tomorrow</label>
          <textarea id="one_improvement" name="one_improvement" rows="2" placeholder="What concrete adjustment will you make?">${this._escape(d.one_improvement)}</textarea>
        </div>
      </div>
    `;
    return this._renderSectionCard('reflection', '11. Daily Reflection', '📝', content);
  }

  // 12. Daily Planning
  _renderPlanningSection() {
    const d = this.formData;
    const content = `
      <div class="flex flex-col gap-4">
        <div class="form-group">
          <label for="priority_1">Top Priority 1 for Tomorrow</label>
          <input type="text" id="priority_1" name="priority_1" value="${this._escape(d.priority_1)}" placeholder="Most important task…">
        </div>

        <div class="form-group">
          <label for="priority_2">Top Priority 2 for Tomorrow</label>
          <input type="text" id="priority_2" name="priority_2" value="${this._escape(d.priority_2)}" placeholder="Second priority…">
        </div>

        <div class="form-group">
          <label for="priority_3">Top Priority 3 for Tomorrow</label>
          <input type="text" id="priority_3" name="priority_3" value="${this._escape(d.priority_3)}" placeholder="Third priority…">
        </div>

        <div class="form-group">
          <label for="planning_notes">Planning Notes for Tomorrow</label>
          <textarea id="planning_notes" name="planning_notes" rows="2" placeholder="Additional details, schedule, or reminders…">${this._escape(d.planning_notes)}</textarea>
        </div>
      </div>
    `;
    return this._renderSectionCard('planning', '12. Daily Planning', '📅', content);
  }

  // ─── Event Binding ───────────────────────────────────────────────

  _bindFormEvents(container) {
    // 1. Collapsible toggles
    container.querySelectorAll('.section-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const expanded = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', (!expanded).toString());
        const bodyId = btn.getAttribute('aria-controls');
        const body = document.getElementById(bodyId);
        if (body) body.classList.toggle('hidden', expanded);
      });
    });

    // 2. Tristate YN toggles & Hair care toggle
    container.querySelectorAll('.yn-toggle, .hair-toggle').forEach(group => {
      const field = group.dataset.field;
      group.querySelectorAll('.yn-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const val = parseInt(btn.dataset.val, 10);
          const current = this.formData[field];

          // If clicking active button, toggle back to null (unset)
          let newVal;
          if (current === val) {
            newVal = null;
          } else {
            newVal = val;
          }

          this.formData[field] = newVal;
          this._markDirty();

          // Re-render button states
          group.querySelectorAll('.yn-btn').forEach(b => {
            const bVal = parseInt(b.dataset.val, 10);
            b.classList.toggle('active', bVal === newVal);
          });
        });
      });
    });

    // 3. Inputs & textareas (change & debounced save)
    container.querySelectorAll('input, select, textarea').forEach(input => {
      if (input.type === 'button' || input.type === 'submit') return;

      input.addEventListener('input', () => {
        this._updateFormValue(input);
        this._markDirty();
        if (NUTRITION_TARGETS.some(t => t.field === input.name)) this._refreshNutritionTargets();
      });

      input.addEventListener('change', () => {
        // 'input' already marked the form dirty; saving here only flushes pending edits
        this._updateFormValue(input);
        this.save(); // Immediate save on change
      });
    });

    // 4. Special sleep manual override toggle
    const sleepOverrideCheckbox = container.querySelector('#sleep_manual_override');
    if (sleepOverrideCheckbox) {
      sleepOverrideCheckbox.addEventListener('change', (e) => {
        const isManual = e.target.checked;
        this.formData.sleep_manual_override = isManual ? 1 : 0;
        const group = container.querySelector('#manual-sleep-group');
        if (group) group.classList.toggle('hidden', !isManual);
        this._recalcSleepDisplay();
        this._markDirty();
      });
    }

    // Recalculate sleep when bedtime or wake_time changes
    const bedtimeEl = container.querySelector('#bedtime');
    const wakeEl = container.querySelector('#wake_time');
    if (bedtimeEl && wakeEl) {
      const updateSleep = () => {
        this.formData.bedtime = bedtimeEl.value || null;
        this.formData.wake_time = wakeEl.value || null;
        this._recalcSleepDisplay();
      };
      bedtimeEl.addEventListener('input', updateSleep);
      wakeEl.addEventListener('input', updateSleep);
    }

    // Load budget summary for financial section
    this._loadBudgetSummary();
  }

  _updateFormValue(input) {
    const name = input.name;
    if (!name) return;

    let val = input.value;
    if (val === '') {
      this.formData[name] = null;
      return;
    }

    if (input.type === 'number') {
      const num = parseFloat(val);
      this.formData[name] = isNaN(num) ? null : num;
    } else if (input.type === 'checkbox') {
      this.formData[name] = input.checked ? 1 : 0;
    } else {
      this.formData[name] = val;
    }
  }

  _recalcSleepDisplay() {
    const valEl = document.getElementById('sleep-duration-val');
    const hintEl = document.getElementById('sleep-duration-hint');
    if (!valEl) return;

    const bedtime = this.formData.bedtime;
    const wake = this.formData.wake_time;
    const calcHours = calculateSleepHours(bedtime, wake);

    if (this.formData.sleep_manual_override) {
      const manualMins = this.formData.sleep_duration_min;
      valEl.textContent = manualMins != null ? formatDuration(manualMins) : '--';
      if (hintEl) hintEl.textContent = 'Manually overridden';
    } else {
      valEl.textContent = calcHours != null ? formatDuration(calcHours * 60) : '--';
      if (hintEl) {
        hintEl.textContent = calcHours != null
          ? 'Calculated from bedtime & wake time (handles midnight)'
          : 'Enter bedtime and wake time';
      }
    }
  }

  async _loadBudgetSummary() {
    const box = document.getElementById('budget-summary-box');
    if (!box) return;

    try {
      const stats = await api.get(withChallenge('/api/stats/spending'));
      const totalSpent = stats.totalSpent || 0;
      const budget = stats.budget || 1500;
      const remaining = stats.remaining;

      box.innerHTML = `
        <div>
          <span class="text-sm font-semibold">Challenge Budget:</span>
          <span class="text-sm ml-2">${formatCurrency(totalSpent)} spent / ${formatCurrency(budget)}</span>
        </div>
        <div>
          <span class="text-sm font-bold ${remaining < 0 ? 'text-error' : 'text-accent'}">
            ${remaining < 0 ? `Over budget by ${formatCurrency(Math.abs(remaining))}` : `${formatCurrency(remaining)} remaining`}
          </span>
        </div>
      `;
    } catch (e) {
      box.innerHTML = '<span class="text-xs text-muted">Budget status unavailable</span>';
    }
  }

  _markDirty() {
    this._isDirty = true;
    this._editCount = (this._editCount || 0) + 1;
    setSaveStatus('unsaved');
    this._debouncedSave();
  }

  /**
   * Save the form. Only one request runs at a time; a save asked for while one
   * is in flight runs right after it, so the newest values always win.
   */
  save() {
    if (this._saving) {
      this._saveAgain = true;
      return this._saving;
    }
    if (!this._isDirty && this._savedDate === this.currentDate) return Promise.resolve();

    this._saving = this._saveNow().finally(() => {
      this._saving = null;
      if (this._saveAgain) {
        this._saveAgain = false;
        if (this._isDirty) this.save();
      }
    });
    return this._saving;
  }

  async _saveNow() {
    setSaveStatus('saving');

    // Clean payload
    const payload = { ...this.formData, date: this.currentDate };
    const editsAtSend = this._editCount;

    // Clear previous inline field errors
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');

    try {
      const saved = await api.post(`/api/logs/${this.currentDate}`, payload);
      this._savedDate = this.currentDate;
      if (this._editCount !== editsAtSend) {
        // Typed while the request was in flight: keep those edits (still unsaved)
        this._saveAgain = true;
        setSaveStatus('unsaved');
        return;
      }
      this.formData = saved;
      this._isDirty = false;
      setSaveStatus('saved');
      setTimeout(() => { if (!this._isDirty && !this._saving) setSaveStatus(null); }, 3000);
      this._loadBudgetSummary();
    } catch (err) {
      setSaveStatus('error');
      if (err.data && err.data.errors) {
        for (const [field, msg] of Object.entries(err.data.errors)) {
          const errEl = document.getElementById(`err-${field}`);
          if (errEl) errEl.textContent = msg;
        }
      }
      showToast(err.message || 'Failed to save daily log', 'error');
    }
  }

  _escape(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
