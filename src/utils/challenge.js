'use strict';

/**
 * challenge.js
 * Resolves which date window a request is about.
 * Stats and export endpoints accept ?challengeId=N; without it they fall back to
 * the original 21-day window so existing callers keep working.
 */

const db = require('../db/database');
const { CHALLENGE_START, CHALLENGE_END, daysInclusive } = require('./dateUtils');
const { asyncHandler } = require('./asyncHandler');

/**
 * @param {import('express').Request} req
 * @returns {Promise<{ start: string, end: string, totalDays: number, challenge: Object|null } | null>}
 *          null when a challengeId was given but no such challenge exists
 */
async function resolveChallengeRange(req) {
  const id = req.query.challengeId;
  if (id === undefined || id === '') {
    return {
      start: CHALLENGE_START,
      end: CHALLENGE_END,
      totalDays: daysInclusive(CHALLENGE_START, CHALLENGE_END),
      challenge: null,
    };
  }

  const challenge = await db.get('SELECT * FROM challenges WHERE id = @id', { id: Number(id) || 0 });
  if (!challenge) return null;

  return {
    start: challenge.start_date,
    end: challenge.end_date,
    totalDays: daysInclusive(challenge.start_date, challenge.end_date),
    challenge,
  };
}

/**
 * Express middleware: attaches req.range, or responds 404 for an unknown challengeId.
 */
const challengeRange = asyncHandler(async (req, res, next) => {
  const range = await resolveChallengeRange(req);
  if (!range) {
    return res.status(404).json({ error: 'Challenge not found' });
  }
  req.range = range;
  next();
});

/**
 * True if dateStr falls inside at least one challenge.
 * @param {string} dateStr YYYY-MM-DD
 * @returns {Promise<boolean>}
 */
async function isDateInAnyChallenge(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  return !!(await db.get(
    'SELECT 1 AS found FROM challenges WHERE start_date <= @d AND end_date >= @d LIMIT 1',
    { d: dateStr }
  ));
}

module.exports = { resolveChallengeRange, challengeRange, isDateInAnyChallenge };
