/**
 * dashboard.js — Dashboard page
 * Shows challenge progress, today's key metrics, and habit overview.
 */

import {
  api, showToast, formatDate, formatDateShort,
  getChallengeDay, todayStr, isValidChallengeDate,
  CHALLENGE_START, CHALLENGE_END, REVIEW_DATE, TOTAL_DAYS,
  formatDuration, formatCurrency, withChallenge, getActiveChallenge,
} from '../utils.js';
import { navigate } from '../app.js';

export class Dashboard {
  async render(container) {
    const today   = todayStr();
    const dayNum  = getChallengeDay(today);

    // ── Pre-challenge state ──────────────────────────────────────
    if (today < CHALLENGE_START) {
      const startDate  = new Date(CHALLENGE_START + 'T00:00:00');
      const todayDate  = new Date(today + 'T00:00:00');
      const daysUntil  = Math.round((startDate - todayDate) / 86400000);
      container.innerHTML = '';
      container.appendChild(_buildPreChallenge(daysUntil));
      return;
    }

    // ── Post-challenge state ─────────────────────────────────────
    if (today > CHALLENGE_END) {
      container.innerHTML = '';
      container.appendChild(_buildPostChallenge());
      return;
    }

    // ── Fetch data in parallel ───────────────────────────────────
    let overview = {}, spending = {}, todayLog = null, settings = {};
    try {
      [overview, spending, settings] = await Promise.all([
        api.get(withChallenge('/api/stats/overview')).catch(() => ({})),
        api.get(withChallenge('/api/stats/spending')).catch(() => ({})),
        api.get('/api/settings').catch(() => ({})),
      ]);
      todayLog = await api.get(`/api/logs/${today}`).catch(e => {
        if (e.status === 404) return null;
        throw e;
      });
    } catch (err) {
      showToast(err.message, 'error');
    }

    // ── Build page ───────────────────────────────────────────────
    container.innerHTML = '';
    const page = document.createElement('div');

    // Header
    page.appendChild(_buildHeader(today, dayNum));

    // Row 1: 3 stat cards
    const statsRow = document.createElement('div');
    statsRow.className = 'stat-grid mb-6';
    statsRow.appendChild(_buildProgressCard(dayNum));
    statsRow.appendChild(_buildTodayStatusCard(todayLog, today));
    statsRow.appendChild(_buildBudgetCard(spending));
    page.appendChild(statsRow);

    // Key metrics
    page.appendChild(_buildMetricsSection(todayLog, settings));

    // Habit overview
    page.appendChild(_buildHabitOverview(todayLog, today));

    // Footer
    page.appendChild(_buildFooter(dayNum, today));

    container.appendChild(page);
  }
}

// ─── Header ─────────────────────────────────────────────────────
function _buildHeader(today, dayNum) {
  const el = document.createElement('div');
  el.className = 'page-header flex items-center justify-between flex-wrap gap-3 mb-6';

  const left = document.createElement('div');

  const challenge = getActiveChallenge();
  const title = document.createElement('h1');
  title.className = 'page-title hero-title';
  title.textContent = challenge ? challenge.name : 'Epic Davinci';

  const subtitle = document.createElement('div');
  subtitle.className = 'page-subtitle';
  subtitle.textContent = formatDate(today);

  left.appendChild(title);
  left.appendChild(subtitle);

  const badge = document.createElement('span');
  badge.className = 'badge badge-day';
  badge.textContent = dayNum ? `Day ${dayNum} of ${TOTAL_DAYS}` : '';

  el.appendChild(left);
  if (dayNum) el.appendChild(badge);
  return el;
}

