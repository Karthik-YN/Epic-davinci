'use strict';

/**
 * routes/challenges.js
 * Challenges the user sets up themselves, plus the notes attached to each.
 *
 * GET    /api/challenges                 – list challenges (with note counts)
 * POST   /api/challenges                 – create a challenge
 * GET    /api/challenges/:id             – one challenge
 * PUT    /api/challenges/:id             – update a challenge
 * DELETE /api/challenges/:id             – delete a challenge and its notes (daily logs are kept)
 * GET    /api/challenges/:id/notes       – list notes
 * POST   /api/challenges/:id/notes       – add a note
 * PUT    /api/challenges/:id/notes/:nid  – update a note
 * DELETE /api/challenges/:id/notes/:nid  – delete a note
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { isValidDateStr, daysInclusive } = require('../utils/dateUtils');
const { asyncHandler } = require('../utils/asyncHandler');

const PRIORITIES      = ['high', 'medium', 'low'];
const NOTE_CATEGORIES = ['priority', 'important', 'note', 'reminder'];
const MAX_DAYS        = 366;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function withDuration(challenge) {
  return {
    ...challenge,
    total_days: daysInclusive(challenge.start_date, challenge.end_date),
  };
}

function getChallenge(id) {
  return db.get('SELECT * FROM challenges WHERE id = @id', { id: Number(id) || 0 });
}

function getNote(id) {
  return db.get('SELECT * FROM challenge_notes WHERE id = @id', { id: Number(id) });
}

/**
 * Validate a challenge body. `existing` is the stored row on update, so partial
 * updates are checked against the merged result.
 */
function validateChallenge(body, existing = {}) {
  const errors = {};
  const merged = { ...existing, ...body };

  if (typeof merged.name !== 'string' || merged.name.trim() === '') {
    errors.name = 'Name is required';
  } else if (merged.name.length > 100) {
    errors.name = 'Name must be 100 characters or fewer';
  }

  if (!isValidDateStr(merged.start_date)) errors.start_date = 'Must be a valid YYYY-MM-DD date';
  if (!isValidDateStr(merged.end_date))   errors.end_date   = 'Must be a valid YYYY-MM-DD date';

  if (!errors.start_date && !errors.end_date) {
    if (merged.end_date < merged.start_date) {
      errors.end_date = 'End date must be on or after the start date';
    } else if (daysInclusive(merged.start_date, merged.end_date) > MAX_DAYS) {
      errors.end_date = `A challenge can be at most ${MAX_DAYS} days long`;
    }
  }

  if (merged.priority !== undefined && !PRIORITIES.includes(merged.priority)) {
    errors.priority = `Must be one of: ${PRIORITIES.join(', ')}`;
  }

  if (merged.budget_inr !== undefined && merged.budget_inr !== null && merged.budget_inr !== '') {
    const v = Number(merged.budget_inr);
    if (isNaN(v) || v < 0) errors.budget_inr = 'Must be a non-negative number';
  }

  return errors;
}

function normalizeBudget(val) {
  return val === undefined || val === null || val === '' ? null : Number(val);
}

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------
router.get('/', asyncHandler(async (req, res) => {
  const rows = await db.all(`
    SELECT c.*,
      (SELECT COUNT(*) FROM challenge_notes n WHERE n.challenge_id = c.id) AS notes_count,
      (SELECT COUNT(*) FROM daily_logs l WHERE l.date BETWEEN c.start_date AND c.end_date) AS days_logged
    FROM challenges c
    ORDER BY c.start_date DESC, c.id DESC
  `);
  res.json(rows.map(withDuration));
}));

