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
const { asyncHandler } = require('../utils/asyncHandler');

router.use(challengeRange);

// Restricts a daily_logs query to the requested challenge window
const IN_RANGE = 'date BETWEEN @start AND @end';

/** Query parameters for IN_RANGE. */
function rangeArgs(req) {
  return { start: req.range.start, end: req.range.end };
}

// ---------------------------------------------------------------------------
// GET /api/stats/overview
// ---------------------------------------------------------------------------
router.get('/overview', asyncHandler(async (req, res) => {
  const { start, end, totalDays } = req.range;
  const daysWithData = (await db.all(
    `SELECT date FROM daily_logs WHERE ${IN_RANGE} ORDER BY date ASC`,
    rangeArgs(req)
  )).map(r => r.date);

  const today = todayStr();

  res.json({
    totalDays,
    daysLogged: daysWithData.length,
    challengeStartDate: start,
    challengeEndDate: end,
    today,
    todayDay: today >= start && today <= end ? daysInclusive(start, today) : null,
    daysWithData,
  });
}));

// ---------------------------------------------------------------------------
// GET /api/stats/spending
// ---------------------------------------------------------------------------
router.get('/spending', asyncHandler(async (req, res) => {
  const budget = await getBudget(req.range);

  const byDay = await db.all(`
    SELECT date, extra_spent_inr AS amount, spending_category AS category, spending_note AS note
    FROM daily_logs
    WHERE extra_spent_inr IS NOT NULL AND ${IN_RANGE}
    ORDER BY date ASC
  `, rangeArgs(req));

  const totalSpent = byDay.reduce((sum, d) => sum + d.amount, 0);

  res.json({
    totalSpent,
    budget,
    remaining: budget - totalSpent,
    byDay,
  });
}));

// ---------------------------------------------------------------------------
// GET /api/stats/trends
// ---------------------------------------------------------------------------
router.get('/trends', asyncHandler(async (req, res) => {
  const rows = await db.all(`
    SELECT date, weight_kg, total_steps, protein_g, water_l, sleep_duration_min,
           career_study_min, calories_kcal, extra_spent_inr
    FROM daily_logs
    WHERE ${IN_RANGE}
    ORDER BY date ASC
  `, rangeArgs(req));

  // One { date, value } series per metric, skipping days where it wasn't logged
  const series = (field, transform = v => v) => rows
    .filter(r => r[field] !== null && r[field] !== undefined)
    .map(r => ({ date: r.date, value: transform(r[field]) }));
  const toHours = mins => parseFloat((mins / 60).toFixed(2));

  res.json({
    weights:    series('weight_kg'),
    steps:      series('total_steps'),
    protein:    series('protein_g'),
    water:      series('water_l'),
    sleep:      series('sleep_duration_min', toHours),
    studyHours: series('career_study_min', toHours),
    calories:   series('calories_kcal'),
    spending:   series('extra_spent_inr'),
  });
}));

// ---------------------------------------------------------------------------
// GET /api/stats/habits
// ---------------------------------------------------------------------------
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

router.get('/habits', asyncHandler(async (req, res) => {
  // One query for every habit: <habit>_a = applicable days, <habit>_c = completed days
  const counts = HABIT_FIELDS.map(h => `
    COUNT(CASE WHEN ${h} IS NOT NULL THEN 1 END) AS ${h}_a,
    COUNT(CASE WHEN ${h} = 1 THEN 1 END)         AS ${h}_c`).join(',');

  const row = await db.get(`
    SELECT ${counts},
      -- hair_care: only 0/1 count as applicable (2 = not scheduled)
      COUNT(CASE WHEN hair_care IN (0, 1) THEN 1 END) AS hair_care_a,
      COUNT(CASE WHEN hair_care = 1       THEN 1 END) AS hair_care_c
    FROM daily_logs
    WHERE ${IN_RANGE}
  `, rangeArgs(req));

  const results = [...HABIT_FIELDS, 'hair_care'].map(habit => {
    const applicable = row[`${habit}_a`];
    const completed  = row[`${habit}_c`];
    return {
      habit,
      applicable_days: applicable,
      completed_days: completed,
      rate: applicable > 0 ? completed / applicable : null,
    };
  });

  res.json(results);
}));

