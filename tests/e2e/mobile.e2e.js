// Phone layout: top bar, notes drawer, and no sideways scrolling.
const { test, expect, createChallenge, openChallenge } = require('./helpers');

test('top bar shows the challenge and opens the notes drawer', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Phone Challenge', start_date: '2044-01-01', end_date: '2044-01-21' });
  await request.post(`/api/challenges/${ch.id}/notes`, { data: { category: 'priority', content: 'Gym at 7am' } });

  await page.addInitScript((id) => localStorage.setItem('epic-davinci.activeChallengeId', String(id)), ch.id);
  await page.clock.setFixedTime(new Date('2044-01-05T09:00:00+05:30'));
  await page.goto('/#dashboard');

  await expect(page.locator('#mobile-topbar')).toBeVisible();
  await expect(page.locator('#mobile-challenge-name')).toHaveText('Phone Challenge');
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('#bottom-nav')).toBeVisible();

  // Open the drawer and add a note from it
  await page.click('#mobile-notes-btn');
  await expect(page.locator('#sidebar')).toBeVisible();
  await expect(page.locator('.note-text')).toHaveText(['Gym at 7am']);
  await page.fill('#note-content', 'Drink 4L water');
  await page.click('#note-form button[type="submit"]');
  await expect(page.locator('.note-item')).toHaveCount(2);

  // Tapping the backdrop closes it
  await page.click('#sidebar-backdrop', { position: { x: 370, y: 400 } });
  await expect(page.locator('#sidebar')).toBeHidden();

  // A nav link inside the drawer navigates and closes it
  await page.click('#mobile-notes-btn');
  await page.click('#sidebar .nav-link[data-page="calendar"]');
  await expect(page).toHaveURL(/#calendar/);
  await expect(page.locator('#sidebar')).toBeHidden();

  // The top bar's challenge name goes to the hub
  await page.click('#mobile-topbar .mobile-challenge-link');
  await expect(page).toHaveURL(/#challenges/);
});

test('bottom navigation reaches every page', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Phone Nav', start_date: '2044-02-01', end_date: '2044-02-07' });
  await openChallenge(page, ch, { today: '2044-02-03' });
  for (const [p, heading] of [
    ['daily-log', /February 2044/], ['calendar', 'Challenge Calendar'], ['trends', 'Progress & Trends'],
    ['final-review', /Final Review/], ['settings', 'Application Settings'], ['dashboard', 'Phone Nav'],
  ]) {
    await page.click(`#bottom-nav .nav-link[data-page="${p}"]`);
    await expect(page).toHaveURL(new RegExp(`#${p}`));
    await expect(page.locator('#main-content h1')).toHaveText(heading);
  }
});

test('no page scrolls sideways on a phone', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Phone Width Check With A Long Name', start_date: '2044-03-01', end_date: '2044-03-31' });
  await request.post('/api/logs/2044-03-01', { data: { weight_kg: 70, calories_kcal: 2000 } });
  await request.post('/api/logs/2044-03-02', { data: { weight_kg: 69.5, calories_kcal: 2100 } });
  await openChallenge(page, ch, { today: '2044-03-02' });
  for (const p of ['challenges', 'dashboard', 'daily-log', 'calendar', 'trends', 'final-review', 'settings']) {
    await page.goto(`/#${p}`);
    await expect(page.locator('#main-content h1').first()).toBeVisible();
    await page.waitForTimeout(200);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${p} is ${overflow}px wider than the screen`).toBeLessThanOrEqual(0);
  }
});