router.post('/', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const errors = validateChallenge(body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const now = new Date().toISOString();
  const info = await db.run(`
    INSERT INTO challenges (name, start_date, end_date, priority, description, budget_inr, created_at, updated_at)
    VALUES (@name, @start_date, @end_date, @priority, @description, @budget_inr, @now, @now)
  `, {
    name: body.name.trim(),
    start_date: body.start_date,
    end_date: body.end_date,
    priority: body.priority || 'medium',
    description: body.description ? String(body.description) : null,
    budget_inr: normalizeBudget(body.budget_inr),
    now,
  });

  res.status(201).json(withDuration(await getChallenge(info.lastInsertRowid)));
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const challenge = await getChallenge(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  res.json(withDuration(challenge));
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const existing = await getChallenge(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Challenge not found' });

  const body = req.body || {};
  const errors = validateChallenge(body, existing);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const merged = { ...existing, ...body };
  await db.run(`
    UPDATE challenges
    SET name = @name, start_date = @start_date, end_date = @end_date, priority = @priority,
        description = @description, budget_inr = @budget_inr, updated_at = @now
    WHERE id = @id
  `, {
    id: existing.id,
    name: merged.name.trim(),
    start_date: merged.start_date,
    end_date: merged.end_date,
    priority: merged.priority || 'medium',
    description: merged.description ? String(merged.description) : null,
    budget_inr: normalizeBudget(merged.budget_inr),
    now: new Date().toISOString(),
  });

  res.json(withDuration(await getChallenge(existing.id)));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const existing = await getChallenge(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Challenge not found' });

  await db.run('DELETE FROM challenge_notes WHERE challenge_id = @id', { id: existing.id });
  await db.run('DELETE FROM challenges WHERE id = @id', { id: existing.id });
  res.json({ deleted: true, id: existing.id });
}));

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------
function validateNote(body, existing = {}) {
  const errors = {};
  const merged = { ...existing, ...body };

  if (typeof merged.content !== 'string' || merged.content.trim() === '') {
    errors.content = 'Note text is required';
  } else if (merged.content.length > 1000) {
    errors.content = 'Note must be 1000 characters or fewer';
  }
  if (!NOTE_CATEGORIES.includes(merged.category || 'note')) {
    errors.category = `Must be one of: ${NOTE_CATEGORIES.join(', ')}`;
  }
  if (merged.done !== undefined && ![0, 1, true, false].includes(merged.done)) {
    errors.done = 'Must be 0 or 1';
  }
  return errors;
}

const NOTE_ORDER = `
  ORDER BY done ASC,
    CASE category WHEN 'priority' THEN 0 WHEN 'important' THEN 1 WHEN 'reminder' THEN 2 ELSE 3 END,
    id ASC
`;

router.get('/:id/notes', asyncHandler(async (req, res) => {
  if (!(await getChallenge(req.params.id))) return res.status(404).json({ error: 'Challenge not found' });
  const notes = await db.all(
    `SELECT * FROM challenge_notes WHERE challenge_id = @id ${NOTE_ORDER}`,
    { id: Number(req.params.id) }
  );
  res.json(notes);
}));

router.post('/:id/notes', asyncHandler(async (req, res) => {
  const challenge = await getChallenge(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  const body = req.body || {};
  const errors = validateNote(body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const now = new Date().toISOString();
  const info = await db.run(`
    INSERT INTO challenge_notes (challenge_id, category, content, done, created_at, updated_at)
    VALUES (@challenge_id, @category, @content, @done, @now, @now)
  `, {
    challenge_id: challenge.id,
    category: body.category || 'note',
    content: body.content.trim(),
    done: body.done ? 1 : 0,
    now,
  });

  res.status(201).json(await getNote(info.lastInsertRowid));
}));

router.put('/:id/notes/:nid', asyncHandler(async (req, res) => {
  const existing = await db.get(
    'SELECT * FROM challenge_notes WHERE id = @nid AND challenge_id = @id',
    { nid: Number(req.params.nid) || 0, id: Number(req.params.id) || 0 }
  );
  if (!existing) return res.status(404).json({ error: 'Note not found' });

  const body = req.body || {};
  const errors = validateNote(body, existing);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const merged = { ...existing, ...body };
  await db.run(`
    UPDATE challenge_notes SET category = @category, content = @content, done = @done, updated_at = @now
    WHERE id = @id
  `, {
    id: existing.id,
    category: merged.category,
    content: merged.content.trim(),
    done: merged.done ? 1 : 0,
    now: new Date().toISOString(),
  });

  res.json(await getNote(existing.id));
}));

router.delete('/:id/notes/:nid', asyncHandler(async (req, res) => {
  const info = await db.run(
    'DELETE FROM challenge_notes WHERE id = @nid AND challenge_id = @id',
    { nid: Number(req.params.nid) || 0, id: Number(req.params.id) || 0 }
  );
  if (info.changes === 0) return res.status(404).json({ error: 'Note not found' });
  res.json({ deleted: true, id: Number(req.params.nid) });
}));

module.exports = router;
