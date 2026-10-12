'use strict';

/**
 * tests/integration/migration.test.js
 * Opening a database created before challenges existed.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { createClient } = require('@libsql/client');

const OLD_SCHEMA = `
  CREATE TABLE daily_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL UNIQUE,
    created_at TEXT, updated_at TEXT, weight_kg REAL, calories_kcal REAL, protein_g REAL
  );
  CREATE TABLE challenge_settings (
    id INTEGER PRIMARY KEY, start_date TEXT DEFAULT '2026-10-12', end_date TEXT DEFAULT '2026-11-01',
    review_date TEXT DEFAULT '2026-11-02', budget_inr REAL DEFAULT 1500, weight_min REAL DEFAULT 30,
    weight_max REAL DEFAULT 200, waist_start_cm REAL, waist_start_date TEXT, waist_end_cm REAL,
    waist_end_date TEXT, updated_at TEXT
  );
  INSERT INTO challenge_settings (id) VALUES (1);
`;

/** Create an old-format DB file, optionally with a log, then open it through the app's db module. */
async function openOldDb(withLog) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'davinci-')), 'old.db');
  const raw = createClient({ url: `file:${file}` });
  await raw.executeMultiple(OLD_SCHEMA + (withLog ? "INSERT INTO daily_logs (date, weight_kg) VALUES ('2026-10-15', 72);" : ''));
  raw.close();

  process.env.DB_PATH = file;
  let db;
  jest.isolateModules(() => { db = require('../../src/db/database'); });
  await db.ready;
  return db;
}

test('old database with logs: keeps them and carries the 21-day challenge over once', async () => {
  const db = await openOldDb(true);
  expect(await db.all('SELECT name, start_date, end_date FROM challenges')).toEqual([
    { name: '21-Day Challenge', start_date: '2026-10-12', end_date: '2026-11-01' },
  ]);
  expect((await db.get("SELECT weight_kg FROM daily_logs WHERE date = '2026-10-15'")).weight_kg).toBe(72);

  // New columns were added
  const cols = (await db.all('PRAGMA table_info(daily_logs)')).map(c => c.name);
  expect(cols).toEqual(expect.arrayContaining(['carbs_g', 'fat_g', 'fiber_g']));
  expect((await db.get('SELECT calorie_target_kcal FROM challenge_settings')).calorie_target_kcal).toBe(2200);

  // Deleting it sticks across a restart
  await db.run('DELETE FROM challenges');
  const { initDb } = require('../../src/db/schema');
  await initDb(db);
  expect(await db.all('SELECT * FROM challenges')).toEqual([]);
  db.close();
});

test('old database without logs: starts with no challenges', async () => {
  const db = await openOldDb(false);
  expect(await db.all('SELECT * FROM challenges')).toEqual([]);
  db.close();
});
