'use strict';

/**
 * routes/settings.js
 * GET /api/settings  – return settings row
 * PUT /api/settings  – update settings
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');

// Updatable numeric fields – must be >= 0 if provided
const NUMERIC_SETTINGS = [
  'budget_inr',
  'weight_min',
  'weight_max',
  'waist_start_cm',
  'waist_end_cm',
];

// ---------------------------------------------------------------------------
// GET /api/settings
// ---------------------------------------------------------------------------
router.get('/', (req, res) => {
  const settings = db.prepare('SELECT * FROM challenge_settings WHERE id = 1').get();
  if (!settings) {
    return res.status(404).json({ error: 'Settings not found' });
  }
  res.json(settings);
});

// ---------------------------------------------------------------------------
// PUT /api/settings
// ---------------------------------------------------------------------------
router.put('/', (req, res) => {
  const body = req.body;
  const errors = {};

  // Validate numeric fields
  for (const field of NUMERIC_SETTINGS) {
    if (body[field] !== undefined && body[field] !== null && body[field] !== '') {
      const v = Number(body[field]);
      if (isNaN(v) || v < 0) {
        errors[field] = 'Must be a non-negative number';
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const now = new Date().toISOString();

  // Only update fields that are present in the request body
  const updates = [];
  const params  = {};

  const ALLOWED_FIELDS = [
    'budget_inr',
    'weight_min',
    'weight_max',
    'waist_start_cm',
    'waist_start_date',
    'waist_end_cm',
    'waist_end_date',
  ];

  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      updates.push(`${field} = @${field}`);
      const val = body[field];
      if (val === null || val === '') {
        params[field] = null;
      } else if (NUMERIC_SETTINGS.includes(field)) {
        params[field] = Number(val);
      } else {
        params[field] = val;
      }
    }
  }

  if (updates.length === 0) {
    // Nothing to update – return current settings
    const settings = db.prepare('SELECT * FROM challenge_settings WHERE id = 1').get();
    return res.json(settings);
  }

  updates.push('updated_at = @updated_at');
  params.updated_at = now;

  db.prepare(`UPDATE challenge_settings SET ${updates.join(', ')} WHERE id = 1`).run(params);

  const updated = db.prepare('SELECT * FROM challenge_settings WHERE id = 1').get();
  res.json(updated);
});

module.exports = router;
