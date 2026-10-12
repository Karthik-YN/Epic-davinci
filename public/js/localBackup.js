/**
 * localBackup.js — keeps a full copy of the tracker's data in this browser.
 *
 * Render's free plan wipes the server's database whenever the app sleeps or
 * redeploys. Every database copy has its own instanceId, so when the server
 * reports a different id than the one this browser last saw, the server lost
 * its data: the saved copy is sent back (merged, newer edits win) and the
 * browser copy is refreshed from the result.
 */

import { api } from './utils.js';

const BACKUP_KEY = 'epic-davinci.backup';
const SYNC_DELAY_MS = 1000;

function loadBackup() {
  try {
    return JSON.parse(localStorage.getItem(BACKUP_KEY));
  } catch (_) {
    return null;
  }
}

function saveBackup(snapshot) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn('[backup] could not save the browser copy:', err.message);
  }
}

function hasData(snapshot) {
  return !!snapshot && (
    (snapshot.challenges || []).length > 0 ||
    (snapshot.logs || []).length > 0 ||
    (snapshot.notes || []).length > 0
  );
}

async function _sync() {
  try {
    let snapshot = await api.get('/api/export/json');
    const saved = loadBackup();
    let restored = false;
    if (hasData(saved) && saved.instanceId !== snapshot.instanceId) {
      await api.post('/api/export/restore', saved);
      snapshot = await api.get('/api/export/json');
      restored = true;
    }
    saveBackup(snapshot);
    return restored;
  } catch (err) {
    console.warn('[backup] sync failed:', err.message);
    return false;
  }
}

let _chain = Promise.resolve(false);

/**
 * Bring the server and the browser copy in line. Resolves to true when the
 * server had lost its data and it was restored from this browser.
 * Calls run one after another, never overlapping.
 */
export function syncBackup() {
  _chain = _chain.then(_sync, _sync);
  return _chain;
}

let _timer = null;

/** Refresh the browser copy shortly after a change (batches autosaves). */
export function scheduleBackup() {
  clearTimeout(_timer);
  _timer = setTimeout(syncBackup, SYNC_DELAY_MS);
}
