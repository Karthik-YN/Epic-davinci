// Daily Log: navigation, autosave, toggles, sleep, nutrition targets, budget, validation.
const {
  test, expect, allowValidationErrors, createChallenge, openChallenge, waitForLogSave, expectSavedLog,
} = require('./helpers');

test('header and day navigation stay inside the challenge', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Nav', start_date: '2041-01-10', end_date: '2041-01-12' });
  await openChallenge(page, ch, { today: '2041-01-10', hash: 'daily-log' });

  await expect(page.locator('#log-day-badge')).toHaveText('Day 1 of 3');
  await expect(page.locator('#log-date-status')).toHaveText("Today's daily record");
  await expect(page.locator('#prev-day-btn')).toBeDisabled();
  await expect(page.locator('#next-day-btn')).toBeEnabled();

  await page.click('#next-day-btn');
  await expect(page).toHaveURL(/date=2041-01-11/);
  await expect(page.locator('#log-day-badge')).toHaveText('Day 2 of 3');
  await expect(page.locator('#log-date-status')).toHaveText('Future date record');

  await page.click('#next-day-btn');
  await expect(page.locator('#log-day-badge')).toHaveText('Day 3 of 3');
  await expect(page.locator('#next-day-btn')).toBeDisabled();

  await page.click('#prev-day-btn');
  await expect(page.locator('#log-day-badge')).toHaveText('Day 2 of 3');
});

test('dates outside the challenge are clamped or refused', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Clamp', start_date: '2041-02-10', end_date: '2041-02-14' });
  await openChallenge(page, ch, { today: '2041-02-20', hash: 'daily-log' });
  // Today is after the challenge → shows its last day
  await expect(page.locator('#log-day-badge')).toHaveText('Day 5 of 5');
  await expect(page.locator('#date-picker')).toHaveAttribute('min', '2041-02-10');
  await expect(page.locator('#date-picker')).toHaveAttribute('max', '2041-02-14');

  await page.fill('#date-picker', '2041-03-01');
  await page.dispatchEvent('#date-picker', 'change');
  await expect(page.locator('#toast-container')).toContainText('outside this 5-day challenge window');
  await expect(page.locator('#date-picker')).toHaveValue('2041-02-14');

  await page.goto('/#daily-log?date=2041-01-01');
  await expect(page.locator('#log-day-badge')).toHaveText('Day 1 of 5');
});

test('typed values autosave and are there after a reload', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Save', start_date: '2041-03-01', end_date: '2041-03-07' });
  await openChallenge(page, ch, { today: '2041-03-02', hash: 'daily-log' });

  await page.fill('#weight_kg', '72.4');
  await page.fill('#total_steps', '10500');
  await page.selectOption('#workout_type', 'Legs');
  await page.fill('#career_topic', 'Transformers');
  await page.fill('#best_thing', 'Finished the gym session');

  // No Save click: the debounced autosave stores everything
  await expectSavedLog(request, '2041-03-02', {
    weight_kg: 72.4, total_steps: 10500, workout_type: 'Legs',
    career_topic: 'Transformers', best_thing: 'Finished the gym session',
  });
  await expect(page.locator('#save-status')).toHaveText('✓ Saved');
  await page.reload();
  await expect(page.locator('#weight_kg')).toHaveValue('72.4');
  await expect(page.locator('#total_steps')).toHaveValue('10500');
  await expect(page.locator('#workout_type')).toHaveValue('Legs');
  await expect(page.locator('#career_topic')).toHaveValue('Transformers');
  await expect(page.locator('#best_thing')).toHaveValue('Finished the gym session');

  // The Save button works too
  await page.fill('#priority_1', 'Meal prep');
  const manual = waitForLogSave(page, '2041-03-02');
  await page.click('#manual-save-btn');
  await manual;
  await expectSavedLog(request, '2041-03-02', { weight_kg: 72.4, priority_1: 'Meal prep' });
});

