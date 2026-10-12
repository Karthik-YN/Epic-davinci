/**
 * utils.js — Shared utilities for Epic Davinci Challenge Tracker
 * Exports: api, showToast, showConfirm, formatDate, formatDateShort,
 *          getChallengeDay, todayStr, isValidChallengeDate,
 *          calculateSleepHours, debounce, formatDuration, formatCurrency
 */

// ─── Active Challenge ───────────────────────────────────────────
// These are live bindings: every page that imports them sees the window of
// the challenge currently selected in the Challenge Hub.
export let CHALLENGE_START = '2026-10-12';
export let CHALLENGE_END   = '2026-11-01';
export let REVIEW_DATE     = '2026-11-02';
export let TOTAL_DAYS      = 21;

const ACTIVE_CHALLENGE_KEY = 'epic-davinci.activeChallengeId';
let _activeChallenge = null;

/** Make `challenge` the one every page works with (null clears it). */
export function setActiveChallenge(challenge) {
  _activeChallenge = challenge || null;
  if (challenge) {
    CHALLENGE_START = challenge.start_date;
    CHALLENGE_END   = challenge.end_date;
    REVIEW_DATE     = addDays(challenge.end_date, 1);
    TOTAL_DAYS      = daysInclusive(challenge.start_date, challenge.end_date);
  }
  try {
    if (challenge) localStorage.setItem(ACTIVE_CHALLENGE_KEY, String(challenge.id));
    else localStorage.removeItem(ACTIVE_CHALLENGE_KEY);
  } catch (_) { /* storage unavailable — selection just won't survive a reload */ }
  window.dispatchEvent(new CustomEvent('challenge-changed', { detail: _activeChallenge }));
}

export function getActiveChallenge() {
  return _activeChallenge;
}

/** Id of the challenge selected in a previous visit, if any. */
export function getStoredChallengeId() {
  try {
    return localStorage.getItem(ACTIVE_CHALLENGE_KEY);
  } catch (_) {
    return null;
  }
}

/** Append ?challengeId=… so stats/log queries are scoped to the active challenge. */
export function withChallenge(url) {
  if (!_activeChallenge) return url;
  return `${url}${url.includes('?') ? '&' : '?'}challengeId=${_activeChallenge.id}`;
}

/** Shift a 'YYYY-MM-DD' date by `days` (local, no UTC drift). */
export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Days from start to end, both inclusive. */
export function daysInclusive(start, end) {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd)) / 86400000) + 1;
}

/** Escape a value for safe interpolation into innerHTML. */
export function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── API Wrapper ────────────────────────────────────────────────
/**
 * Centralised fetch wrapper. All methods throw on error with a
 * human-readable .message so callers can show it directly.
 */
const NETWORK_ERROR = 'Unable to connect to server. Make sure the app is running.';

async function _request(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options,
    });

    // Try to parse JSON body regardless of status code
    let data;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    if (!res.ok) {
      // Prefer server-supplied message
      const msg = (typeof data === 'object' && data?.error) || `Server error ${res.status}`;
      throw Object.assign(new Error(msg), { status: res.status, data });
    }

    return data;
  } catch (err) {
    if (err.name === 'TypeError') {
      // Network-level failure (e.g., server not running)
      throw new Error(NETWORK_ERROR);
    }
    throw err; // Re-throw API or parsing errors
  }
}

export const api = {
  /** GET /url → parsed JSON */
  get(url) {
    return _request(url, { method: 'GET' });
  },

  /** POST /url with JSON body → parsed JSON */
  post(url, body) {
    return _request(url, { method: 'POST', body: JSON.stringify(body) });
  },

  /** PUT /url with JSON body → parsed JSON */
  put(url, body) {
    return _request(url, { method: 'PUT', body: JSON.stringify(body) });
  },

  /** DELETE /url → parsed JSON */
  delete(url) {
    return _request(url, { method: 'DELETE' });
  },
};

