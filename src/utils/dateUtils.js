'use strict';

/**
 * dateUtils.js
 * Utility functions for challenge date handling and sleep calculations.
 */

const CHALLENGE_START = '2026-10-12';
const CHALLENGE_END   = '2026-11-01';
const REVIEW_DATE     = '2026-11-02';

/**
 * Returns true if dateStr (YYYY-MM-DD) falls within the challenge window [start, end] inclusive.
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidChallengeDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  // Basic format check
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return dateStr >= CHALLENGE_START && dateStr <= CHALLENGE_END;
}

/**
 * Returns the challenge day number (1–21) for a given date, or null if outside range.
 * @param {string} dateStr YYYY-MM-DD
 * @returns {number|null}
 */
function getChallengeDay(dateStr) {
  if (!isValidChallengeDate(dateStr)) return null;
  const start = new Date(CHALLENGE_START + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  const diffMs = target - start;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Day 1 = Oct 12
}

/**
 * Returns the total number of challenge days (always 21).
 * @returns {number}
 */
function getTotalDays() {
  return 21;
}

/**
 * Calculates sleep duration in minutes from bedtime to wake_time.
 * Handles crossing midnight (e.g. 23:00 → 07:00 = 480 min).
 * @param {string} bedtime  HH:MM (24h)
 * @param {string} wakeTime HH:MM (24h)
 * @returns {number|null} minutes, or null if inputs are invalid
 */
function calculateSleepDurationMin(bedtime, wakeTime) {
  const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRe.test(bedtime) || !timeRe.test(wakeTime)) return null;

  const [bH, bM] = bedtime.split(':').map(Number);
  const [wH, wM] = wakeTime.split(':').map(Number);

  const bedMins  = bH * 60 + bM;
  const wakeMins = wH * 60 + wM;

  // If same time → 0 minutes
  if (bedMins === wakeMins) return 0;

  // If wake time is after bed time on the same day
  if (wakeMins > bedMins) return wakeMins - bedMins;

  // Crossed midnight
  return (24 * 60 - bedMins) + wakeMins;
}

/**
 * Formats a YYYY-MM-DD string into a human-readable date like "Oct 12, 2026".
 * @param {string} dateStr YYYY-MM-DD
 * @returns {string}
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  // Parse without timezone conversion to avoid off-by-one
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Returns today's date as YYYY-MM-DD in local timezone (no UTC shift).
 * @returns {string}
 */
function todayStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Returns true if dateStr is a real calendar date in YYYY-MM-DD format.
 * @param {string} dateStr
 * @returns {boolean}
 */
function isValidDateStr(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * Number of days from start to end, both inclusive (2026-10-12 → 2026-11-01 = 21).
 * @param {string} start YYYY-MM-DD
 * @param {string} end   YYYY-MM-DD
 * @returns {number}
 */
function daysInclusive(start, end) {
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}

/**
 * Adds `days` to a YYYY-MM-DD date string.
 * @param {string} dateStr
 * @param {number} days
 * @returns {string}
 */
function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

module.exports = {
  CHALLENGE_START,
  CHALLENGE_END,
  REVIEW_DATE,
  isValidChallengeDate,
  getChallengeDay,
  getTotalDays,
  calculateSleepDurationMin,
  formatDate,
  todayStr,
  isValidDateStr,
  daysInclusive,
  addDays,
};
