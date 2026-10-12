// Browser copy: data the server loses (Render free tier wipes it) comes back from this browser.
const { test, expect, createChallenge, openChallenge } = require('./helpers');

test('a challenge the server lost is restored from the browser copy', async ({ page, request }) => {
  const challenge = await createChallenge(request, {
    name: 'Survives Restart', start_date: '2027-03-01', end_date: '2027-03-21',
  });
  await openChallenge(page, challenge, { today: '2027-03-02', hash: 'challenges' });

  // The browser has saved its copy
  await expect.poll(() => page.evaluate(() =>
    (JSON.parse(localStorage.getItem('epic-davinci.backup')) || { challenges: [] })
      .challenges.some((c) => c.name === 'Survives Restart'))).toBe(true);

  // Simulate a wiped server: the data is gone and the database is a different copy
  await request.delete(`/api/challenges/${challenge.id}`);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('epic-davinci.backup'));
    saved.instanceId = 'database-before-restart';
    localStorage.setItem('epic-davinci.backup', JSON.stringify(saved));
  });

  await page.reload();
  await expect(page.locator('.toast').filter({ hasText: 'Restored your data' })).toBeVisible();
  await expect(page.locator('article.challenge-card h3', { hasText: 'Survives Restart' })).toBeVisible();
  await expect(page.locator('.sidebar-challenge-name')).toHaveText('Survives Restart');

  const res = await request.get(`/api/challenges/${challenge.id}`);
  expect(res.status()).toBe(200);
  // Clean up so later tests start from the same state
  await request.delete(`/api/challenges/${challenge.id}`);
});
