'use strict';

/**
 * routes/stats.js
 * Aggregated statistics endpoints. Each accepts ?challengeId=N to scope the
 * numbers to that challenge's dates (defaults to the original 21-day window).
 *
 * GET /api/stats/overview
 * GET /api/stats/spending
 * GET /api/stats/trends
 * GET /api/stats/habits
 * GET /api/stats/final-review
 */

const express = require('express');
const router  = express.Router();
const db      = require('../db/database');
const { todayStr, daysInclusive } = require('../utils/dateUtils');
const { challengeRange } = require('../utils/challenge');

router.use(challengeRange);

// Restricts a daily_logs query to the requested challenge window
const IN_RANGE = 'date BETWEEN @start AND @end';

// ---------------------------------------------------------------------------
// GET /api/stats/overview
// ---------------------------------------------------------------------------
router.get('/overview', (req, res) => {
  const { start, end, totalDays } = req.range;
  const daysLogged = db.prepare(`SELECT COUNT(*) AS cnt FROM daily_logs WHERE ${IN_RANGE}`).get(req.range).cnt;
  const daysWithData = db
    .prepare(`SELECT date FROM daily_logs WHERE ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range)
    .map(r => r.date);

  const today = todayStr();

  res.json({
    totalDays,
    daysLogged,
    challengeStartDate: start,
    challengeEndDate: end,
    today,
    todayDay: today >= start && today <= end ? daysInclusive(start, today) : null,
    daysWithData,
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats/spending
// ---------------------------------------------------------------------------
router.get('/spending', (req, res) => {
  const budget = getBudget(req.range);

  const totalRow = db
    .prepare(`SELECT SUM(extra_spent_inr) AS total FROM daily_logs WHERE extra_spent_inr IS NOT NULL AND ${IN_RANGE}`)
    .get(req.range);
  const totalSpent = totalRow.total !== null ? totalRow.total : 0;

  const byDay = db
    .prepare(`
      SELECT date, extra_spent_inr AS amount, spending_category AS category, spending_note AS note
      FROM daily_logs
      WHERE extra_spent_inr IS NOT NULL AND ${IN_RANGE}
      ORDER BY date ASC
    `)
    .all(req.range);

  res.json({
    totalSpent,
    budget,
    remaining: budget - totalSpent,
    byDay,
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats/trends
// ---------------------------------------------------------------------------
router.get('/trends', (req, res) => {
  const weights = db
    .prepare(`SELECT date, weight_kg AS value FROM daily_logs WHERE weight_kg IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);

  const steps = db
    .prepare(`SELECT date, total_steps AS value FROM daily_logs WHERE total_steps IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);

  const protein = db
    .prepare(`SELECT date, protein_g AS value FROM daily_logs WHERE protein_g IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);

  const water = db
    .prepare(`SELECT date, water_l AS value FROM daily_logs WHERE water_l IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);

  const sleepRaw = db
    .prepare(`SELECT date, sleep_duration_min FROM daily_logs WHERE sleep_duration_min IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);
  const sleep = sleepRaw.map(r => ({
    date: r.date,
    value: parseFloat((r.sleep_duration_min / 60).toFixed(2)),
  }));

  const studyRaw = db
    .prepare(`SELECT date, career_study_min FROM daily_logs WHERE career_study_min IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);
  const studyHours = studyRaw.map(r => ({
    date: r.date,
    value: parseFloat((r.career_study_min / 60).toFixed(2)),
  }));

  const calories = db
    .prepare(`SELECT date, calories_kcal AS value FROM daily_logs WHERE calories_kcal IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);

  const spending = db
    .prepare(`SELECT date, extra_spent_inr AS value FROM daily_logs WHERE extra_spent_inr IS NOT NULL AND ${IN_RANGE} ORDER BY date ASC`)
    .all(req.range);

  res.json({ weights, steps, protein, water, sleep, studyHours, calories, spending });
});

// ---------------------------------------------------------------------------
// GET /api/stats/habits
// ---------------------------------------------------------------------------
router.get('/habits', (req, res) => {
  const HABIT_FIELDS = [
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
  ];

  const results = HABIT_FIELDS.map(habit => {
    const row = db.prepare(`
      SELECT
        COUNT(CASE WHEN ${habit} IS NOT NULL THEN 1 END) AS applicable_days,
        COUNT(CASE WHEN ${habit} = 1 THEN 1 END)         AS completed_days
      FROM daily_logs
      WHERE ${IN_RANGE}
    `).get(req.range);

    const applicable = row.applicable_days;
    const completed  = row.completed_days;
    return {
      habit,
      applicable_days: applicable,
      completed_days: completed,
      rate: applicable > 0 ? completed / applicable : null,
    };
  });

  // hair_care: only count rows where hair_care IN (0, 1) as applicable
  const hairRow = db.prepare(`
    SELECT
      COUNT(CASE WHEN hair_care IN (0, 1) THEN 1 END) AS applicable_days,
      COUNT(CASE WHEN hair_care = 1         THEN 1 END) AS completed_days
    FROM daily_logs
    WHERE ${IN_RANGE}
  `).get(req.range);

  results.push({
    habit: 'hair_care',
    applicable_days: hairRow.applicable_days,
    completed_days: hairRow.completed_days,
    rate: hairRow.applicable_days > 0 ? hairRow.completed_days / hairRow.applicable_days : null,
  });

  res.json(results);
});

