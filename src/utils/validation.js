'use strict';

/**
 * validation.js
 * Validates a daily log POST body before writing to the database.
 * Returns { valid: boolean, errors: { field: message } }
 */

const { isValidChallengeDate } = require('../utils/dateUtils');

// Fields that must be 0 or 1 (binary)
const BINARY_FIELDS = [
  'cardio_completed',
  'fruits_veggies',
  'junk_food',
  'within_calorie_target',
  'planned_meals_tomorrow',
  'brush_teeth',
  'tongue_scrape',
  'floss',
  'morning_skincare',
  'night_skincare',
  'hanuman_chalisa',
  'porn_free',
  'masturbation_free',
  'social_media_limit',
  'podcast',
  'communication',
  'planned_tomorrow',
  'bed_setup',
  'body_detox',
  'shower',
  'room_reset',
  'stockings',
  'plank_completed',
  'sleep_manual_override',
];

// Non-negative numeric fields (>= 0)
const NON_NEGATIVE_FIELDS = [
  'calories_kcal',
  'protein_g',
  'water_l',
  'cardio_duration_min',
  'plank_duration_sec',
  'pranayama_min',
  'career_study_min',
  'extra_spent_inr',
];

// HH:MM 24-hour format regex
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Validates a daily log request body.
 * @param {Object} body
 * @returns {{ valid: boolean, errors: Object }}
 */
function validateDailyLog(body) {
  const errors = {};

  // --- date ---
  if (body.date !== undefined) {
    if (!isValidChallengeDate(body.date)) {
      errors.date = 'Must be a valid YYYY-MM-DD date within the challenge window (2026-10-12 to 2026-11-01)';
    }
  }

  // --- weight_kg ---
  if (body.weight_kg !== undefined && body.weight_kg !== null && body.weight_kg !== '') {
    const v = Number(body.weight_kg);
    if (isNaN(v) || v <= 0) {
      errors.weight_kg = 'Must be a positive number';
    } else if (v < 30 || v > 200) {
      errors.weight_kg = 'Must be between 30 and 200 kg';
    }
  }

  // --- total_steps ---
  if (body.total_steps !== undefined && body.total_steps !== null && body.total_steps !== '') {
    const v = Number(body.total_steps);
    if (!Number.isInteger(v) || v < 0) {
      errors.total_steps = 'Must be a non-negative integer';
    }
  }

  // --- non-negative numeric fields ---
  for (const field of NON_NEGATIVE_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      const v = Number(body[field]);
      if (isNaN(v) || v < 0) {
        errors[field] = 'Must be a non-negative number';
      }
    }
  }

  // --- time fields ---
  for (const field of ['bedtime', 'wake_time']) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      if (!TIME_RE.test(body[field])) {
        errors[field] = 'Must be in HH:MM (24-hour) format';
      }
    }
  }

  // --- binary fields (0 or 1) ---
  for (const field of BINARY_FIELDS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      const v = Number(body[field]);
      if (v !== 0 && v !== 1) {
        errors[field] = 'Must be 0 or 1';
      }
    }
  }

  // --- hair_care: 0, 1, or 2 ---
  if (body.hair_care !== undefined && body.hair_care !== null && body.hair_care !== '') {
    const v = Number(body.hair_care);
    if (v !== 0 && v !== 1 && v !== 2) {
      errors.hair_care = 'Must be 0 (not completed), 1 (completed), or 2 (not scheduled)';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = { validateDailyLog };
