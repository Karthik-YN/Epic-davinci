'use strict';

/**
 * routes/export.js
 * GET /api/export/json  – full data export as JSON
 * GET /api/export/csv   – daily logs as CSV
 * POST /api/export/restore – merge a JSON export back in (the browser's saved copy)
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { asyncHandler } = require('../utils/asyncHandler');

// ---------------------------------------------------------------------------
// GET /api/export/json
// ---------------------------------------------------------------------------
router.get('/json', asyncHandler(async (req, res) => {
  const [logs, settings, challenges, notes, meta] = await Promise.all([
    db.all('SELECT * FROM daily_logs ORDER BY date ASC'),
    db.get('SELECT * FROM challenge_settings WHERE id = 1'),
    db.all('SELECT * FROM challenges ORDER BY start_date ASC'),
    db.all('SELECT * FROM challenge_notes ORDER BY challenge_id ASC, id ASC'),
    db.get("SELECT value FROM app_meta WHERE key = 'instance_id'"),
  ]);

  const payload = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    instanceId: meta ? meta.value : null,
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
}));

// ---------------------------------------------------------------------------
// POST /api/export/restore
// ---------------------------------------------------------------------------
/** Column names of `table`. */
async function columnsOf(table) {
  return (await db.all(`PRAGMA table_info(${table})`)).map(c => c.name);
}

/**
 * Merge `rows` into `table`, matching on `key`. Missing rows are inserted; existing rows are
 * replaced only when the incoming copy is newer (updated_at), so restoring an old copy never
 * overwrites newer edits. Returns how many rows were written.
 */
async function mergeRows(table, rows, key, { keepId = true } = {}) {
  if (!Array.isArray(rows)) return 0;
  const known = new Set(await columnsOf(table));
  let written = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || row[key] == null) continue;
    const cols = Object.keys(row).filter(c => known.has(c) && (keepId || c !== 'id'));
    const values = Object.fromEntries(cols.map(c => [c, row[c]]));
    const existing = await db.get(`SELECT updated_at FROM ${table} WHERE ${key} = @key`, { key: row[key] });
    if (!existing) {
      await db.run(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`,
        values
      );
      written++;
    } else if ((row.updated_at || '') > (existing.updated_at || '')) {
      const sets = cols.filter(c => c !== key && c !== 'id').map(c => `${c} = @${c}`);
      if (!sets.length) continue;
      await db.run(`UPDATE ${table} SET ${sets.join(', ')} WHERE ${key} = @${key}`, values);
      written++;
    }
  }
  return written;
}

router.post('/restore', asyncHandler(async (req, res) => {
  const data = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Expected a JSON export' });
  }

  const challenges = await mergeRows('challenges', data.challenges, 'id');
  // Notes need their challenge to exist
  const ids = new Set((await db.all('SELECT id FROM challenges')).map(c => c.id));
  const notes = await mergeRows(
    'challenge_notes',
    (Array.isArray(data.notes) ? data.notes : []).filter(n => n && ids.has(n.challenge_id)),
    'id'
  );
  // Logs are unique per date; their ids may clash with logs saved since the wipe
  const logs = await mergeRows('daily_logs', data.logs, 'date', { keepId: false });
  const settings = data.settings
    ? await mergeRows('challenge_settings', [{ ...data.settings, id: 1 }], 'id')
    : 0;

  res.json({ restored: { challenges, notes, logs, settings } });
}));

// ---------------------------------------------------------------------------
// GET /api/export/csv
// ---------------------------------------------------------------------------
router.get('/csv', asyncHandler(async (req, res) => {
  const rows = await db.all('SELECT * FROM daily_logs ORDER BY date ASC');

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
}));

module.exports = router;
