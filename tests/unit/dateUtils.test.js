'use strict';

/**
 * tests/unit/dateUtils.test.js
 * Unit tests for src/utils/dateUtils.js
 */

const {
  getChallengeDay,
  isValidChallengeDate,
  calculateSleepDurationMin,
  todayStr,
  getTotalDays,
  formatDate,
} = require('../../src/utils/dateUtils');

// ---------------------------------------------------------------------------
// getChallengeDay
// ---------------------------------------------------------------------------
describe('getChallengeDay', () => {
  test('Oct 12 (start) is Day 1', () => {
    expect(getChallengeDay('2026-10-12')).toBe(1);
  });

  test('Nov 1 (end) is Day 21', () => {
    expect(getChallengeDay('2026-11-01')).toBe(21);
  });

  test('Nov 2 (review day) is null – outside challenge', () => {
    expect(getChallengeDay('2026-11-02')).toBeNull();
  });

  test('Oct 11 (day before start) is null', () => {
    expect(getChallengeDay('2026-10-11')).toBeNull();
  });

  test('Oct 13 is Day 2', () => {
    expect(getChallengeDay('2026-10-13')).toBe(2);
  });

  test('invalid string returns null', () => {
    expect(getChallengeDay('not-a-date')).toBeNull();
  });

  test('undefined returns null', () => {
    expect(getChallengeDay(undefined)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// isValidChallengeDate
// ---------------------------------------------------------------------------
describe('isValidChallengeDate', () => {
  test('2026-10-12 is valid (start)', () => {
    expect(isValidChallengeDate('2026-10-12')).toBe(true);
  });

  test('2026-11-01 is valid (end)', () => {
    expect(isValidChallengeDate('2026-11-01')).toBe(true);
  });

  test('2026-11-02 is invalid (review day, not in window)', () => {
    expect(isValidChallengeDate('2026-11-02')).toBe(false);
  });

  test('2026-10-11 is invalid (one day before start)', () => {
    expect(isValidChallengeDate('2026-10-11')).toBe(false);
  });

  test('random future date is invalid', () => {
    expect(isValidChallengeDate('2027-01-01')).toBe(false);
  });

  test('empty string is invalid', () => {
    expect(isValidChallengeDate('')).toBe(false);
  });

  test('non-string is invalid', () => {
    expect(isValidChallengeDate(null)).toBe(false);
    expect(isValidChallengeDate(12345)).toBe(false);
  });

  test('wrong format is invalid', () => {
    expect(isValidChallengeDate('12-10-2026')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateSleepDurationMin
// ---------------------------------------------------------------------------
describe('calculateSleepDurationMin', () => {
  test('23:00 → 07:00 = 480 minutes (8 hours, crosses midnight)', () => {
    expect(calculateSleepDurationMin('23:00', '07:00')).toBe(480);
  });

  test('00:30 → 07:30 = 420 minutes (7 hours, same day after midnight)', () => {
    expect(calculateSleepDurationMin('00:30', '07:30')).toBe(420);
  });

  test('22:00 → 06:00 = 480 minutes (8 hours, crosses midnight)', () => {
    expect(calculateSleepDurationMin('22:00', '06:00')).toBe(480);
  });

  test('07:00 → 07:00 = 0 (same time)', () => {
    expect(calculateSleepDurationMin('07:00', '07:00')).toBe(0);
  });

  test('invalid bedtime returns null', () => {
    expect(calculateSleepDurationMin('invalid', '07:00')).toBeNull();
  });

  test('invalid wake_time returns null', () => {
    expect(calculateSleepDurationMin('23:00', 'bad')).toBeNull();
  });

  test('both invalid returns null', () => {
    expect(calculateSleepDurationMin('', '')).toBeNull();
  });

  test('null inputs return null', () => {
    expect(calculateSleepDurationMin(null, '07:00')).toBeNull();
  });

  test('21:30 → 05:30 = 480 minutes', () => {
    expect(calculateSleepDurationMin('21:30', '05:30')).toBe(480);
  });

  test('10:00 → 14:00 = 240 minutes (nap, same day)', () => {
    expect(calculateSleepDurationMin('10:00', '14:00')).toBe(240);
  });
});

// ---------------------------------------------------------------------------
// todayStr
// ---------------------------------------------------------------------------
describe('todayStr', () => {
  test('returns YYYY-MM-DD format', () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('matches today in local timezone', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(todayStr()).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// getTotalDays
// ---------------------------------------------------------------------------
describe('getTotalDays', () => {
  test('returns 21', () => {
    expect(getTotalDays()).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe('formatDate', () => {
  test('formats Oct 12 2026 correctly', () => {
    const result = formatDate('2026-10-12');
    expect(result).toContain('2026');
    expect(result).toContain('12');
  });

  test('empty string returns empty', () => {
    expect(formatDate('')).toBe('');
  });
});
