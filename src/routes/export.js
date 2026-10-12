'use strict';

/**
 * routes/export.js
 * GET /api/export/json  – full data export as JSON
 * GET /api/export/csv   – daily logs as CSV
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// ---------------------------------------------------------------------------
// GET /api/export/json
// ---------------------------------------------------------------------------
router.get('/json', (req, res) => {
  const logs     = db.prepare('SELECT * FROM daily_logs ORDER BY date ASC').all();
  const settings = db.prepare('SELECT * FROM challenge_settings WHERE id = 1').get();
  const challenges = db.prepare('SELECT * FROM challenges ORDER BY start_date ASC').all();
  const notes      = db.prepare('SELECT * FROM challenge_notes ORDER BY challenge_id ASC, id ASC').all();

  const payload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    challenge: {
      start: '2026-10-12',
      end: '2026-11-01',
      reviewDate: '2026-11-02',
    },
    settings: settings || null,
    challenges,
    notes,
    totalLogs: logs.length,
    logs,
  };

  const filename = `epic-davinci-export-${new Date().toISOString().slice(0, 10)}.json`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.json(payload);
});

// ---------------------------------------------------------------------------
// GET /api/export/csv
// ---------------------------------------------------------------------------
router.get('/csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM daily_logs ORDER BY date ASC').all();

  if (rows.length === 0) {
    // Return headers only
    const headers = [
      'id', 'date', 'created_at', 'updated_at',
      'weight_kg', 'workout_type', 'workout_notes', 'cardio_completed',
      'cardio_duration_min', 'total_steps', 'plank_completed', 'plank_duration_sec',
      'calories_kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'water_l', 'fruits_veggies', 'junk_food',
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
    const filename = `epic-davinci-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(headers.join(',') + '\n');
  }

  const headers = Object.keys(rows[0]);

  /**
   * Escape a single CSV cell value.
   * Wraps in double-quotes if value contains commas, newlines, or double-quotes.
   */
  function csvCell(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => csvCell(row[h])).join(',')),
  ];

  const filename = `epic-davinci-export-${new Date().toISOString().slice(0, 10)}.csv`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(lines.join('\n'));
});

module.exports = router;
