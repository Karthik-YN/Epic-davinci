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
  return db.prepare('SELECT * FROM challenges WHERE id = ?').get(Number(id));
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
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM challenge_notes n WHERE n.challenge_id = c.id) AS notes_count,
      (SELECT COUNT(*) FROM daily_logs l WHERE l.date BETWEEN c.start_date AND c.end_date) AS days_logged
    FROM challenges c
    ORDER BY c.start_date DESC, c.id DESC
  `).all();
  res.json(rows.map(withDuration));
});

router.post('/', (req, res) => {
  const body = req.body || {};
  const errors = validateChallenge(body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO challenges (name, start_date, end_date, priority, description, budget_inr, created_at, updated_at)
    VALUES (@name, @start_date, @end_date, @priority, @description, @budget_inr, @now, @now)
  `).run({
    name: body.name.trim(),
    start_date: body.start_date,
    end_date: body.end_date,
    priority: body.priority || 'medium',
    description: body.description ? String(body.description) : null,
    budget_inr: normalizeBudget(body.budget_inr),
    now,
  });

  res.status(201).json(withDuration(getChallenge(info.lastInsertRowid)));
});

router.get('/:id', (req, res) => {
  const challenge = getChallenge(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
  res.json(withDuration(challenge));
});

router.put('/:id', (req, res) => {
  const existing = getChallenge(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Challenge not found' });

  const body = req.body || {};
  const errors = validateChallenge(body, existing);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const merged = { ...existing, ...body };
  db.prepare(`
    UPDATE challenges
    SET name = @name, start_date = @start_date, end_date = @end_date, priority = @priority,
        description = @description, budget_inr = @budget_inr, updated_at = @now
    WHERE id = @id
  `).run({
    id: existing.id,
    name: merged.name.trim(),
    start_date: merged.start_date,
    end_date: merged.end_date,
    priority: merged.priority || 'medium',
    description: merged.description ? String(merged.description) : null,
    budget_inr: normalizeBudget(merged.budget_inr),
    now: new Date().toISOString(),
  });

  res.json(withDuration(getChallenge(existing.id)));
});

router.delete('/:id', (req, res) => {
  const existing = getChallenge(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Challenge not found' });

  db.prepare('DELETE FROM challenge_notes WHERE challenge_id = ?').run(existing.id);
  db.prepare('DELETE FROM challenges WHERE id = ?').run(existing.id);
  res.json({ deleted: true, id: existing.id });
});

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

router.get('/:id/notes', (req, res) => {
  if (!getChallenge(req.params.id)) return res.status(404).json({ error: 'Challenge not found' });
  const notes = db
    .prepare(`SELECT * FROM challenge_notes WHERE challenge_id = ? ${NOTE_ORDER}`)
    .all(Number(req.params.id));
  res.json(notes);
});

router.post('/:id/notes', (req, res) => {
  const challenge = getChallenge(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found' });

  const body = req.body || {};
  const errors = validateNote(body);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO challenge_notes (challenge_id, category, content, done, created_at, updated_at)
    VALUES (@challenge_id, @category, @content, @done, @now, @now)
  `).run({
    challenge_id: challenge.id,
    category: body.category || 'note',
    content: body.content.trim(),
    done: body.done ? 1 : 0,
    now,
  });

  res.status(201).json(db.prepare('SELECT * FROM challenge_notes WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id/notes/:nid', (req, res) => {
  const existing = db
    .prepare('SELECT * FROM challenge_notes WHERE id = ? AND challenge_id = ?')
    .get(Number(req.params.nid), Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Note not found' });

  const body = req.body || {};
  const errors = validateNote(body, existing);
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: 'Validation failed', errors });
  }

  const merged = { ...existing, ...body };
  db.prepare(`
    UPDATE challenge_notes SET category = @category, content = @content, done = @done, updated_at = @now
    WHERE id = @id
  `).run({
    id: existing.id,
    category: merged.category,
    content: merged.content.trim(),
    done: merged.done ? 1 : 0,
    now: new Date().toISOString(),
  });

  res.json(db.prepare('SELECT * FROM challenge_notes WHERE id = ?').get(existing.id));
});

router.delete('/:id/notes/:nid', (req, res) => {
  const info = db
    .prepare('DELETE FROM challenge_notes WHERE id = ? AND challenge_id = ?')
    .run(Number(req.params.nid), Number(req.params.id));
  if (info.changes === 0) return res.status(404).json({ error: 'Note not found' });
  res.json({ deleted: true, id: Number(req.params.nid) });
});

module.exports = router;
