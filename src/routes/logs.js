'use strict';

/**
 * routes/logs.js
 * CRUD endpoints for daily log entries.
 *
 * GET  /api/logs           – list all logs
 * GET  /api/logs/:date     – get one log by date
 * GET  /api/logs/:date/exists – check existence
 * POST /api/logs/:date     – create or update (upsert) a log
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { isValidChallengeDate, calculateSleepDurationMin } = require('../utils/dateUtils');
const { validateDailyLog } = require('../utils/validation');

// ---------------------------------------------------------------------------
// All columns in insertion order (mirrors schema)
// ---------------------------------------------------------------------------
const ALL_COLUMNS = [
  'date',
  'weight_kg', 'workout_type', 'workout_notes', 'cardio_completed',
  'cardio_duration_min', 'total_steps', 'plank_completed', 'plank_duration_sec',
  'calories_kcal', 'protein_g', 'water_l', 'fruits_veggies', 'junk_food',
  'within_calorie_target', 'planned_meals_tomorrow', 'nutrition_notes',
  'bedtime', 'wake_time', 'sleep_duration_min', 'sleep_manual_override',
  'career_topic', 'career_practical', 'career_dsa', 'career_learned', 'career_study_min',
  'brush_teeth', 'tongue_scrape', 'floss', 'morning_skincare', 'night_skincare', 'hair_care',
  'hanuman_chalisa',
  'porn_free', 'masturbation_free', 'social_media_limit', 'pranayama_min',
  'podcast', 'communication', 'planned_tomorrow',
  'bed_setup', 'body_detox', 'shower', 'room_reset', 'stockings',
  'extra_spent_inr', 'spending_category', 'spending_note',
  'best_thing', 'biggest_mistake', 'one_improvement',
  'priority_1', 'priority_2', 'priority_3', 'planning_notes',
];

// ---------------------------------------------------------------------------
// Helper: coerce a value from request body to the appropriate SQLite type.
// Strings that are empty or 'null' become null.
// ---------------------------------------------------------------------------
function coerce(val) {
  if (val === undefined || val === null || val === '') return null;
  if (val === 'null') return null;
  return val;
}

// ---------------------------------------------------------------------------
// Helper: convert numeric-like strings to numbers where appropriate
// ---------------------------------------------------------------------------
const NUMERIC_FIELDS = new Set([
  'weight_kg', 'cardio_completed', 'cardio_duration_min', 'total_steps',
  'plank_completed', 'plank_duration_sec',
  'calories_kcal', 'protein_g', 'water_l', 'fruits_veggies', 'junk_food',
  'within_calorie_target', 'planned_meals_tomorrow',
  'sleep_duration_min', 'sleep_manual_override',
  'career_study_min',
  'brush_teeth', 'tongue_scrape', 'floss', 'morning_skincare', 'night_skincare', 'hair_care',
  'hanuman_chalisa',
  'porn_free', 'masturbation_free', 'social_media_limit', 'pranayama_min',
  'podcast', 'communication', 'planned_tomorrow',
  'bed_setup', 'body_detox', 'shower', 'room_reset', 'stockings',
  'extra_spent_inr',
]);

function coerceNumeric(field, val) {
  if (val === undefined || val === null || val === '') return null;
  if (!NUMERIC_FIELDS.has(field)) return val;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// GET /api/logs  – all logs ordered by date
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM daily_logs ORDER BY date ASC').all();
  res.json(rows);
});

// ---------------------------------------------------------------------------
// GET /api/logs/:date/exists
// ---------------------------------------------------------------------------
router.get('/:date/exists', (req, res) => {
  const { date } = req.params;
  const row = db.prepare('SELECT id FROM daily_logs WHERE date = ?').get(date);
  res.json({ exists: !!row, date });
});

// ---------------------------------------------------------------------------
// GET /api/logs/:date
// ---------------------------------------------------------------------------
router.get('/:date', (req, res) => {
  const { date } = req.params;
  const row = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date);
  if (!row) {
    return res.status(404).json({ error: 'Log not found for this date', date });
  }
  res.json(row);
});

// ---------------------------------------------------------------------------
// POST /api/logs/:date  – upsert
// ---------------------------------------------------------------------------
router.post('/:date', (req, res) => {
  const { date } = req.params;

  // 1. Validate challenge date
  if (!isValidChallengeDate(date)) {
    return res.status(400).json({
      error: 'Invalid or out-of-range challenge date',
      date,
    });
  }

  // Merge date into body for validation
  const body = { ...req.body, date };

  // 2. Validate fields
  const { valid, errors } = validateDailyLog(body);
  if (!valid) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  // 3. Calculate sleep_duration_min if not manually overridden
  let sleepDuration = coerce(body.sleep_duration_min) !== null
    ? Number(body.sleep_duration_min)
    : null;

  const isManualOverride = Number(body.sleep_manual_override) === 1;

  if (!isManualOverride && body.bedtime && body.wake_time) {
    const calculated = calculateSleepDurationMin(body.bedtime, body.wake_time);
    if (calculated !== null) {
      sleepDuration = calculated;
    }
  }

  // 4. Check if record already exists (to preserve created_at)
  const existing = db.prepare('SELECT created_at FROM daily_logs WHERE date = ?').get(date);
  const now = new Date().toISOString();
  const createdAt = existing ? existing.created_at : now;

  // 5. Build values object
  const values = {};
  for (const col of ALL_COLUMNS) {
    if (col === 'date') {
      values.date = date;
    } else if (col === 'sleep_duration_min') {
      values.sleep_duration_min = sleepDuration;
    } else {
      const raw = body[col];
      values[col] = coerceNumeric(col, coerce(raw));
    }
  }
  values.created_at = createdAt;
  values.updated_at = now;

  // 6. Build INSERT OR REPLACE
  const cols = ['created_at', 'updated_at', ...ALL_COLUMNS];
  const placeholders = cols.map(c => `@${c}`).join(', ');
  const sql = `INSERT OR REPLACE INTO daily_logs (${cols.join(', ')}) VALUES (${placeholders})`;

  db.prepare(sql).run(values);

  // 7. Return saved record
  const saved = db.prepare('SELECT * FROM daily_logs WHERE date = ?').get(date);
  res.json(saved);
});

module.exports = router;
