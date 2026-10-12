// Settings: nutrition targets, budget, waist measurements, export.
const { test, expect, allowValidationErrors, createChallenge, openChallenge } = require('./helpers');

const DEFAULT_TARGETS = {
  calorie_target_kcal: 2200, protein_target_g: 140, carbs_target_g: 220,
  fat_target_g: 70, fiber_target_g: 30, water_target_l: 3.5,
};

// Settings are app-wide: put them back after each test
test.afterEach(async ({ request }) => {
  await request.put('/api/settings', {
    data: { ...DEFAULT_TARGETS, budget_inr: 1500, waist_start_cm: null, waist_end_cm: null },
  });
});

test('settings show the selected challenge and link to change it', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Settings View', start_date: '2043-01-01', end_date: '2043-01-14' });
  await openChallenge(page, ch, { today: '2043-01-02', hash: 'settings' });
  const overview = page.locator('#settings-content .card').first();
  await expect(overview).toContainText('Settings View');
  await expect(overview).toContainText('1 January 2043');
  await expect(overview).toContainText('End Date (14 days)');
  await expect(overview).toContainText('15 January 2043');
  await overview.locator('a', { hasText: 'Change dates / switch' }).click();
  await expect(page).toHaveURL(/#challenges/);
});

test('nutrition targets save, persist, and show up on the daily log', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Settings Targets', start_date: '2043-02-01', end_date: '2043-02-07' });
  await openChallenge(page, ch, { today: '2043-02-02', hash: 'settings' });

  const values = {
    calorie_target_kcal: '1900', protein_target_g: '160', carbs_target_g: '180',
    fat_target_g: '60', fiber_target_g: '35', water_target_l: '4.2',
  };
  for (const [id, v] of Object.entries(values)) await page.fill(`#${id}`, v);
  await page.click('#save-settings-btn');
  await expect(page.locator('#toast-container')).toContainText('Settings saved successfully');

  await page.reload();
  for (const [id, v] of Object.entries(values)) await expect(page.locator(`#${id}`)).toHaveValue(v);

  await page.click('#sidebar .nav-link[data-page="daily-log"]');
  await expect(page.locator('label[for="calories_kcal"] .target-hint')).toHaveText('Target 1900 kcal');
  await expect(page.locator('label[for="protein_g"] .target-hint')).toHaveText('Target 160 g');
  await expect(page.locator('label[for="water_l"] .target-hint')).toHaveText('Target 4.2 L');
  await expect(page.locator('.target-tile[data-target-field="fiber_g"]')).toContainText('/ 35 g');
});

test('clearing a target hides it from the daily log', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Settings Clear', start_date: '2043-03-01', end_date: '2043-03-07' });
  await openChallenge(page, ch, { today: '2043-03-02', hash: 'settings' });
  await page.fill('#fiber_target_g', '');
  await page.click('#save-settings-btn');
  await expect(page.locator('#toast-container')).toContainText('Settings saved successfully');
  await page.click('#sidebar .nav-link[data-page="daily-log"]');
  await expect(page.locator('.target-tile')).toHaveCount(5);
  await expect(page.locator('label[for="fiber_g"] .target-hint')).toHaveCount(0);
});

test('negative target is rejected with an inline error', async ({ page }) => {
  allowValidationErrors(page);
  await page.goto('/#settings');
  await page.fill('#fat_target_g', '-5');
  await page.click('#save-settings-btn');
  await expect(page.locator('#err-fat_target_g')).toHaveText('Must be a non-negative number');
  await expect(page.locator('#toast-container')).toContainText('Validation failed');
  expect((await (await page.request.get('/api/settings')).json()).fat_target_g).toBe(70);
});

test('global budget applies when a challenge has none of its own', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Settings Budget', start_date: '2043-04-01', end_date: '2043-04-07' });
  await request.post('/api/logs/2043-04-01', { data: { extra_spent_inr: 250 } });
  await openChallenge(page, ch, { today: '2043-04-02', hash: 'settings' });
  await page.fill('#budget_inr', '3000');
  await page.click('#save-settings-btn');
  await expect(page.locator('#toast-container')).toContainText('Settings saved successfully');

  await page.click('#sidebar .nav-link[data-page="dashboard"]');
  const budget = page.locator('.card', { has: page.locator('.card-title', { hasText: 'Extra Spending' }) });
  await expect(budget).toContainText('₹3,000');
  await expect(budget).toContainText('₹2,750');
});

test('waist measurements appear in the final review', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Settings Waist', start_date: '2043-05-01', end_date: '2043-05-07' });
  await openChallenge(page, ch, { today: '2043-05-08', hash: 'settings' });
  await page.fill('#waist_start_cm', '90');
  await page.fill('#waist_end_cm', '87.5');
  await page.click('#save-settings-btn');
  await expect(page.locator('#toast-container')).toContainText('Settings saved successfully');

  await page.click('#sidebar .nav-link[data-page="final-review"]');
  const waist = page.locator('tr', { hasText: 'Waist Circumference' });
  await expect(waist.locator('td')).toHaveText(['Waist Circumference (cm)', '90 cm', '87.5 cm', '-2.5 cm']);
});

test('JSON and CSV exports download everything', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Settings Export', start_date: '2043-06-01', end_date: '2043-06-07' });
  await request.post(`/api/challenges/${ch.id}/notes`, { data: { content: 'export me' } });
  await request.post('/api/logs/2043-06-01', { data: { weight_kg: 75, carbs_g: 150 } });
  await openChallenge(page, ch, { today: '2043-06-02', hash: 'settings' });

  const [json] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a[href="/api/export/json"]'),
  ]);
  const data = JSON.parse(require('fs').readFileSync(await json.path(), 'utf8'));
  expect(data.challenges.map(c => c.name)).toContain('Settings Export');
  expect(data.notes.map(n => n.content)).toContain('export me');
  expect(data.logs.find(l => l.date === '2043-06-01')).toMatchObject({ weight_kg: 75, carbs_g: 150 });

  const [csv] = await Promise.all([
    page.waitForEvent('download'),
    page.click('a[href="/api/export/csv"]'),
  ]);
  const text = require('fs').readFileSync(await csv.path(), 'utf8');
  expect(text.split('\n')[0]).toContain('carbs_g');
  expect(text).toContain('2043-06-01');
});
