'use strict';

/**
 * schema.js
 * Initializes the SQLite database schema.
 * All tables are created with IF NOT EXISTS to be safe on re-runs.
 */

/**
 * Run all CREATE TABLE IF NOT EXISTS statements and seed default settings.
 * @param {import('better-sqlite3').Database} db
 */
function initDb(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_logs (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      date                    TEXT NOT NULL UNIQUE,
      created_at              TEXT,
      updated_at              TEXT,

      -- Fitness
      weight_kg               REAL,
      workout_type            TEXT,
      workout_notes           TEXT,
      cardio_completed        INTEGER,
      cardio_duration_min     INTEGER,
      total_steps             INTEGER,
      plank_completed         INTEGER,
      plank_duration_sec      INTEGER,

      -- Nutrition
      calories_kcal           REAL,
      protein_g               REAL,
      water_l                 REAL,
      fruits_veggies          INTEGER,
      junk_food               INTEGER,
      within_calorie_target   INTEGER,
      planned_meals_tomorrow  INTEGER,
      nutrition_notes         TEXT,

      -- Sleep
      bedtime                 TEXT,
      wake_time               TEXT,
      sleep_duration_min      INTEGER,
      sleep_manual_override   INTEGER,

      -- Career
      career_topic            TEXT,
      career_practical        TEXT,
      career_dsa              TEXT,
      career_learned          TEXT,
      career_study_min        INTEGER,

      -- Grooming
      brush_teeth             INTEGER,
      tongue_scrape           INTEGER,
      floss                   INTEGER,
      morning_skincare        INTEGER,
      night_skincare          INTEGER,
      hair_care               INTEGER,

      -- Spirituality
      hanuman_chalisa         INTEGER,

      -- Mental Discipline
      porn_free               INTEGER,
      masturbation_free       INTEGER,
      social_media_limit      INTEGER,
      pranayama_min           INTEGER,

      -- Personal Growth
      podcast                 INTEGER,
      communication           INTEGER,
      planned_tomorrow        INTEGER,

      -- Personal Care
      bed_setup               INTEGER,
      body_detox              INTEGER,
      shower                  INTEGER,
      room_reset              INTEGER,
      stockings               INTEGER,

      -- Financial
      extra_spent_inr         REAL,
      spending_category       TEXT,
      spending_note           TEXT,

      -- Reflection
      best_thing              TEXT,
      biggest_mistake         TEXT,
      one_improvement         TEXT,

      -- Planning
      priority_1              TEXT,
      priority_2              TEXT,
      priority_3              TEXT,
      planning_notes          TEXT
    );

    CREATE TABLE IF NOT EXISTS challenge_settings (
      id              INTEGER PRIMARY KEY,
      start_date      TEXT DEFAULT '2026-10-12',
      end_date        TEXT DEFAULT '2026-11-01',
      review_date     TEXT DEFAULT '2026-11-02',
      budget_inr      REAL DEFAULT 1500,
      weight_min      REAL DEFAULT 30,
      weight_max      REAL DEFAULT 200,
      waist_start_cm  REAL,
      waist_start_date TEXT,
      waist_end_cm    REAL,
      waist_end_date  TEXT,
      updated_at      TEXT
    );
  `);

  // Seed default settings row (id=1) if it doesn't exist yet
  db.prepare(`
    INSERT OR IGNORE INTO challenge_settings (id, start_date, end_date, review_date, budget_inr, weight_min, weight_max)
    VALUES (1, '2026-10-12', '2026-11-01', '2026-11-02', 1500, 30, 200)
  `).run();
}

module.exports = { initDb };