// ─── Progress Card ───────────────────────────────────────────────
function _buildProgressCard(dayNum) {
  const pct = dayNum ? Math.round(((dayNum - 1) / TOTAL_DAYS) * 100) : 0;
  const card = _card();

  const h = document.createElement('div');
  h.className = 'card-header';
  const t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = 'Challenge Progress';
  h.appendChild(t);

  const dayLabel = document.createElement('div');
  dayLabel.className = 'text-2xl font-bold text-accent mb-2';
  dayLabel.textContent = `Day ${dayNum} of ${TOTAL_DAYS}`;

  const pctLabel = document.createElement('div');
  pctLabel.className = 'text-sm text-muted mb-3';
  pctLabel.textContent = `${pct}% complete`;

  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  const fill = document.createElement('div');
  fill.className = 'progress-bar-fill';
  fill.style.width = `${pct}%`;
  bar.appendChild(fill);

  const remaining = document.createElement('div');
  remaining.className = 'text-xs text-muted mt-2';
  const left = TOTAL_DAYS - dayNum + 1;
  remaining.textContent = `${left} day${left !== 1 ? 's' : ''} remaining`;

  card.appendChild(h);
  card.appendChild(dayLabel);
  card.appendChild(pctLabel);
  card.appendChild(bar);
  card.appendChild(remaining);
  return card;
}

// ─── Today Status Card ───────────────────────────────────────────
function _buildTodayStatusCard(todayLog, today) {
  const card = _card();

  const h = document.createElement('div');
  h.className = 'card-header';
  const t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = "Today's Status";
  h.appendChild(t);
  card.appendChild(h);

  const badge = document.createElement('div');
  badge.className = 'mb-4';
  if (todayLog) {
    const b = document.createElement('span');
    b.className = 'badge badge-success';
    b.textContent = '✓ Logged today';
    badge.appendChild(b);
  } else {
    const b = document.createElement('span');
    b.className = 'badge badge-missing';
    b.textContent = '○ Not yet logged';
    badge.appendChild(b);
  }
  card.appendChild(badge);

  const prompt = document.createElement('p');
  prompt.className = 'text-sm text-muted mb-4';
  prompt.textContent = todayLog
    ? 'Your habits are recorded for today.'
    : 'Take a few minutes to log your progress.';
  card.appendChild(prompt);

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary w-full';
  btn.textContent = todayLog ? 'Edit Today\'s Log' : 'Log Today\'s Habits';
  btn.addEventListener('click', () => navigate('daily-log', { date: today }));
  card.appendChild(btn);

  return card;
}

// ─── Budget Card ─────────────────────────────────────────────────
function _buildBudgetCard(spending) {
  const card  = _card();
  const total = spending.totalSpent ?? null;
  const budget = spending.budget ?? 1500;
  const remaining = total != null ? budget - total : null;

  const h = document.createElement('div');
  h.className = 'card-header';
  const t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = 'Extra Spending';
  h.appendChild(t);
  card.appendChild(h);

  const spentRow = _infoRow('Total spent', total != null ? formatCurrency(total) : '—');
  const budgetRow = _infoRow('Budget', formatCurrency(budget));
  const remainRow  = _infoRow('Remaining',
    remaining != null ? formatCurrency(remaining) : '—',
    remaining != null && remaining < 0 ? 'text-error' : 'text-success'
  );
  card.appendChild(spentRow);
  card.appendChild(budgetRow);
  card.appendChild(remainRow);

  if (remaining != null) {
    const bar = document.createElement('div');
    bar.className = 'progress-bar mt-3';
    const fill = document.createElement('div');
    const pct = Math.min(100, Math.round((total / budget) * 100));
    fill.className = `progress-bar-fill${pct >= 100 ? ' error' : pct >= 80 ? ' warning' : ''}`;
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    card.appendChild(bar);
  }

  return card;
}