// ─── Toast Notifications ────────────────────────────────────────
/**
 * Show a non-blocking toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration ms before auto-dismiss (0 = persist)
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const body = document.createElement('span');
  body.className = 'toast-body';
  body.textContent = message; // SAFE: textContent only

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => dismissToast(toast));

  toast.appendChild(body);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast) {
  if (!toast.isConnected) return;
  toast.classList.add('fade-out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  // Fallback in case animationend never fires
  setTimeout(() => toast.remove(), 400);
}

// ─── Confirmation Modal ─────────────────────────────────────────
/**
 * Show the #confirm-modal and return a Promise<boolean>.
 * Resolves true on confirm, false on cancel/overlay-click.
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const modal   = document.getElementById('confirm-modal');
    const msgEl   = document.getElementById('confirm-modal-message');
    const okBtn   = document.getElementById('confirm-modal-ok');
    const cancelBtn = document.getElementById('confirm-modal-cancel');
    const overlay = document.getElementById('confirm-modal-overlay');

    if (!modal) { resolve(false); return; }

    msgEl.textContent = message; // SAFE: textContent
    modal.hidden = false;

    function cleanup(result) {
      modal.hidden = true;
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onCancel);
      resolve(result);
    }

    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onCancel);
  });
}

// ─── Date Formatting ────────────────────────────────────────────
/** 'YYYY-MM-DD' → 'October 12, 2026' */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
}

/** 'YYYY-MM-DD' → 'Oct 12' */
export function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

/** Returns today's date as 'YYYY-MM-DD' in local timezone (NOT UTC). */
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns the 1-indexed challenge day (1–TOTAL_DAYS) for a given YYYY-MM-DD date,
 * or null if the date is outside the active challenge range.
 */
export function getChallengeDay(dateStr) {
  if (!isValidChallengeDate(dateStr)) return null;
  return daysInclusive(CHALLENGE_START, dateStr); // Day 1 = start date
}

/** Returns true iff dateStr is within [CHALLENGE_START, CHALLENGE_END] inclusive. */
export function isValidChallengeDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr >= CHALLENGE_START && dateStr <= CHALLENGE_END;
}

// ─── Sleep Calculation ──────────────────────────────────────────
/**
 * Calculate sleep duration in decimal hours from HH:MM bed/wake times.
 * Handles midnight crossing (e.g., bed 23:00, wake 06:30 = 7.5h).
 * Returns null if either input is missing/invalid.
 */
export function calculateSleepHours(bedtime, wakeTime) {
  if (!bedtime || !wakeTime) return null;
  const [bh, bm] = bedtime.split(':').map(Number);
  const [wh, wm] = wakeTime.split(':').map(Number);
  if (isNaN(bh) || isNaN(bm) || isNaN(wh) || isNaN(wm)) return null;

  let bedMins  = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;

  // Handle midnight crossing
  if (wakeMins <= bedMins) {
    wakeMins += 24 * 60;
  }

  return (wakeMins - bedMins) / 60;
}

// ─── Misc Formatting ────────────────────────────────────────────
/**
 * Format minutes as 'Xh Ym' (e.g., 150 → '2h 30m').
 * Returns '0m' for zero, null/undefined for no input.
 */
export function formatDuration(minutes) {
  if (minutes == null || isNaN(minutes)) return null;
  const mins = Math.round(minutes);
  if (mins === 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Format a number as Indian Rupees (₹).
 * Uses compact Indian number formatting with ₹ prefix.
 */
export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}

// ─── Debounce ───────────────────────────────────────────────────
/**
 * Returns a debounced version of `fn` that delays invocation by `ms`.
 */
export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ─── Save Status Helper ──────────────────────────────────────────
/**
 * Update the floating #save-status pill.
 * @param {'saving'|'saved'|'error'|'unsaved'|null} state  null = hide
 * @param {string} [customText]
 */
export function setSaveStatus(state, customText) {
  const el = document.getElementById('save-status');
  if (!el) return;
  if (state === null) { el.hidden = true; return; }

  el.hidden = false;
  el.className = `status-${state}`;

  const labels = {
    saving:  '● Saving…',
    saved:   '✓ Saved',
    error:   '✗ Save failed',
    unsaved: '● Unsaved changes',
  };
  el.textContent = customText || labels[state] || '';
}
