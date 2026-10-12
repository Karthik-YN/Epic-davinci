'use strict';

const { test: base, expect } = require('@playwright/test');

/** Shift a YYYY-MM-DD date by n days. */
function addDays(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Test fixture that fails the test on any browser error: uncaught exceptions,
 * console errors, and failed API calls. The only allowed failure is the 404 the
 * app expects when a day has no log yet (GET /api/logs/YYYY-MM-DD).
 */
const allowed = new WeakSet();

/** Call in tests that deliberately submit invalid data (HTTP 400 is then expected). */
function allowValidationErrors(page) {
  allowed.add(page);
}

const test = base.extend({
  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
    page.on('console', (m) => {
      // Failed requests are checked (with their URL) by the response handler below
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console: ${m.text()}`);
    });
    page.on('response', (r) => {
      const url = new URL(r.url());
      if (!url.pathname.startsWith('/api/') || r.status() < 400) return;
      const expected404 = r.status() === 404 && /^\/api\/logs\/\d{4}-\d{2}-\d{2}$/.test(url.pathname);
      const expectedValidation = r.status() === 400 && allowed.has(page);
      if (!expected404 && !expectedValidation) problems.push(`HTTP ${r.status()} ${r.request().method()} ${url.pathname}`);
    });
    await use(page);
    expect(problems, 'browser errors during the test').toEqual([]);
  },
});

/** Freeze the browser's "today" (timers keep running, so autosave still works). */
async function setToday(page, date) {
  await page.clock.setFixedTime(new Date(`${date}T09:00:00+05:30`));
}

/** Create a challenge through the API. */
async function createChallenge(request, data) {
  const res = await request.post('/api/challenges', {
    data: { priority: 'medium', ...data },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

/** Open the app with `challenge` already selected (as if picked on a previous visit). */
async function openChallenge(page, challenge, { today, hash = 'dashboard' } = {}) {
  if (today) await setToday(page, today);
  // Select it once per tab, so later reloads behave like a real returning visit
  await page.addInitScript((id) => {
    if (!sessionStorage.getItem('e2e-selected')) {
      localStorage.setItem('epic-davinci.activeChallengeId', String(id));
      sessionStorage.setItem('e2e-selected', '1');
    }
  }, challenge.id);
  await page.goto(`/#${hash}`);
  await expect(page.locator('.sidebar-challenge-name')).toHaveText(challenge.name);
}

/** Wait for the next daily-log save to reach the server. */
function waitForLogSave(page, date) {
  return page.waitForResponse((r) =>
    r.request().method() === 'POST' && r.url().endsWith(`/api/logs/${date}`));
}

/** Wait until the stored log for `date` contains `expected` (autosave may already have run). */
async function expectSavedLog(request, date, expected) {
  await expect.poll(async () => {
    const res = await request.get(`/api/logs/${date}`);
    return res.ok() ? res.json() : null;
  }, { timeout: 10000 }).toMatchObject(expected);
}

/** Answer the in-app confirm dialog. */
async function confirmDialog(page, accept = true) {
  await expect(page.locator('#confirm-modal')).toBeVisible();
  await page.click(accept ? '#confirm-modal-ok' : '#confirm-modal-cancel');
  await expect(page.locator('#confirm-modal')).toBeHidden();
}

module.exports = {
  test, expect, allowValidationErrors, addDays, setToday, createChallenge, openChallenge,
  waitForLogSave, expectSavedLog, confirmDialog,
};
