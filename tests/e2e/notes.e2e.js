// Priorities & notes in the sidebar.
const { test, expect, createChallenge, openChallenge, confirmDialog } = require('./helpers');

async function addNote(page, category, text) {
  const before = await page.locator('.note-item').count();
  await page.selectOption('#note-category', category);
  await page.fill('#note-content', text);
  await page.click('#note-form button[type="submit"]');
  await expect(page.locator('.note-item')).toHaveCount(before + 1);
}

const group = (page, label) => page.locator('.note-group', { has: page.locator('.note-group-title', { hasText: label }) });

test('add notes of every type; they are grouped in priority order', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Notes A', start_date: '2040-01-01', end_date: '2040-01-07' });
  await openChallenge(page, ch, { today: '2040-01-02' });
  await expect(page.locator('.sidebar-notes')).toContainText('Nothing yet');

  await addNote(page, 'note', 'Buy oats');
  await addNote(page, 'priority', 'Sleep by 11pm');
  await addNote(page, 'important', 'No sugar after 6pm');
  await addNote(page, 'reminder', 'Weigh in every morning');

  await expect(page.locator('.note-group-title')).toHaveText([
    '🎯 Priority', '⚠️ Important', '⏰ Reminder', '📝 Note',
  ]);
  await expect(group(page, 'Priority')).toContainText('Sleep by 11pm');
  await expect(group(page, 'Important')).toContainText('No sugar after 6pm');
  await expect(group(page, 'Reminder')).toContainText('Weigh in every morning');
  await expect(group(page, 'Note')).toContainText('Buy oats');
  // The input clears and keeps focus for the next note
  await expect(page.locator('#note-content')).toHaveValue('');
  await expect(page.locator('#note-content')).toBeFocused();
});

test('pressing Enter adds a note; blank notes are ignored', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Notes B', start_date: '2040-02-01', end_date: '2040-02-07' });
  await openChallenge(page, ch, { today: '2040-02-02' });

  await page.fill('#note-content', '   ');
  await page.press('#note-content', 'Enter');
  await page.waitForTimeout(300);
  await expect(page.locator('.note-item')).toHaveCount(0);

  await page.fill('#note-content', 'Walk 10k steps');
  await page.press('#note-content', 'Enter');
  await expect(page.locator('.note-item')).toHaveCount(1);
  await expect(page.locator('.note-text')).toHaveText('Walk 10k steps');
});

test('tick off, untick and delete notes; changes survive a reload', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Notes C', start_date: '2040-03-01', end_date: '2040-03-07' });
  await openChallenge(page, ch, { today: '2040-03-02' });
  await addNote(page, 'priority', 'First');
  await addNote(page, 'priority', 'Second');

  // Done items drop below open ones and get struck through
  await page.locator('.note-item', { hasText: 'First' }).locator('.note-done').check();
  await expect(page.locator('.note-item', { hasText: 'First' })).toHaveClass(/done/);
  await expect(page.locator('.note-text')).toHaveText(['Second', 'First']);

  await page.reload();
  await expect(page.locator('.note-item', { hasText: 'First' })).toHaveClass(/done/);
  await expect(page.locator('.note-item', { hasText: 'First' }).locator('.note-done')).toBeChecked();

  await page.locator('.note-item', { hasText: 'First' }).locator('.note-done').uncheck();
  await expect(page.locator('.note-item', { hasText: 'First' })).not.toHaveClass(/done/);
  await expect(page.locator('.note-text')).toHaveText(['First', 'Second']);

  // Delete: cancel keeps it, confirm removes it
  await page.locator('.note-item', { hasText: 'Second' }).locator('.note-delete').click();
  await confirmDialog(page, false);
  await expect(page.locator('.note-item')).toHaveCount(2);
  await page.locator('.note-item', { hasText: 'Second' }).locator('.note-delete').click();
  await confirmDialog(page, true);
  await expect(page.locator('.note-item')).toHaveCount(1);

  await page.reload();
  await expect(page.locator('.note-text')).toHaveText(['First']);
});

test('notes belong to their own challenge', async ({ page, request }) => {
  const a = await createChallenge(request, { name: 'Notes Own A', start_date: '2040-04-01', end_date: '2040-04-07' });
  const b = await createChallenge(request, { name: 'Notes Own B', start_date: '2040-05-01', end_date: '2040-05-07' });
  await request.post(`/api/challenges/${a.id}/notes`, { data: { category: 'important', content: 'Only in A' } });
  await openChallenge(page, b, { today: '2040-05-02' });
  await expect(page.locator('.sidebar-notes')).toContainText('Nothing yet');
  await addNote(page, 'note', 'Only in B');

  // Switch to A through the hub
  await page.click('.sidebar-switch');
  await page.locator('article.challenge-card', { hasText: 'Notes Own A' }).locator('.open-btn').click();
  await expect(page.locator('.sidebar-challenge-name')).toHaveText('Notes Own A');
  await expect(page.locator('.note-text')).toHaveText(['Only in A']);
});

test('notes stay visible on every page of the challenge', async ({ page, request }) => {
  const ch = await createChallenge(request, { name: 'Notes Everywhere', start_date: '2040-06-01', end_date: '2040-06-07' });
  await request.post(`/api/challenges/${ch.id}/notes`, { data: { category: 'priority', content: 'Stay consistent' } });
  await openChallenge(page, ch, { today: '2040-06-02' });
  for (const p of ['daily-log', 'calendar', 'trends', 'final-review', 'settings', 'challenges', 'dashboard']) {
    await page.click(`#sidebar .nav-link[data-page="${p}"]`);
    await expect(page).toHaveURL(new RegExp(`#${p}`));
    await expect(page.locator('.note-text')).toHaveText(['Stay consistent']);
  }
});
