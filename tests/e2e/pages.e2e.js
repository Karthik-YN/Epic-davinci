// Dashboard, Calendar, Trends and Final Review for a selected challenge.
const { test, expect, createChallenge, openChallenge } = require('./helpers');

async function log(request, date, data) {
  const res = await request.post(`/api/logs/${date}`, { data });
  expect(res.status(), await res.text()).toBe(200);
}

// ─── Dashboard ──────────────────────────────────────────────────
test('dashboard before the challenge starts', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Dash Early', start_date: '2042-01-20', end_date: '2042-01-26' });
  await openChallenge(page, ch, { today: '2042-01-15' });
  await expect(page.locator('.empty-state-title')).toHaveText("Challenge hasn't started yet");
  await expect(page.locator('.empty-state-text')).toContainText('This 7-day challenge begins on 20 January 2042. 5 days to go!');
});

test('dashboard after the challenge ends links to the final review', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Dash Late', start_date: '2042-02-01', end_date: '2042-02-03' });
  await openChallenge(page, ch, { today: '2042-02-10' });
  await expect(page.locator('.empty-state-title')).toHaveText('Challenge complete!');
  await expect(page.locator('.empty-state-text')).toContainText('ended on 3 February 2042');
  await page.click('.empty-state .btn-primary');
  await expect(page).toHaveURL(/#final-review/);
  await expect(page.locator('h1')).toContainText('Dash Late — Final Review');
});

