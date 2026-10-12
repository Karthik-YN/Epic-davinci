'use strict';

/**
 * schema.js
 * Initializes the SQLite database schema.
 * All tables are created with IF NOT EXISTS to be safe on re-runs.
 */

/**
 * Run all CREATE TABLE IF NOT EXISTS statements and seed default settings.
 * @param {typeof import('./database')} db
 */
async function initDb(db) {
  // Remember whether the challenges table is new, so the legacy challenge is carried over only once
  const hadChallengesTable = !!(await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'challenges'"
  ));

  await db.exec(`
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
      carbs_g                 REAL,
      fat_g                   REAL,
      fiber_g                 REAL,
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

      -- Daily nutrition targets
      calorie_target_kcal REAL DEFAULT 2200,
      protein_target_g    REAL DEFAULT 140,
      carbs_target_g      REAL DEFAULT 220,
      fat_target_g        REAL DEFAULT 70,
      fiber_target_g      REAL DEFAULT 30,
      water_target_l      REAL DEFAULT 3.5,

      updated_at      TEXT
    );

    CREATE TABLE IF NOT EXISTS challenges (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      start_date  TEXT NOT NULL,
      end_date    TEXT NOT NULL,
      priority    TEXT NOT NULL DEFAULT 'medium',
      description TEXT,
      budget_inr  REAL,
      created_at  TEXT,
      updated_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS challenge_notes (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id  INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
      category      TEXT NOT NULL DEFAULT 'note',
      content       TEXT NOT NULL,
      done          INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT,
      updated_at    TEXT
    );
  `);

  // Add columns introduced after the first release to existing databases
  await addMissingColumns(db, 'daily_logs', {
    carbs_g: 'REAL',
    fat_g:   'REAL',
    fiber_g: 'REAL',
  });
  await addMissingColumns(db, 'challenge_settings', {
    calorie_target_kcal: 'REAL DEFAULT 2200',
    protein_target_g:    'REAL DEFAULT 140',
    carbs_target_g:      'REAL DEFAULT 220',
    fat_target_g:        'REAL DEFAULT 70',
    fiber_target_g:      'REAL DEFAULT 30',
    water_target_l:      'REAL DEFAULT 3.5',
  });

  // Seed default settings row (id=1) if it doesn't exist yet
  await db.run(`
    INSERT OR IGNORE INTO challenge_settings (id, start_date, end_date, review_date, budget_inr, weight_min, weight_max)
    VALUES (1, '2026-10-12', '2026-11-01', '2026-11-02', 1500, 30, 200)
  `);

  // A database from before challenges existed: carry its 21-day window over as the first
  // challenge, but only if it actually holds logs for it. A brand-new database starts empty,
  // so a challenge the user deleted is never re-created.
  if (!hadChallengesTable) {
    const settings = await db.get('SELECT start_date, end_date FROM challenge_settings WHERE id = 1');
    const hasLogs = await db.get(
      'SELECT 1 AS found FROM daily_logs WHERE date BETWEEN @start AND @end LIMIT 1',
      { start: settings.start_date, end: settings.end_date }
    );
    if (hasLogs) {
      const now = new Date().toISOString();
      await db.run(`
        INSERT INTO challenges (name, start_date, end_date, priority, created_at, updated_at)
        VALUES ('21-Day Challenge', @start, @end, 'high', @now, @now)
      `, { start: settings.start_date, end: settings.end_date, now });
    }
  }
}

/**
 * ALTER TABLE ADD COLUMN for every column in `columns` the table doesn't have yet.
 * @param {typeof import('./database')} db
 * @param {string} table
 * @param {Object<string, string>} columns  name → type definition
 */
async function addMissingColumns(db, table, columns) {
  const existing = new Set((await db.all(`PRAGMA table_info(${table})`)).map(c => c.name));
  for (const [name, type] of Object.entries(columns)) {
    if (!existing.has(name)) {
      await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type};`);
    }
  }
}

module.exports = { initDb };