// ---------------------------------------------------------------------------
// GET /api/stats/final-review
// ---------------------------------------------------------------------------
router.get('/final-review', asyncHandler(async (req, res) => {
  const { start, end, totalDays } = req.range;
  const args = rangeArgs(req);

  const [settings, day1Row, dayNRow, agg, budget] = await Promise.all([
    db.get('SELECT * FROM challenge_settings WHERE id = 1'),
    db.get('SELECT weight_kg FROM daily_logs WHERE date = @start', args),
    db.get('SELECT weight_kg FROM daily_logs WHERE date = @end', args),
    db.get(`
      SELECT
        COUNT(*)                                       AS days_logged,
        AVG(total_steps)                               AS steps_avg,
        COUNT(total_steps)                             AS steps_cnt,
        COUNT(CASE WHEN workout_type IS NOT NULL
                    AND workout_type NOT IN ('Rest', 'Recovery') THEN 1 END) AS gym_cnt,
        COUNT(CASE WHEN cardio_completed = 1 THEN 1 END) AS cardio_cnt,
        AVG(sleep_duration_min)                        AS sleep_avg,
        COUNT(sleep_duration_min)                      AS sleep_cnt,
        AVG(protein_g)                                 AS protein_avg,
        COUNT(protein_g)                               AS protein_cnt,
        SUM(career_study_min)                          AS study_total,
        SUM(extra_spent_inr)                           AS spent_total
      FROM daily_logs
      WHERE ${IN_RANGE}
    `, args),
    getBudget(req.range),
  ]);

  const day1Weight  = day1Row ? day1Row.weight_kg : null;
  const day21Weight = dayNRow ? dayNRow.weight_kg : null;
  const weightChange = (day1Weight !== null && day21Weight !== null)
    ? parseFloat((day21Weight - day1Weight).toFixed(2))
    : null;

  const waistStart  = settings ? settings.waist_start_cm : null;
  const waistEnd    = settings ? settings.waist_end_cm   : null;
  const waistChange = (waistStart !== null && waistEnd !== null)
    ? parseFloat((waistEnd - waistStart).toFixed(2))
    : null;

  const totalSpent = agg.spent_total !== null ? agg.spent_total : 0;

  res.json({
    day1Weight,
    day21Weight,
    weightChange,
    waistStart,
    waistEnd,
    waistChange,
    avgSteps: {
      value: agg.steps_avg !== null ? parseFloat(agg.steps_avg.toFixed(0)) : null,
      count: agg.steps_cnt,
    },
    totalGymSessions: agg.gym_cnt,
    totalCardioSessions: agg.cardio_cnt,
    avgSleep: {
      value: agg.sleep_avg !== null ? parseFloat((agg.sleep_avg / 60).toFixed(2)) : null,
      count: agg.sleep_cnt,
    },
    avgProtein: {
      value: agg.protein_avg !== null ? parseFloat(agg.protein_avg.toFixed(1)) : null,
      count: agg.protein_cnt,
    },
    totalStudyHours: agg.study_total !== null ? parseFloat((agg.study_total / 60).toFixed(2)) : 0,
    totalSpent,
    budgetRemaining: budget - totalSpent,
    daysLogged: agg.days_logged,
    totalDays,
    startDate: start,
    endDate: end,
    budget,
    challenge: req.range.challenge,
    settings: settings || null,
  });
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Challenge-specific budget when set, otherwise the global budget from settings. */
async function getBudget(range) {
  if (range.challenge && range.challenge.budget_inr != null) return range.challenge.budget_inr;
  const settings = await db.get('SELECT budget_inr FROM challenge_settings WHERE id = 1');
  return settings ? settings.budget_inr : 1500;
}

module.exports = router;