// ─── Key Metrics Today ───────────────────────────────────────────
function _buildMetricsSection(log, settings = {}) {
  const section = document.createElement('div');
  section.className = 'mb-6';

  const title = document.createElement('h2');
  title.className = 'text-lg font-semibold mb-3';
  title.textContent = "Today's Key Metrics";
  section.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'metric-grid';

  const metrics = [
    { icon: '⚖️', label: 'Weight',  value: log?.weight_kg != null ? `${log.weight_kg} kg` : null },
    { icon: '👟', label: 'Steps',   value: log?.total_steps != null ? log.total_steps.toLocaleString('en-IN') : null },
    { icon: '🔥', label: 'Calories', value: _withTarget(log?.calories_kcal, settings.calorie_target_kcal, 'kcal') },
    { icon: '🥩', label: 'Protein', value: _withTarget(log?.protein_g, settings.protein_target_g, 'g') },
    { icon: '💧', label: 'Water',   value: _withTarget(log?.water_l, settings.water_target_l, 'L') },
    { icon: '😴', label: 'Sleep',   value: _sleepValue(log) },
    { icon: '📚', label: 'Study',   value: log?.career_study_min != null ? formatDuration(log.career_study_min) : null },
  ];

  metrics.forEach(({ icon, label, value }) => {
    const tile = document.createElement('div');
    tile.className = 'metric-tile';

    const iconEl = document.createElement('div');
    iconEl.className = 'metric-tile-icon';
    iconEl.textContent = icon;

    const labelEl = document.createElement('div');
    labelEl.className = 'metric-tile-label';
    labelEl.textContent = label;

    const valEl = document.createElement('div');
    valEl.className = `metric-tile-value${value ? '' : ' missing'}`;
    valEl.textContent = value || '—';

    tile.appendChild(iconEl);
    tile.appendChild(labelEl);
    tile.appendChild(valEl);
    grid.appendChild(tile);
  });

  section.appendChild(grid);
  return section;
}

/** '120 / 140 g' when a target is set, '120 g' otherwise, null when not logged. */
function _withTarget(value, target, unit) {
  if (value == null) return null;
  return target != null ? `${value} / ${target} ${unit}` : `${value} ${unit}`;
}

function _sleepValue(log) {
  if (!log) return null;
  if (log.sleep_duration_min != null) {
    return formatDuration(log.sleep_duration_min);
  }
  if (log.bedtime && log.wake_time) {
    const { calculateSleepHours } = window._utils || {};
    // Simple inline calc (avoids re-import)
    const [bh, bm] = log.bedtime.split(':').map(Number);
    const [wh, wm] = log.wake_time.split(':').map(Number);
    let bedM  = bh * 60 + bm;
    let wakeM = wh * 60 + wm;
    if (wakeM <= bedM) wakeM += 1440;
    const hours = (wakeM - bedM) / 60;
    return formatDuration(Math.round(hours * 60));
  }
  return null;
}

// ─── Habit Overview ──────────────────────────────────────────────
function _buildHabitOverview(log, today) {
  const section = document.createElement('div');
  section.className = 'card mb-6';

  const h = document.createElement('div');
  h.className = 'card-header';
  const t = document.createElement('div');
  t.className = 'card-title';
  t.textContent = 'Habit Overview';
  const viewBtn = document.createElement('button');
  viewBtn.className = 'btn btn-sm btn-secondary';
  viewBtn.textContent = 'Open Log';
  viewBtn.addEventListener('click', () => navigate('daily-log', { date: today }));
  h.appendChild(t);
  h.appendChild(viewBtn);
  section.appendChild(h);

  const aspects = [
    { key: 'fitness',      label: '🏋️ Fitness',         field: 'cardio_completed' },
    { key: 'nutrition',    label: '🥗 Nutrition',        field: 'within_calorie_target' },
    { key: 'sleep',        label: '😴 Sleep',            field: 'bedtime' },
    { key: 'career',       label: '📚 Career / AI-ML',  field: 'career_study_min' },
    { key: 'care',         label: '✨ Oral & Skin Care', field: 'brush_teeth' },
    { key: 'spirituality', label: '🙏 Spirituality',     field: 'hanuman_chalisa' },
    { key: 'mental',       label: '🧠 Mental Discipline',field: 'porn_free' },
    { key: 'growth',       label: '🌱 Personal Growth',  field: 'podcast' },
    { key: 'routine',      label: '🏠 Personal Routine', field: 'bed_setup' },
    { key: 'financial',    label: '💰 Financial',        field: 'extra_spent_inr', anyValue: true },
  ];

  const list = document.createElement('div');
  list.className = 'habit-list';

  aspects.forEach(({ key, label, field, anyValue }) => {
    const val = log?.[field];
    let status = 'missing';
    if (log && val !== null && val !== undefined) {
      // Spending counts as done once recorded (₹0 is a good day, not a miss)
      status = anyValue || val === 1 || (typeof val === 'string' && val !== '') || (typeof val === 'number' && val > 0)
        ? 'complete' : 'incomplete';
    }

    const row = document.createElement('div');
    row.className = 'habit-row';
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-label', `${label} — click to open`);

    const name = document.createElement('span');
    name.className = 'habit-row-name';
    name.textContent = label;

    const dot = document.createElement('span');
    dot.className = `habit-indicator ${status}`;
    dot.setAttribute('aria-label', status);

    row.appendChild(name);
    row.appendChild(dot);

    const onClick = () => navigate('daily-log', { date: today, section: key });
    row.addEventListener('click', onClick);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); });

    list.appendChild(row);
  });

  section.appendChild(list);
  return section;
}