// ---------------------------------------------------------------------------
// GET /api/stats/final-review
// ---------------------------------------------------------------------------
router.get('/final-review', (req, res) => {
  const settings = db.prepare('SELECT * FROM challenge_settings WHERE id = 1').get();

  const { start, end, totalDays } = req.range;
  const day1Row  = db.prepare('SELECT weight_kg FROM daily_logs WHERE date = ?').get(start);
  const day21Row = db.prepare('SELECT weight_kg FROM daily_logs WHERE date = ?').get(end);

  const day1Weight  = day1Row  ? day1Row.weight_kg  : null;
  const day21Weight = day21Row ? day21Row.weight_kg : null;
  const weightChange = (day1Weight !== null && day21Weight !== null)
    ? parseFloat((day21Weight - day1Weight).toFixed(2))
    : null;

  const waistStart  = settings ? settings.waist_start_cm  : null;
  const waistEnd    = settings ? settings.waist_end_cm    : null;
  const waistChange = (waistStart !== null && waistEnd !== null)
    ? parseFloat((waistEnd - waistStart).toFixed(2))
    : null;

  // avgSteps
  const stepsRow = db.prepare(`
    SELECT AVG(total_steps) AS avg, COUNT(total_steps) AS cnt
    FROM daily_logs WHERE total_steps IS NOT NULL AND ${IN_RANGE}
  `).get(req.range);

  // totalGymSessions
  const gymRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM daily_logs
    WHERE workout_type IS NOT NULL
      AND workout_type NOT IN ('Rest', 'Recovery')
      AND ${IN_RANGE}
  `).get(req.range);

  // totalCardioSessions
  const cardioRow = db.prepare(`
    SELECT COUNT(*) AS cnt FROM daily_logs WHERE cardio_completed = 1 AND ${IN_RANGE}
  `).get(req.range);

  // avgSleep
  const sleepRow = db.prepare(`
    SELECT AVG(sleep_duration_min) AS avg, COUNT(sleep_duration_min) AS cnt
    FROM daily_logs WHERE sleep_duration_min IS NOT NULL AND ${IN_RANGE}
  `).get(req.range);

  // avgProtein
  const proteinRow = db.prepare(`
    SELECT AVG(protein_g) AS avg, COUNT(protein_g) AS cnt
    FROM daily_logs WHERE protein_g IS NOT NULL AND ${IN_RANGE}
  `).get(req.range);

  // totalStudyHours
  const studyRow = db.prepare(`
    SELECT SUM(career_study_min) AS total FROM daily_logs WHERE career_study_min IS NOT NULL AND ${IN_RANGE}
  `).get(req.range);

  // totalSpent
  const spentRow = db.prepare(`
    SELECT SUM(extra_spent_inr) AS total FROM daily_logs WHERE extra_spent_inr IS NOT NULL AND ${IN_RANGE}
  `).get(req.range);

  const totalSpent = spentRow.total !== null ? spentRow.total : 0;
  const budget = getBudget(req.range);

  const daysLogged = db.prepare(`SELECT COUNT(*) AS cnt FROM daily_logs WHERE ${IN_RANGE}`).get(req.range).cnt;

  res.json({
    day1Weight,
    day21Weight,
    weightChange,
    waistStart,
    waistEnd,
    waistChange,
    avgSteps: {
      value: stepsRow.avg !== null ? parseFloat(stepsRow.avg.toFixed(0)) : null,
      count: stepsRow.cnt,
    },
    totalGymSessions: gymRow.cnt,
    totalCardioSessions: cardioRow.cnt,
    avgSleep: {
      value: sleepRow.avg !== null ? parseFloat((sleepRow.avg / 60).toFixed(2)) : null,
      count: sleepRow.cnt,
    },
    avgProtein: {
      value: proteinRow.avg !== null ? parseFloat(proteinRow.avg.toFixed(1)) : null,
      count: proteinRow.cnt,
    },
    totalStudyHours: studyRow.total !== null ? parseFloat((studyRow.total / 60).toFixed(2)) : 0,
    totalSpent,
    budgetRemaining: budget - totalSpent,
    daysLogged,
    totalDays,
    startDate: start,
    endDate: end,
    budget,
    challenge: req.range.challenge,
    settings: settings || null,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Challenge-specific budget when set, otherwise the global budget from settings. */
function getBudget(range) {
  if (range.challenge && range.challenge.budget_inr != null) return range.challenge.budget_inr;
  const settings = db.prepare('SELECT budget_inr FROM challenge_settings WHERE id = 1').get();
  return settings ? settings.budget_inr : 1500;
}

module.exports = router;
