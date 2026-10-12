/**
 * trends.js — Progress & Trends visualization page
 * SVG line charts for key metrics + habit completion rates summary table.
 */

import { api, formatDateShort, formatCurrency, withChallenge, TOTAL_DAYS } from '../utils.js';

export class Trends {
  async render(container) {
    container.innerHTML = `
      <div class="trends-page">
        <header class="page-header mb-6">
          <h1 class="page-title">Progress & Trends</h1>
          <p class="page-subtitle text-muted">${TOTAL_DAYS}-day challenge visual history and habit compliance</p>
        </header>

        <div id="trends-content" class="flex flex-col gap-8">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    try {
      const [trends, habits] = await Promise.all([
        api.get(withChallenge('/api/stats/trends')),
        api.get(withChallenge('/api/stats/habits')),
      ]);

      this._renderTrends(container, trends, habits);
    } catch (err) {
      container.querySelector('#trends-content').innerHTML = `
        <div class="card p-6 text-center text-error">
          Failed to load trends data: ${err.message}
        </div>
      `;
    }
  }

  _renderTrends(container, trends, habits) {
    const content = container.querySelector('#trends-content');

    content.innerHTML = `
      <!-- Metric Charts Grid -->
      <div class="grid-2 gap-6">
        ${this._renderChartCard('Body Weight', 'kg', trends.weights, '#7c3aed')}
        ${this._renderChartCard('Daily Steps', 'steps', trends.steps, '#2563eb')}
        ${this._renderChartCard('Daily Protein Intake', 'g', trends.protein, '#b45309')}
        ${this._renderChartCard('Daily Calories', 'kcal', trends.calories, '#ea580c')}
        ${this._renderChartCard('Daily Water Intake', 'L', trends.water, '#0891b2')}
        ${this._renderChartCard('Sleep Duration', 'hours', trends.sleep, '#4f46e5')}
        ${this._renderChartCard('AI/ML Study Time', 'hours', trends.studyHours, '#d97706')}
        ${this._renderChartCard('Daily Spending', '₹', trends.spending, '#db2777')}
      </div>

      <!-- Habit Compliance Summary Table -->
      <div class="card p-6">
        <h2 class="text-xl font-bold mb-4">Habit Completion Rates</h2>
        <p class="text-xs text-muted mb-4">Calculated strictly from applicable logged days. Excludes un-scheduled days.</p>
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Habit</th>
                <th>Applicable Days</th>
                <th>Completed Days</th>
                <th>Completion Rate</th>
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
                          <div class="progress-bar w-24">
                            <div class="progress-bar-fill" style="width: ${rate}%"></div>
                          </div>
                          <span class="font-bold text-sm">${rate}%</span>
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
    `;
  }

  _renderChartCard(title, unit, dataPoints, color) {
    const validData = (dataPoints || []).filter(p => p.value != null && !isNaN(p.value));

    if (validData.length < 2) {
      return `
        <div class="card p-6 flex flex-col justify-between">
          <h3 class="font-bold text-base mb-2">${title}</h3>
          <div class="chart-empty text-center py-12 text-muted">
            <span class="text-3xl block mb-2">📊</span>
            <span>Not enough data points yet (need at least 2 logged days)</span>
          </div>
        </div>
      `;
    }

    const svgHtml = this._generateSvgChart(validData, unit, color);

    return `
      <div class="card p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-base">${title}</h3>
          <span class="badge badge-accent">${validData.length} data points</span>
        </div>
        <div class="chart-container">
          ${svgHtml}
        </div>
      </div>
    `;
  }

  _generateSvgChart(data, unit, color) {
    const width = 500;
    const height = 220;
    const padding = { top: 20, right: 30, bottom: 40, left: 45 };

    const values = data.map(d => d.value);
    let minVal = Math.min(...values);
    let maxVal = Math.max(...values);

    if (minVal === maxVal) {
      minVal = minVal * 0.9 || 0;
      maxVal = maxVal * 1.1 || 10;
    }

    const valRange = maxVal - minVal;
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const getX = (idx) => padding.left + (idx / (data.length - 1)) * chartW;
    const getY = (val) => padding.top + chartH - ((val - minVal) / valRange) * chartH;

    const points = data.map((d, i) => `${getX(i)},${getY(d.value)}`).join(' ');

    // Y-axis grid ticks (3 ticks)
    const ticks = [minVal, minVal + valRange / 2, maxVal];

    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto" preserveAspectRatio="xMidYMid meet">
        <!-- Grid lines -->
        ${ticks.map(t => `
          <line x1="${padding.left}" y1="${getY(t)}" x2="${width - padding.right}" y2="${getY(t)}" stroke="var(--color-border)" stroke-dasharray="3 3"/>
          <text x="${padding.left - 8}" y="${getY(t) + 4}" text-anchor="end" class="chart-tick-label">${typeof t === 'number' ? (t % 1 === 0 ? t : t.toFixed(1)) : t}</text>
        `).join('')}

        <!-- X-axis dates -->
        ${data.map((d, i) => `
          <text x="${getX(i)}" y="${height - 10}" text-anchor="middle" class="chart-tick-label">${formatDateShort(d.date)}</text>
        `).join('')}

        <!-- Line -->
        <polyline fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="${points}" />

        <!-- Data Dots -->
        ${data.map((d, i) => `
          <circle cx="${getX(i)}" cy="${getY(d.value)}" r="4.5" fill="${color}" stroke="white" stroke-width="2">
            <title>${formatDateShort(d.date)}: ${d.value} ${unit}</title>
          </circle>
        `).join('')}
      </svg>
    `;
  }

  _formatHabitName(key) {
    const map = {
      cardio_completed: 'Cardio Completed',
      fruits_veggies: 'Fruits & Veggies Eaten',
      junk_food: 'Junk Food Avoided (No Junk)',
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