// ─── Footer ──────────────────────────────────────────────────────
function _buildFooter(dayNum, today) {
  const footer = document.createElement('div');
  footer.className = 'text-sm text-muted text-center mt-4';

  const daysLeft = TOTAL_DAYS - (dayNum || 0) + 1;
  const p1 = document.createElement('p');
  p1.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining in the challenge`;

  const p2 = document.createElement('p');
  p2.textContent = `Final review: ${formatDate(REVIEW_DATE)}`;

  footer.appendChild(p1);
  footer.appendChild(p2);
  return footer;
}

// ─── Pre-challenge Screen ────────────────────────────────────────
function _buildPreChallenge(daysUntil) {
  const el = document.createElement('div');
  el.className = 'empty-state';

  const icon = document.createElement('span');
  icon.className = 'empty-state-icon';
  icon.textContent = '⏳';

  const title = document.createElement('div');
  title.className = 'empty-state-title';
  title.textContent = 'Challenge hasn\'t started yet';

  const text = document.createElement('p');
  text.className = 'empty-state-text';
  text.textContent = `This ${TOTAL_DAYS}-day challenge begins on ${formatDate(CHALLENGE_START)}. ${daysUntil} day${daysUntil !== 1 ? 's' : ''} to go! You can already add priorities and notes in the sidebar.`;

  el.appendChild(icon);
  el.appendChild(title);
  el.appendChild(text);
  return el;
}

// ─── Post-challenge Screen ───────────────────────────────────────
function _buildPostChallenge() {
  const el = document.createElement('div');
  el.className = 'empty-state';

  const icon = document.createElement('span');
  icon.className = 'empty-state-icon';
  icon.textContent = '🏆';

  const title = document.createElement('div');
  title.className = 'empty-state-title';
  title.textContent = 'Challenge complete!';

  const text = document.createElement('p');
  text.className = 'empty-state-text';
  text.textContent = `This ${TOTAL_DAYS}-day challenge ended on ${formatDate(CHALLENGE_END)}. Head to Final Review to see your results.`;

  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'View Final Review';
  btn.addEventListener('click', () => navigate('final-review'));

  el.appendChild(icon);
  el.appendChild(title);
  el.appendChild(text);
  el.appendChild(btn);
  return el;
}

// ─── Helpers ─────────────────────────────────────────────────────
function _card() {
  const el = document.createElement('div');
  el.className = 'card';
  return el;
}

function _infoRow(label, value, valueClass = '') {
  const row = document.createElement('div');
  row.className = 'flex justify-between items-center mb-2';

  const l = document.createElement('span');
  l.className = 'text-sm text-muted';
  l.textContent = label;

  const v = document.createElement('span');
  v.className = `text-sm font-semibold${valueClass ? ' ' + valueClass : ''}`;
  v.textContent = value;

  row.appendChild(l);
  row.appendChild(v);
  return row;
}
