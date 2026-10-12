// Challenge Hub: creating, listing, editing, deleting and selecting challenges.
const {
  test, expect, allowValidationErrors, addDays, setToday, createChallenge, openChallenge, confirmDialog,
} = require('./helpers');

const card = (page, name) => page.locator('article.challenge-card', { has: page.locator('h3', { hasText: name }) });

async function openNewForm(page) {
  if (!(await page.locator('#challenge-form').isVisible())) {
    await page.click('#new-challenge-btn');
  }
  await expect(page.locator('#challenge-form')).toBeVisible();
}

async function setStart(page, date) {
  await page.fill('#ch-start', date);
  await page.dispatchEvent('#ch-start', 'change');
}

test('landing page is the Challenge Hub', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/#challenges$/);
  await expect(page.locator('h1')).toHaveText('Your Challenges');
  await expect(page.locator('.sidebar-challenge-empty')).toContainText('No challenge selected');
});

test('challenge pages redirect to the hub when nothing is selected', async ({ page }) => {
  for (const hash of ['dashboard', 'daily-log', 'calendar', 'trends', 'final-review']) {
    await page.goto(`/#${hash}`);
    await expect(page).toHaveURL(/#challenges$/);
    await expect(page.locator('#toast-container')).toContainText('Pick a challenge first');
  }
  // Settings is app-wide and works without a challenge
  await page.goto('/#settings');
  await expect(page.locator('h1')).toHaveText('Application Settings');
});

test('create a 7-day challenge with a preset and land on its dashboard', async ({ page }) => {
  await setToday(page, '2030-03-12');
  await page.goto('/#challenges');
  await openNewForm(page);

  await page.fill('#ch-name', 'Seven Day Reset');
  await setStart(page, '2030-03-10');
  await page.click('#duration-chips .chip[data-days="7"]');
  await expect(page.locator('#ch-end')).toHaveValue('2030-03-16');
  await expect(page.locator('#duration-summary')).toContainText('7 days');
  await expect(page.locator('#duration-summary')).toContainText('Final review 17 March 2030');
  await expect(page.locator('#duration-chips .chip.active')).toHaveText('7 days');

  await page.click('.priority-option[data-priority="high"]');
  await page.fill('#ch-budget', '700');
  await page.fill('#ch-description', 'Reset my routine');
  await page.click('#challenge-form button[type="submit"]');

  await expect(page).toHaveURL(/#dashboard/);
  await expect(page.locator('h1')).toHaveText('Seven Day Reset');
  await expect(page.locator('.badge-day')).toHaveText('Day 3 of 7');
  await expect(page.locator('.sidebar-challenge-name')).toHaveText('Seven Day Reset');
  await expect(page.locator('.sidebar-challenge-card .priority-pill')).toHaveText('High priority');
  await expect(page.locator('.sidebar-challenge-status')).toContainText('Day 3 of 7');

  // Saved exactly as entered
  const list = await (await page.request.get('/api/challenges')).json();
  expect(list.find(c => c.name === 'Seven Day Reset')).toMatchObject({
    start_date: '2030-03-10', end_date: '2030-03-16', priority: 'high', budget_inr: 700,
    description: 'Reset my routine', total_days: 7,
  });
});

test('every duration preset sets the right end date', async ({ page }) => {
  await page.goto('/#challenges');
  await openNewForm(page);
  await setStart(page, '2031-01-01');
  for (const [days, end] of [[3, '2031-01-03'], [14, '2031-01-14'], [21, '2031-01-21'], [30, '2031-01-30'], [90, '2031-03-31']]) {
    await page.click(`#duration-chips .chip[data-days="${days}"]`);
    await expect(page.locator('#ch-end')).toHaveValue(end);
    await expect(page.locator('#duration-summary')).toContainText(`${days} days`);
  }
});

test('custom end date and moving the start date', async ({ page }) => {
  await page.goto('/#challenges');
  await openNewForm(page);
  await setStart(page, '2031-05-01');
  await page.fill('#ch-end', '2031-05-10');
  await page.dispatchEvent('#ch-end', 'change');
  await expect(page.locator('#duration-summary')).toContainText('10 days');
  await expect(page.locator('#duration-chips .chip.active')).toHaveText('Custom');

  // Moving the start keeps the 10-day length
  await setStart(page, '2031-05-05');
  await expect(page.locator('#ch-end')).toHaveValue('2031-05-14');
  await expect(page.locator('#duration-summary')).toContainText('10 days');

  // A matching preset length lights up its chip
  await page.fill('#ch-end', '2031-05-11');
  await page.dispatchEvent('#ch-end', 'change');
  await expect(page.locator('#duration-chips .chip.active')).toHaveText('7 days');
});

test('form validation: missing name and end before start', async ({ page }) => {
  allowValidationErrors(page);
  await page.goto('/#challenges');
  await openNewForm(page);
  await setStart(page, '2032-06-10');
  await page.fill('#ch-end', '2032-06-01');
  await page.dispatchEvent('#ch-end', 'change');
  await expect(page.locator('#duration-summary')).toHaveClass(/invalid/);

  await page.click('#challenge-form button[type="submit"]');
  await expect(page.locator('#err-name')).toHaveText('Name is required');
  await expect(page.locator('#err-end_date')).toHaveText('End date must be on or after the start date');
  await expect(page).toHaveURL(/#challenges$/);
});

test('overlapping dates ask first; cancel creates nothing, confirm creates it', async ({ page, request }) => {
  await createChallenge(request, { name: 'Overlap Base', start_date: '2033-04-01', end_date: '2033-04-21' });
  await page.goto('/#challenges');
  await openNewForm(page);
  await page.fill('#ch-name', 'Overlap New');
  await setStart(page, '2033-04-15');
  await page.click('#duration-chips .chip[data-days="7"]');

  await page.click('#challenge-form button[type="submit"]');
  await expect(page.locator('#confirm-modal-message')).toContainText('"Overlap Base"');
  await confirmDialog(page, false);
  let names = (await (await request.get('/api/challenges')).json()).map(c => c.name);
  expect(names).not.toContain('Overlap New');

  await page.click('#challenge-form button[type="submit"]');
  await confirmDialog(page, true);
  await expect(page).toHaveURL(/#dashboard/);
  names = (await (await request.get('/api/challenges')).json()).map(c => c.name);
  expect(names).toContain('Overlap New');
});

test('list groups challenges into active, upcoming and completed', async ({ page, request }) => {
  const today = '2034-06-15';
  await createChallenge(request, { name: 'Now Running', start_date: '2034-06-13', end_date: '2034-06-19', priority: 'high' });
  await createChallenge(request, { name: 'Coming Up', start_date: '2034-06-20', end_date: '2034-06-22', priority: 'low' });
  await createChallenge(request, { name: 'All Done', start_date: '2034-06-01', end_date: '2034-06-10' });
  await setToday(page, today);
  await page.goto('/#challenges');

  const section = (title) => page.locator('section', { has: page.locator('h2', { hasText: title }) });
  await expect(section('Active now').locator('h3', { hasText: 'Now Running' })).toBeVisible();
  await expect(section('Upcoming').locator('h3', { hasText: 'Coming Up' })).toBeVisible();
  await expect(section('Completed').locator('h3', { hasText: 'All Done' })).toBeVisible();

  await expect(card(page, 'Now Running').locator('.status-pill')).toHaveText('Day 3 of 7');
  await expect(card(page, 'Coming Up').locator('.status-pill')).toHaveText('Starts in 5 days');
  await expect(card(page, 'All Done').locator('.status-pill')).toHaveText('Completed');
  await expect(card(page, 'Now Running').locator('.priority-pill')).toHaveText('High');
  await expect(card(page, 'Coming Up').locator('.priority-pill')).toHaveText('Low');
  await expect(card(page, 'Now Running')).toContainText('7 days');
});

test('enter a challenge from its card, and the choice survives a reload', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Pick Me', start_date: '2035-02-01', end_date: '2035-02-05' });
  await setToday(page, '2035-02-02');
  await page.goto('/#challenges');
  await card(page, 'Pick Me').locator('.open-btn').click();
  await expect(page).toHaveURL(/#dashboard/);
  await expect(page.locator('.badge-day')).toHaveText('Day 2 of 5');

  await page.goto('/#daily-log');
  await expect(page.locator('.sidebar-challenge-name')).toHaveText('Pick Me');
  await expect(page.locator('#log-day-badge')).toHaveText('Day 2 of 5');

  await page.goto('/#challenges');
  await expect(card(page, 'Pick Me')).toHaveClass(/is-current/);
  await expect(card(page, 'Pick Me').locator('.open-btn')).toHaveText('Continue →');
  expect(ch.id).toBeGreaterThan(0);
});

test('edit a challenge: rename, change dates and priority', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Edit Me', start_date: '2036-01-01', end_date: '2036-01-07' });
  await openChallenge(page, ch, { today: '2036-01-02', hash: 'challenges' });

  await card(page, 'Edit Me').locator('.edit-btn').click();
  await expect(page.locator('#challenge-form .card-title')).toHaveText('Edit challenge');
  await expect(page.locator('#ch-name')).toHaveValue('Edit Me');
  await expect(page.locator('#duration-chips .chip.active')).toHaveText('7 days');

  await page.fill('#ch-name', 'Edited Sprint');
  await page.click('#duration-chips .chip[data-days="21"]');
  await page.click('.priority-option[data-priority="low"]');
  await page.click('#challenge-form button[type="submit"]');

  await expect(page.locator('#toast-container')).toContainText('Challenge updated');
  await expect(card(page, 'Edited Sprint')).toContainText('21 days');
  await expect(card(page, 'Edited Sprint').locator('.priority-pill')).toHaveText('Low');
  // The sidebar follows the edit because it's the selected challenge
  await expect(page.locator('.sidebar-challenge-name')).toHaveText('Edited Sprint');
  await expect(page.locator('.sidebar-challenge-dates')).toContainText('21 days');
});

test('deleted challenge stays deleted after a reload', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Delete Me', start_date: '2037-07-01', end_date: '2037-07-03' });
  await request.post(`/api/challenges/${ch.id}/notes`, { data: { content: 'bye' } });
  await openChallenge(page, ch, { today: '2037-07-02', hash: 'challenges' });

  // Cancel keeps it
  await card(page, 'Delete Me').locator('.delete-btn').click();
  await confirmDialog(page, false);
  await expect(card(page, 'Delete Me')).toBeVisible();

  await card(page, 'Delete Me').locator('.delete-btn').click();
  await expect(page.locator('#confirm-modal-message')).toContainText('daily logs for these dates are kept');
  await confirmDialog(page, true);
  await expect(page.locator('#toast-container')).toContainText('Challenge deleted');
  await expect(card(page, 'Delete Me')).toHaveCount(0);
  await expect(page.locator('.sidebar-challenge-empty')).toBeVisible();

  await page.reload();
  await expect(page.locator('h1')).toHaveText('Your Challenges');
  await expect(card(page, 'Delete Me')).toHaveCount(0);
  expect((await request.get(`/api/challenges/${ch.id}`)).status()).toBe(404);
  expect((await request.get(`/api/challenges/${ch.id}/notes`)).status()).toBe(404);
});

test('a challenge deleted elsewhere is dropped from the saved selection', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Gone Elsewhere', start_date: '2038-03-01', end_date: '2038-03-05' });
  await openChallenge(page, ch, { today: '2038-03-02' });
  await request.delete(`/api/challenges/${ch.id}`);

  // A fresh visit (new tab) to a challenge page goes back to the hub
  const fresh = await page.context().newPage();
  await fresh.goto('/#dashboard');
  await expect(fresh).toHaveURL(/#challenges$/);
  await expect(fresh.locator('.sidebar-challenge-empty')).toBeVisible();
  expect(await fresh.evaluate(() => localStorage.getItem('epic-davinci.activeChallengeId'))).toBeNull();
  await fresh.close();
});

test('hub card shows logged days and note count', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Counts', start_date: '2039-01-01', end_date: '2039-01-10', budget_inr: 999 });
  await request.post('/api/logs/2039-01-02', { data: { weight_kg: 70 } });
  await request.post('/api/logs/2039-01-03', { data: { weight_kg: 70 } });
  await request.post(`/api/challenges/${ch.id}/notes`, { data: { content: 'one' } });
  await setToday(page, addDays('2039-01-01', 3));
  await page.goto('/#challenges');
  await expect(card(page, 'Counts')).toContainText('2/10 logged');
  await expect(card(page, 'Counts')).toContainText('1 note');
  await expect(card(page, 'Counts')).toContainText('₹999');
});