test('yes/no toggles set, change and clear values', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Toggles', start_date: '2041-04-01', end_date: '2041-04-07' });
  await openChallenge(page, ch, { today: '2041-04-01', hash: 'daily-log' });
  const toggle = page.locator('.yn-toggle[data-field="cardio_completed"]');

  await toggle.locator('.yn-btn.yes').click();
  await expect(toggle.locator('.yn-btn.yes')).toHaveClass(/active/);
  await toggle.locator('.yn-btn.no').click();
  await expect(toggle.locator('.yn-btn.no')).toHaveClass(/active/);
  await expect(toggle.locator('.yn-btn.yes')).not.toHaveClass(/active/);

  const hair = page.locator('.hair-toggle');
  await hair.locator('.yn-btn[data-val="2"]').click();
  await expect(hair.locator('.yn-btn[data-val="2"]')).toHaveClass(/active/);

  await page.locator('.yn-toggle[data-field="porn_free"] .yn-btn.yes').click();
  // Clicking the active option again clears it
  await page.locator('.yn-toggle[data-field="hanuman_chalisa"] .yn-btn.yes').click();
  await page.locator('.yn-toggle[data-field="hanuman_chalisa"] .yn-btn.yes').click();

  await expectSavedLog(request, '2041-04-01', { cardio_completed: 0, hair_care: 2, porn_free: 1, hanuman_chalisa: null });

  await page.reload();
  await expect(toggle.locator('.yn-btn.no')).toHaveClass(/active/);
  await expect(hair.locator('.yn-btn[data-val="2"]')).toHaveClass(/active/);
});

test('sleep duration is calculated across midnight and can be overridden', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Sleep', start_date: '2041-05-01', end_date: '2041-05-07' });
  await openChallenge(page, ch, { today: '2041-05-02', hash: 'daily-log' });

  await page.fill('#bedtime', '23:30');
  await page.fill('#wake_time', '06:45');
  await expect(page.locator('#sleep-duration-val')).toHaveText('7h 15m');
  await expect(page.locator('#sleep-duration-hint')).toContainText('Calculated');

  await expectSavedLog(request, '2041-05-02', { bedtime: '23:30', wake_time: '06:45', sleep_duration_min: 435 });

  await expect(page.locator('#manual-sleep-group')).toBeHidden();
  await page.check('#sleep_manual_override');
  await expect(page.locator('#manual-sleep-group')).toBeVisible();
  await page.fill('#sleep_duration_min', '480');
  await expectSavedLog(request, '2041-05-02', { sleep_duration_min: 480, sleep_manual_override: 1 });
  await page.reload();
  await expect(page.locator('#sleep-duration-val')).toHaveText('8h');
  await expect(page.locator('#sleep-duration-hint')).toHaveText('Manually overridden');
});

test('nutrition: macros save and are compared with the daily targets', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Food', start_date: '2041-06-01', end_date: '2041-06-07' });
  const targets = await (await request.get('/api/settings')).json();
  await openChallenge(page, ch, { today: '2041-06-03', hash: 'daily-log' });

  const tile = (field) => page.locator(`.target-tile[data-target-field="${field}"]`);
  await expect(page.locator('.target-tile')).toHaveCount(6);
  await expect(tile('protein_g')).toHaveClass(/target-pending/);
  await expect(page.locator('label[for="protein_g"] .target-hint')).toHaveText(`Target ${targets.protein_target_g} g`);

  const over = targets.calorie_target_kcal + 400;
  await page.fill('#calories_kcal', String(over));
  await page.fill('#protein_g', String(targets.protein_target_g + 10));
  await page.fill('#carbs_g', '100');
  await page.fill('#fat_g', '55.5');
  await page.fill('#fiber_g', '12');
  await page.fill('#water_l', String(targets.water_target_l));

  // Tiles update while typing
  await expect(tile('calories_kcal')).toHaveClass(/target-over/);
  await expect(tile('calories_kcal')).toContainText('400 kcal over');
  await expect(tile('protein_g')).toHaveClass(/target-hit/);
  await expect(tile('protein_g')).toContainText('Target reached');
  await expect(tile('carbs_g')).toHaveClass(/target-under/);
  await expect(tile('carbs_g')).toContainText(`${targets.carbs_target_g - 100} g left`);
  await expect(tile('fiber_g')).toContainText(`${targets.fiber_target_g - 12} g to go`);
  await expect(tile('water_l')).toHaveClass(/target-hit/);

  await expectSavedLog(request, '2041-06-03', { calories_kcal: over, carbs_g: 100, fat_g: 55.5, fiber_g: 12 });
  await page.reload();
  await expect(page.locator('#fat_g')).toHaveValue('55.5');
  await expect(page.locator('#fiber_g')).toHaveValue('12');
  await expect(tile('calories_kcal')).toHaveClass(/target-over/);
});

