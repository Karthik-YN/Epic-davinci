/**
 * app.js — Main SPA router and bootstrap
 * Handles navigation between pages, URL hash routing,
 * and global error handling.
 */

import { ChallengeHub } from './pages/challenges.js';
import { Dashboard }    from './pages/dashboard.js';
import { DailyLog }     from './pages/dailyLog.js';
import { Calendar }     from './pages/calendar.js';
import { Trends }       from './pages/trends.js';
import { FinalReview }  from './pages/finalReview.js';
import { Settings }     from './pages/settings.js';
import {
  api, showToast, getActiveChallenge, setActiveChallenge, getStoredChallengeId,
} from './utils.js';
import { initSidebar }  from './sidebar.js';

// ─── Page Registry ──────────────────────────────────────────────
const PAGES = {
  'challenges':    ChallengeHub,
  'dashboard':     Dashboard,
  'daily-log':     DailyLog,
  'calendar':      Calendar,
  'trends':        Trends,
  'final-review':  FinalReview,
  'settings':      Settings,
};

const DEFAULT_PAGE = 'challenges';

// Pages that only make sense inside a selected challenge
const CHALLENGE_PAGES = new Set(['dashboard', 'daily-log', 'calendar', 'trends', 'final-review']);

// Currently active page instance and key
let currentPage    = null;
let currentPageKey = null;

// ─── Navigation ─────────────────────────────────────────────────
/**
 * Navigate to a named page, optionally passing params.
 * Updates nav state, renders page, updates URL hash.
 * @param {string} pageKey  e.g. 'dashboard', 'daily-log'
 * @param {object} [params] optional params forwarded to page.render()
 */
export async function navigate(pageKey, params = {}) {
  const PageClass = PAGES[pageKey];

  if (!PageClass) {
    console.warn(`[router] Unknown page: "${pageKey}". Falling back to dashboard.`);
    return navigate(DEFAULT_PAGE);
  }

  const container = document.getElementById('main-content');
  if (!container) return;

  // ── Prevent navigating away from dirty form (daily log) ──────
  if (
    currentPage &&
    typeof currentPage.isDirty === 'function' &&
    currentPage.isDirty() &&
    pageKey !== currentPageKey
  ) {
    const { showConfirm } = await import('./utils.js');
    const ok = await showConfirm('You have unsaved changes. Leave anyway?');
    if (!ok) {
      // Restore hash without triggering another navigation
      _setHashSilently(`#${currentPageKey}`);
      return;
    }
  }

  // ── Challenge pages need a selected challenge ─────────────────
  if (CHALLENGE_PAGES.has(pageKey) && !(await _ensureActiveChallenge())) {
    showToast('Pick a challenge first', 'info', 2500);
    return navigate('challenges');
  }

  // ── Update nav active state ───────────────────────────────────
  _updateNavActive(pageKey);

  // ── Show loading indicator ────────────────────────────────────
  container.innerHTML = '<div class="page-loading"><div class="spinner" aria-label="Loading…"></div></div>';

  // ── Instantiate and render page ───────────────────────────────
  const page = new PageClass();
  currentPage    = page;
  currentPageKey = pageKey;

  try {
    await page.render(container, params);
  } catch (err) {
    console.error(`[router] Error rendering page "${pageKey}":`, err);
    _renderPageError(container, err);
  }

  // ── Update URL hash (without re-triggering hashchange) ────────
  const paramStr = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';
  _setHashSilently(`#${pageKey}${paramStr}`);
}

// ─── Active Challenge ────────────────────────────────────────────
/**
 * Make sure a challenge is selected, restoring the one picked on a previous
 * visit. Returns false when there is none to restore.
 */
async function _ensureActiveChallenge() {
  if (getActiveChallenge()) return true;
  const storedId = getStoredChallengeId();
  if (!storedId) return false;
  try {
    setActiveChallenge(await api.get(`/api/challenges/${storedId}`));
    return true;
  } catch (err) {
    if (err.status === 404) setActiveChallenge(null); // deleted since last visit
    return false;
  }
}

// ─── Hash Parsing ────────────────────────────────────────────────
/** Parse '#page-key?foo=bar' → { page, params } */
function _parseHash(hash) {
  const raw = (hash || '').replace(/^#/, '');
  const [pagePart, queryPart] = raw.split('?');
  const page   = pagePart || DEFAULT_PAGE;
  const params = queryPart ? Object.fromEntries(new URLSearchParams(queryPart)) : {};
  return { page, params };
}

// ─── Nav Active State ────────────────────────────────────────────
function _updateNavActive(pageKey) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    const linkPage = link.dataset.page;
    link.classList.toggle('active', linkPage === pageKey);
    link.setAttribute('aria-current', linkPage === pageKey ? 'page' : 'false');
  });
}

// ─── Page Error Fallback ─────────────────────────────────────────
function _renderPageError(container, err) {
  const isNetwork = err.message && err.message.includes('connect to server');

  container.innerHTML = ''; // Clear

  const wrapper = document.createElement('div');
  wrapper.className = 'empty-state';

  const icon = document.createElement('span');
  icon.className = 'empty-state-icon';
  icon.textContent = isNetwork ? '🔌' : '⚠️';

  const title = document.createElement('div');
  title.className = 'empty-state-title';
  title.textContent = isNetwork ? 'Cannot reach server' : 'Something went wrong';

  const text = document.createElement('p');
  text.className = 'empty-state-text';
  text.textContent = err.message || 'An unexpected error occurred.';

  const retryBtn = document.createElement('button');
  retryBtn.className = 'btn btn-primary';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => navigate(currentPageKey || DEFAULT_PAGE));

  wrapper.appendChild(icon);
  wrapper.appendChild(title);
  wrapper.appendChild(text);
  wrapper.appendChild(retryBtn);
  container.appendChild(wrapper);
}

// ─── Hash Change Guard ───────────────────────────────────────────
// The hash the router itself just set: its hashchange event is ignored, while
// any other hash change (typed URL, back button, link) still navigates.
let _ownHash = null;

function _setHashSilently(hash) {
  if (window.location.hash === hash) return; // no hashchange will fire
  _ownHash = hash;
  window.location.hash = hash;
}

// ─── Event Setup ─────────────────────────────────────────────────
function _setupNav() {
  // Sidebar + bottom nav link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.nav-link[data-page]');
    if (!link) return;
    e.preventDefault();
    const page = link.dataset.page;
    if (page) navigate(page);
  });
}

function _setupHashChange() {
  window.addEventListener('hashchange', () => {
    if (_ownHash !== null && window.location.hash === _ownHash) {
      _ownHash = null;
      return;
    }
    _ownHash = null;
    const { page, params } = _parseHash(window.location.hash);
    navigate(page, params);
  });
}

// ─── Global Error Handler ────────────────────────────────────────
function _setupGlobalErrorHandling() {
  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason?.message || 'An unexpected error occurred.';
    console.error('[unhandled rejection]', e.reason);
    showToast(msg, 'error', 6000);
  });
}

// ─── Bootstrap ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  _setupNav();
  _setupHashChange();
  _setupGlobalErrorHandling();
  initSidebar();

  // Restore the last selected challenge so the sidebar shows it on any page
  await _ensureActiveChallenge();

  // Navigate to the page in the URL hash, or default
  const { page, params } = _parseHash(window.location.hash);
  navigate(PAGES[page] ? page : DEFAULT_PAGE, params);
});
