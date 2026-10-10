/**
 * calendar.js — Challenge Calendar page
 * Visual month grids (October & November 2026) showing logging status
 * for each date in the 21-day challenge.
 */

import { api, formatDateShort, getChallengeDay, todayStr, CHALLENGE_START, CHALLENGE_END } from '../utils.js';

export class Calendar {
  async render(container) {
    container.innerHTML = `
      <div class="calendar-page">
        <header class="page-header mb-6">
          <h1 class="page-title">Challenge Calendar</h1>
          <p class="page-subtitle text-muted">October 12, 2026 – November 1, 2026 (21 Days)</p>
        </header>

        <div id="calendar-content" class="flex flex-col gap-8">
          <div class="page-loading"><div class="spinner"></div></div>
        </div>
      </div>
    `;

    try {
      const logs = await api.get('/api/logs');
      const logsByDate = new Map();
      (logs || []).forEach(log => logsByDate.set(log.date, log));

      this._renderGrids(container, logsByDate);
    } catch (err) {
      container.querySelector('#calendar-content').innerHTML = `
        <div class="card p-6 text-center text-error">
          Failed to load calendar data: ${err.message}
        </div>
      `;
    }
  }

  _renderGrids(container, logsMap) {
    const content = container.querySelector('#calendar-content');
    const today = todayStr();

    // Summary counts
    let completedCount = 0;
    let partialCount = 0;
    let emptyCount = 0;

    for (let d = 1; d <= 21; d++) {
      const dateStr = this._getDateForDay(d);
      const log = logsMap.get(dateStr);
      if (!log) {
        emptyCount++;
      } else {
        const fieldCount = Object.keys(log).filter(k => log[k] !== null && k !== 'id' && k !== 'date' && k !== 'created_at' && k !== 'updated_at').length;
        if (fieldCount > 5) completedCount++;
        else partialCount++;
      }
    }

    content.innerHTML = `
      <!-- Stats summary banner -->
      <div class="grid-3 gap-4">
        <div class="card p-4 text-center">
          <div class="text-2xl font-bold text-success">${completedCount}</div>
          <div class="text-xs text-muted">Complete Logs</div>
        </div>
        <div class="card p-4 text-center">
          <div class="text-2xl font-bold text-warning">${partialCount}</div>
          <div class="text-xs text-muted">Partial Logs</div>
        </div>
        <div class="card p-4 text-center">
          <div class="text-2xl font-bold text-muted">${emptyCount}</div>
          <div class="text-xs text-muted">Unlogged Days</div>
        </div>
      </div>

      <!-- Month grids -->
      <div class="grid-2 gap-8">
        ${this._renderMonthGrid('October 2026', 2026, 9, 31, logsMap, today)}
        ${this._renderMonthGrid('November 2026', 2026, 10, 30, logsMap, today)}
      </div>

      <!-- Legend -->
      <div class="card p-4 flex flex-wrap gap-6 items-center justify-center text-sm">
        <div class="flex items-center gap-2">
          <span class="status-dot dot-success"></span> Complete Log
        </div>
        <div class="flex items-center gap-2">
          <span class="status-dot dot-warning"></span> Partial Log
        </div>
        <div class="flex items-center gap-2">
          <span class="status-dot dot-empty"></span> No Log
        </div>
        <div class="flex items-center gap-2">
          <span class="status-dot dot-today"></span> Today
        </div>
      </div>
    `;

    // Bind click events on calendar day cards
    content.querySelectorAll('.calendar-day[data-date]').forEach(card => {
      card.addEventListener('click', () => {
        const date = card.dataset.date;
        window.location.hash = `#daily-log?date=${date}`;
      });
    });
  }

  _renderMonthGrid(monthTitle, year, monthIdx, totalDaysInMonth, logsMap, today) {
    const days = [];
    const firstDayOfWeek = new Date(year, monthIdx, 1).getDay(); // 0 = Sun

    // Empty lead cells
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push('<div class="calendar-day empty-cell"></div>');
    }

    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      const isChallengeDay = dateStr >= CHALLENGE_START && dateStr <= CHALLENGE_END;
      const cDay = getChallengeDay(dateStr);
      const isToday = dateStr === today;
      const log = logsMap.get(dateStr);

      let statusClass = 'dot-empty';
      let badgeLabel = '';

      if (log) {
        const fieldCount = Object.keys(log).filter(k => log[k] !== null && k !== 'id' && k !== 'date' && k !== 'created_at' && k !== 'updated_at').length;
        if (fieldCount > 5) statusClass = 'dot-success';
        else statusClass = 'dot-warning';
      }

      if (isToday) statusClass += ' dot-today';

      days.push(`
        <div class="calendar-day ${isChallengeDay ? 'challenge-day' : 'outside-day'} ${isToday ? 'today-card' : ''}"
             data-date="${dateStr}"
             tabindex="${isChallengeDay ? 0 : -1}"
             role="button"
             aria-label="${dateStr} ${cDay ? `Day ${cDay}` : ''}">
          <div class="flex justify-between items-start">
            <span class="day-num">${dayNum}</span>
            ${cDay ? `<span class="cday-tag">D${cDay}</span>` : ''}
          </div>
          ${isChallengeDay ? `
            <div class="day-status-dot ${statusClass}"></div>
          ` : ''}
        </div>
      `);
    }

    return `
      <div class="card p-4">
        <h3 class="font-bold text-center mb-4">${monthTitle}</h3>
        <div class="calendar-grid-header grid grid-cols-7 text-center text-xs font-semibold text-muted mb-2">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div class="calendar-grid grid grid-cols-7 gap-1">
          ${days.join('')}
        </div>
      </div>
    `;
  }

  _getDateForDay(cDay) {
    const start = new Date(CHALLENGE_START);
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (cDay - 1));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