test('budget box uses the challenge budget and updates after saving', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Budget', start_date: '2041-07-01', end_date: '2041-07-07', budget_inr: 1000 });
  await request.post('/api/logs/2041-07-01', { data: { extra_spent_inr: 200 } });
  await openChallenge(page, ch, { today: '2041-07-02', hash: 'daily-log' });

  await expect(page.locator('#budget-summary-box')).toContainText('₹200 spent / ₹1,000');
  await expect(page.locator('#budget-summary-box')).toContainText('₹800 remaining');

  await page.fill('#extra_spent_inr', '900');
  await page.selectOption('#spending_category', 'Food');
  await expectSavedLog(request, '2041-07-02', { extra_spent_inr: 900, spending_category: 'Food' });
  await expect(page.locator('#budget-summary-box')).toContainText('Over budget by ₹100');
});

test('invalid values show an inline error and are not saved', async ({ page, request }) => {
  allowValidationErrors(page);
  const ch = await createChallenge(request, { name: 'Log Invalid', start_date: '2041-08-01', end_date: '2041-08-07' });
  await openChallenge(page, ch, { today: '2041-08-01', hash: 'daily-log' });

  await page.fill('#weight_kg', '500');
  const attempt = waitForLogSave(page, '2041-08-01');
  await page.click('#manual-save-btn');
  expect((await attempt).status()).toBe(400);
  await expect(page.locator('#err-weight_kg')).toHaveText('Must be between 30 and 200 kg');
  await expect(page.locator('#save-status')).toHaveText('✗ Save failed');
  expect((await request.get('/api/logs/2041-08-01')).status()).toBe(404);

  await page.fill('#weight_kg', '80');
  const ok = waitForLogSave(page, '2041-08-01');
  await page.click('#manual-save-btn');
  expect((await ok).status()).toBe(200);
  await expect(page.locator('#err-weight_kg')).toHaveText('');
});

test('leaving the page right after typing saves without a false "unsaved" prompt', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Leave', start_date: '2041-09-01', end_date: '2041-09-07' });
  await openChallenge(page, ch, { today: '2041-09-01', hash: 'daily-log' });
  await page.fill('#total_steps', '8000');
  await expectSavedLog(request, '2041-09-01', { total_steps: 8000 });
  await expect(page.locator('#save-status')).toHaveText('✓ Saved');
  await page.click('#sidebar .nav-link[data-page="calendar"]');
  await expect(page.locator('#confirm-modal')).toBeHidden();
  await expect(page).toHaveURL(/#calendar/);
  expect((await (await request.get('/api/logs/2041-09-01')).json()).total_steps).toBe(8000);
});

test('leaving with a save still pending asks first', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Pending', start_date: '2041-10-01', end_date: '2041-10-07' });
  await openChallenge(page, ch, { today: '2041-10-01', hash: 'daily-log' });
  await page.fill('#water_l', '2');
  // Navigate before the 1.5 s autosave fires
  await page.click('#sidebar .nav-link[data-page="trends"]');
  await expect(page.locator('#confirm-modal-message')).toHaveText('You have unsaved changes. Leave anyway?');
  await page.click('#confirm-modal-cancel');
  await expect(page).toHaveURL(/#daily-log/);
  await expect(page.locator('#water_l')).toHaveValue('2');
});

test('typing while a save is in flight is not lost (slow connection)', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Log Slow', start_date: '2041-11-01', end_date: '2041-11-07' });
  // Every save takes 1.2 s, like a slow mobile connection to a remote database
  await page.route('**/api/logs/2041-11-01', async (route) => {
    if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 1200));
    await route.continue();
  });
  await openChallenge(page, ch, { today: '2041-11-01', hash: 'daily-log' });

  await page.selectOption('#workout_type', 'Back');      // saves immediately
  await page.fill('#workout_notes', 'Deadlifts 3x5');      // typed during that save
  await page.fill('#best_thing', 'Hit a new PR');

  await expectSavedLog(request, '2041-11-01', {
    workout_type: 'Back', workout_notes: 'Deadlifts 3x5', best_thing: 'Hit a new PR',
  });
  await expect(page.locator('#save-status')).toHaveText('✓ Saved');
  await page.reload();
  await expect(page.locator('#workout_notes')).toHaveValue('Deadlifts 3x5');
});
