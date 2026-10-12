/**
 * finalReview.js — Challenge Final Review Page
 * Displays exact beginning/ending measurements, calculated averages across valid days,
 * total gym/cardio sessions, study hours, spending summary, and objective summary.
 */

import {
  api, formatDate, formatCurrency, formatDuration, withChallenge, escapeHtml,
  getActiveChallenge, CHALLENGE_START, CHALLENGE_END, REVIEW_DATE, TOTAL_DAYS,
} from '../utils.js';

export class FinalReview {
  async render(container) {
    container.innerHTML = `
      <div class="final-review-page">
        <header class="page-header mb-6">
          <div class="flex items-center gap-3">
            <span class="text-3xl">🏆</span>
            <div>
              <h1 class="page-title mb-0">${escapeHtml(getActiveChallenge()?.name || `${TOTAL_DAYS}-Day Challenge`)} — Final Review</h1>
              <p class="page-subtitle text-muted">${formatDate(REVIEW_DATE)} — Comprehensive Performance Summary</p>
            </div>
          </div>
        </header>

        <div id="review-content" class="flex flex-col gap-8">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    try {
      const review = await api.get(withChallenge('/api/stats/final-review'));
      const habits = await api.get(withChallenge('/api/stats/habits'));

      this._renderReview(container, review, habits);
    } catch (err) {
      container.querySelector('#review-content').innerHTML = `
        <div class="card p-6 text-center text-error">
          Failed to load final review data: ${err.message}
        </div>
      `;
    }
  }

  _renderReview(container, review, habits) {
    const content = container.querySelector('#review-content');
    const s = review.settings || {};

    const weightChangeStr = review.weightChange != null
      ? `${review.weightChange > 0 ? '+' : ''}${review.weightChange.toFixed(1)} kg`
      : 'N/A';

    // Averages arrive as { value, count }
    const avgSteps   = review.avgSteps?.value ?? null;
    const avgProtein = review.avgProtein?.value ?? null;
    const avgSleep   = review.avgSleep?.value ?? null;

    const waistChangeStr = review.waistChange != null
      ? `${review.waistChange > 0 ? '+' : ''}${review.waistChange.toFixed(1)} cm`
      : 'N/A';

    content.innerHTML = `
      <!-- Challenge Overview Banner -->
      <div class="card p-6 bg-accent-light border-accent">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span class="badge badge-accent mb-2">Challenge Status</span>
            <h2 class="text-2xl font-bold text-accent mb-1">${review.daysLogged} of ${TOTAL_DAYS} Days Logged</h2>
            <p class="text-sm text-muted">
              ${review.daysLogged === TOTAL_DAYS
                ? `Perfect record! All ${TOTAL_DAYS} challenge days were logged.`
                : `${TOTAL_DAYS - review.daysLogged} days have missing or partial records.`}
            </p>
          </div>
          <a href="/api/export/json" download="davinci-challenge-export.json" class="btn btn-primary">
            Export Challenge Data (JSON)
          </a>
        </div>
      </div>

      <!-- Section 1: Body Measurements -->
      <div class="card p-6">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
          <span>📏</span> Body Measurements (Day 1 vs Day ${TOTAL_DAYS})
        </h2>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Day 1 (${formatDate(CHALLENGE_START)})</th>
                <th>Day ${TOTAL_DAYS} (${formatDate(CHALLENGE_END)})</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-medium">Body Weight (kg)</td>
                <td>${review.day1Weight != null ? `${review.day1Weight} kg` : '<span class="text-muted">Not recorded</span>'}</td>
                <td>${review.day21Weight != null ? `${review.day21Weight} kg` : '<span class="text-muted">Not recorded</span>'}</td>
                <td class="font-bold">${weightChangeStr}</td>
              </tr>
              <tr>
                <td class="font-medium">Waist Circumference (cm)</td>
                <td>${review.waistStart != null ? `${review.waistStart} cm` : '<span class="text-muted">Not set</span>'}</td>
                <td>${review.waistEnd != null ? `${review.waistEnd} cm` : '<span class="text-muted">Not set</span>'}</td>
                <td class="font-bold">${waistChangeStr}</td>
              </tr>
            </tbody>
          </table>
        </div>
        ${(review.waistStart == null || review.waistEnd == null) ? `
          <div class="text-xs text-muted mt-3">
            * Waist measurements can be configured in <a href="#settings" class="text-accent font-medium">Settings</a>.
          </div>
        ` : ''}
      </div>

      <!-- Section 2: Fitness & Health Performance -->
      <div class="grid-2 gap-6">
        <div class="card p-6">
          <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
            <span>💪</span> Workout & Fitness Summary
          </h3>
          <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-muted">Total Gym Sessions:</span>
              <span class="font-bold text-lg">${review.totalGymSessions} sessions</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-muted">Total Cardio Sessions:</span>
              <span class="font-bold text-lg">${review.totalCardioSessions} sessions</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-muted">Average Daily Steps:</span>
              <span class="font-bold text-lg">${avgSteps != null ? Math.round(avgSteps).toLocaleString() : 'N/A'} steps/day</span>
            </div>
            <div class="text-xs text-muted">
              * Gym sessions exclude Rest and Recovery days unless a workout note was added.
            </div>
          </div>
        </div>

        <div class="card p-6">
          <h3 class="font-bold text-lg mb-4 flex items-center gap-2">
            <span>🥗</span> Nutrition & Sleep Summary
          </h3>
          <div class="flex flex-col gap-4">
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-muted">Average Daily Protein:</span>
              <span class="font-bold text-lg">${avgProtein != null ? `${avgProtein.toFixed(1)} g/day` : 'N/A'}</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-muted">Average Sleep Duration:</span>
              <span class="font-bold text-lg">${avgSleep != null ? formatDuration(avgSleep * 60) : 'N/A'} / night</span>
            </div>
            <div class="flex justify-between items-center border-b pb-2">
              <span class="text-muted">Total AI/ML Study Hours:</span>
              <span class="font-bold text-lg text-accent">${review.totalStudyHours != null ? `${review.totalStudyHours.toFixed(1)} hours` : '0 hours'}</span>
            </div>
            <div class="text-xs text-muted">
              * Averages calculated strictly from valid logged measurements.
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Financial Summary -->
      <div class="card p-6">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
          <span>💰</span> Financial Discipline (Extra Spending)
        </h2>
        <div class="grid-3 gap-4 mb-4">
          <div class="p-4 bg-surface-2 rounded-md text-center">
            <div class="text-xs text-muted">Total Extra Spent</div>
            <div class="text-xl font-bold mt-1">${formatCurrency(review.totalSpent || 0)}</div>
          </div>
          <div class="p-4 bg-surface-2 rounded-md text-center">
            <div class="text-xs text-muted">Challenge Budget</div>
            <div class="text-xl font-bold mt-1">${formatCurrency(review.budget ?? s.budget_inr ?? 1500)}</div>
          </div>
          <div class="p-4 bg-surface-2 rounded-md text-center">
            <div class="text-xs text-muted">Remaining Balance</div>
            <div class="text-xl font-bold mt-1 ${review.budgetRemaining < 0 ? 'text-error' : 'text-success'}">
              ${formatCurrency(review.budgetRemaining || 0)}
            </div>
          </div>
        </div>
        <div class="text-sm">
          Status: <span class="font-bold ${review.budgetRemaining < 0 ? 'text-error' : 'text-success'}">
            ${review.budgetRemaining < 0
              ? `Over budget by ${formatCurrency(Math.abs(review.budgetRemaining))}`
              : `Under budget with ${formatCurrency(review.budgetRemaining)} remaining`}
          </span>
        </div>
      </div>

      <!-- Section 4: Habit Compliance Breakdown -->
      <div class="card p-6">
        <h2 class="text-xl font-bold mb-4 flex items-center gap-2">
          <span>📊</span> Overall Habit Compliance
        </h2>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Habit Name</th>
                <th>Applicable Days</th>
                <th>Completed</th>
                <th>Compliance Rate</th>
              </tr>
            </thead>
            <tbody>
              ${(habits || []).map(h => {
                const rate = h.rate != null ? Math.round(h.rate * 100) : null;
                return `
                  <tr>
                    <td class="font-medium">${this._formatHabitName(h.habit)}</td>
                    <td>${h.applicable_days}</td>
                    <td>${h.completed_days}</td>
                    <td>
                      ${rate != null ? `
                        <div class="flex items-center gap-2">
                          <div class="progress-bar w-20">
                            <div class="progress-bar-fill" style="width: ${rate}%"></div>
                          </div>
                          <span class="font-semibold text-xs">${rate}%</span>
                        </div>
                      ` : '<span class="text-muted">No data</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Section 5: Factual Objective Summary -->
      <div class="card p-6 bg-surface-2">
        <h3 class="font-bold text-base mb-2">📌 Data Integrity Note</h3>
        <p class="text-sm text-muted leading-relaxed">
          This final review is generated exclusively from stored daily records in your local SQLite database.
          Averages are computed strictly over logged entries containing non-null measurements. Unlogged days
          are not counted as zero or assumed completed. No synthetic data or automated motivational claims have been included.
        </p>
      </div>
    `;
  }

  _formatHabitName(key) {
    const map = {
      cardio_completed: 'Cardio Completed',
      fruits_veggies: 'Fruits & Veggies',
      junk_food: 'Junk Food Avoided',
      within_calorie_target: 'Calorie Target Met',
      planned_meals_tomorrow: 'Meals Planned',
      brush_teeth: 'Brushed Teeth Twice',
      tongue_scrape: 'Tongue Scraped',
      floss: 'Flossed Teeth',
      morning_skincare: 'Morning Skincare',
      night_skincare: 'Night Skincare',
      hair_care: 'Hair/Scalp Care',
      hanuman_chalisa: 'Hanuman Chalisa',
      porn_free: 'Porn-Free Day',
      masturbation_free: 'Masturbation-Free Day',
      social_media_limit: 'Social Media Limit Met',
      podcast: 'Podcast Listened',
      communication: 'Communication Improved',
      planned_tomorrow: 'Planned Tomorrow',
      bed_setup: 'Bed Setup',
      body_detox: 'Body Detox Routine',
      shower: 'Shower & Hygiene',
      room_reset: 'Room Reset',
      stockings: 'Stockings Worn',
      plank_completed: 'Plank Completed',
    };
    return map[key] || key.replace(/_/g, ' ');
  }
}