test('dashboard during the challenge: progress, status, budget, metrics, habits', async ({ page, request }) => {
  const ch = await createChallenge(request, {
    name: 'Dash Live', start_date: '2042-03-01', end_date: '2042-03-10', budget_inr: 2000, priority: 'high',
  });
  const targets = await (await request.get('/api/settings')).json();
  await log(request, '2042-03-01', { extra_spent_inr: 500 });
  await openChallenge(page, ch, { today: '2042-03-04' });

  await expect(page.locator('h1')).toHaveText('Dash Live');
  await expect(page.locator('.badge-day')).toHaveText('Day 4 of 10');
  await expect(page.locator('.stat-grid')).toContainText('30% complete');
  await expect(page.locator('.stat-grid')).toContainText('7 days remaining');
  await expect(page.locator('.stat-grid')).toContainText('Not yet logged');

  const budget = page.locator('.card', { has: page.locator('.card-title', { hasText: 'Extra Spending' }) });
  await expect(budget).toContainText('₹500');
  await expect(budget).toContainText('₹2,000');
  await expect(budget).toContainText('₹1,500');

  // Log today, then the dashboard reflects it
  await log(request, '2042-03-04', {
    weight_kg: 71.2, total_steps: 9000, calories_kcal: 1800, protein_g: 120, water_l: 3,
    bedtime: '23:00', wake_time: '06:30', career_study_min: 90,
    cardio_completed: 1, brush_teeth: 1, porn_free: 0,
  });
  await page.reload();
  await expect(page.locator('.stat-grid')).toContainText('Logged today');
  const metric = (label) => page.locator('.metric-tile', { has: page.locator('.metric-tile-label', { hasText: label }) });
  await expect(metric('Weight')).toContainText('71.2 kg');
  await expect(metric('Steps')).toContainText('9,000');
  await expect(metric('Calories')).toContainText(`1800 / ${targets.calorie_target_kcal} kcal`);
  await expect(metric('Protein')).toContainText(`120 / ${targets.protein_target_g} g`);
  await expect(metric('Sleep')).toContainText('7h 30m');
  await expect(metric('Study')).toContainText('1h 30m');

  const habit = (label) => page.locator('.habit-row', { hasText: label }).locator('.habit-indicator');
  await expect(habit('Fitness')).toHaveClass(/complete/);
  await expect(habit('Oral & Skin Care')).toHaveClass(/complete/);
  await expect(habit('Mental Discipline')).toHaveClass(/incomplete/);
  await expect(habit('Sleep')).toHaveClass(/complete/);
  await expect(habit('Spirituality')).toHaveClass(/missing/);

  // Habit rows open the log on that section
  await page.locator('.habit-row', { hasText: 'Nutrition' }).click();
  await expect(page).toHaveURL(/#daily-log\?date=2042-03-04&section=nutrition/);
});

// ─── Calendar ───────────────────────────────────────────────────
test('calendar spans every month of the challenge and links to each day', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Cal Span', start_date: '2042-04-28', end_date: '2042-06-02' });
  await log(request, '2042-04-29', { weight_kg: 70 });
  await log(request, '2042-05-02', {
    weight_kg: 70, total_steps: 5000, calories_kcal: 2000, protein_g: 100, water_l: 2, cardio_completed: 1,
  });
  await openChallenge(page, ch, { today: '2042-05-02', hash: 'calendar' });

  await expect(page.locator('.page-subtitle')).toHaveText('28 April 2042 – 2 June 2042 (36 Days)');
  await expect(page.locator('#calendar-content h3')).toHaveText(['April 2042', 'May 2042', 'June 2042']);
  await expect(page.locator('.calendar-day.challenge-day')).toHaveCount(36);
  await expect(page.locator('.calendar-day[data-date="2042-04-28"] .cday-tag')).toHaveText('D1');
  await expect(page.locator('.calendar-day[data-date="2042-06-02"] .cday-tag')).toHaveText('D36');
  await expect(page.locator('.calendar-day[data-date="2042-04-27"]')).toHaveClass(/outside-day/);
  await expect(page.locator('.calendar-day[data-date="2042-05-02"]')).toHaveClass(/today-card/);

  // Summary counts and status dots
  const summary = page.locator('#calendar-content .grid-3');
  await expect(summary).toContainText(/1\s*Complete Logs/);
  await expect(summary).toContainText(/1\s*Partial Logs/);
  await expect(summary).toContainText(/34\s*Unlogged Days/);
  await expect(page.locator('.calendar-day[data-date="2042-04-29"] .day-status-dot')).toHaveClass(/dot-warning/);
  await expect(page.locator('.calendar-day[data-date="2042-05-02"] .day-status-dot')).toHaveClass(/dot-success/);

  // Clicking a day opens its log; outside days do nothing
  await page.click('.calendar-day[data-date="2042-04-27"]');
  await expect(page).toHaveURL(/#calendar$/);
  await page.click('.calendar-day[data-date="2042-05-20"]');
  await expect(page).toHaveURL(/#daily-log\?date=2042-05-20/);
  await expect(page.locator('#log-day-badge')).toHaveText('Day 23 of 36');
});

// ─── Trends ─────────────────────────────────────────────────────
test('trends draw charts from this challenge only', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Trend Lines', start_date: '2042-07-01', end_date: '2042-07-07' });
  await log(request, '2042-07-01', { weight_kg: 74, calories_kcal: 2100, extra_spent_inr: 100, cardio_completed: 1 });
  await log(request, '2042-07-02', { weight_kg: 73.5, calories_kcal: 1900, extra_spent_inr: 50, cardio_completed: 0 });
  await log(request, '2042-07-03', { weight_kg: 73.1, cardio_completed: 1 });
  // Another challenge's data must not leak in
  await createChallenge(request, { name: 'Trend Other', start_date: '2042-08-01', end_date: '2042-08-03' });
  await log(request, '2042-08-01', { weight_kg: 90 });
  await openChallenge(page, ch, { today: '2042-07-03', hash: 'trends' });

  await expect(page.locator('.page-subtitle')).toHaveText('7-day challenge visual history and habit compliance');
  const chart = (title) => page.locator('.card', { has: page.locator('h3', { hasText: title }) });
  await expect(chart('Body Weight').locator('.badge')).toHaveText('3 data points');
  await expect(chart('Body Weight').locator('svg circle')).toHaveCount(3);
  await expect(chart('Daily Calories').locator('.badge')).toHaveText('2 data points');
  await expect(chart('Daily Spending').locator('.badge')).toHaveText('2 data points');
  await expect(chart('Daily Steps')).toContainText('Not enough data points yet');

  const row = page.locator('tr', { hasText: 'Cardio Completed' });
  await expect(row.locator('td')).toHaveText(['Cardio Completed', '3', '2', /67%/]);
});

// ─── Final Review ───────────────────────────────────────────────
test('final review summarises the challenge', async ({ page, request }) => {
  const ch = await createChallenge(request, {
    name: 'Review Me', start_date: '2042-09-01', end_date: '2042-09-05', budget_inr: 1000,
  });
  await log(request, '2042-09-01', {
    weight_kg: 80, total_steps: 8000, protein_g: 100, bedtime: '23:00', wake_time: '07:00',
    workout_type: 'Legs', cardio_completed: 1, career_study_min: 60, extra_spent_inr: 300,
  });
  await log(request, '2042-09-05', {
    weight_kg: 78.5, total_steps: 12000, protein_g: 140, bedtime: '22:00', wake_time: '05:00',
    workout_type: 'Rest', career_study_min: 90, extra_spent_inr: 200,
  });
  await openChallenge(page, ch, { today: '2042-09-06', hash: 'final-review' });

  await expect(page.locator('h1')).toHaveText('Review Me — Final Review');
  await expect(page.locator('.page-subtitle')).toContainText('6 September 2042');
  const content = page.locator('#review-content');
  await expect(content).toContainText('2 of 5 Days Logged');
  await expect(content).toContainText('3 days have missing or partial records.');
  await expect(content).toContainText('Body Measurements (Day 1 vs Day 5)');
  await expect(content).toContainText('Day 1 (1 September 2042)');
  await expect(content).toContainText('Day 5 (5 September 2042)');

  const weightRow = page.locator('tr', { hasText: 'Body Weight' });
  await expect(weightRow.locator('td')).toHaveText(['Body Weight (kg)', '80 kg', '78.5 kg', '-1.5 kg']);

  const line = (label) => page.locator('.flex', { has: page.locator('span', { hasText: label }) }).last();
  await expect(line('Total Gym Sessions')).toContainText('1 sessions');
  await expect(line('Total Cardio Sessions')).toContainText('1 sessions');
  await expect(line('Average Daily Steps')).toContainText('10,000 steps/day');
  await expect(line('Average Daily Protein')).toContainText('120.0 g/day');
  await expect(line('Average Sleep Duration')).toContainText('7h 30m');
  await expect(line('Total AI/ML Study Hours')).toContainText('2.5 hours');

  await expect(content).toContainText('₹500');
  await expect(content).toContainText('₹1,000');
  await expect(content).toContainText('Under budget with ₹500 remaining');
});
