'use strict';

/**
 * routes/settings.js
 * GET /api/settings  – return settings row
 * PUT /api/settings  – update settings
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { asyncHandler } = require('../utils/asyncHandler');

const SELECT_SETTINGS = 'SELECT * FROM challenge_settings WHERE id = 1';

// Updatable numeric fields – must be >= 0 if provided
const NUMERIC_SETTINGS = [
  'budget_inr',
  'weight_min',
  'weight_max',
  'waist_start_cm',
  'waist_end_cm',
  'calorie_target_kcal',
  'protein_target_g',
  'carbs_target_g',
  'fat_target_g',
  'fiber_target_g',
  'water_target_l',
];

// ---------------------------------------------------------------------------
// GET /api/settings
// ---------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const settings = await db.get(SELECT_SETTINGS);
  if (!settings) {
    return res.status(404).json({ error: 'Settings not found' });
  }
  res.json(settings);
}));

// ---------------------------------------------------------------------------
// PUT /api/settings
// ---------------------------------------------------------------------------
router.put('/', asyncHandler(async (req, res) => {
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
    'calorie_target_kcal',
    'protein_target_g',
    'carbs_target_g',
    'fat_target_g',
    'fiber_target_g',
    'water_target_l',
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
    return res.json(await db.get(SELECT_SETTINGS));
  }

  updates.push('updated_at = @updated_at');
  params.updated_at = now;

  await db.run(`UPDATE challenge_settings SET ${updates.join(', ')} WHERE id = 1`, params);

  res.json(await db.get(SELECT_SETTINGS));
}));

module.exports = router;
