'use strict';

/**
 * tests/integration/api.test.js
 * Integration tests against the actual Express app with a test database.
 */

// Use a test-specific DB path BEFORE importing anything that opens the DB
process.env.DB_PATH = '/tmp/test-tracker.db';

const request = require('supertest');
const fs      = require('fs');

// Clean up the test DB before loading the app
if (fs.existsSync(process.env.DB_PATH)) {
  fs.unlinkSync(process.env.DB_PATH);
}

// Now import the app (which will open the fresh test DB)
const app = require('../../src/server');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const DAY1 = '2026-10-12';
const BEFORE_START = '2026-10-11';
const AFTER_END    = '2026-11-02';

// ---------------------------------------------------------------------------
// Fresh database
// ---------------------------------------------------------------------------
describe('Fresh database', () => {
  test('starts with no challenges (nothing is re-created on startup)', async () => {
    const res = await request(app).get('/api/challenges');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('logs are rejected while no challenge covers the date', async () => {
    const res = await request(app).post(`/api/logs/${DAY1}`).send({ weight_kg: 70 });
    expect(res.status).toBe(400);
  });

  test('API responses are never cached by the browser', async () => {
    const res = await request(app).get('/api/challenges');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  test('create the 21-day challenge used by the tests below', async () => {
    const res = await request(app).post('/api/challenges').send({
      name: '21-Day Challenge', start_date: DAY1, end_date: '2026-11-01', priority: 'high',
    });
    expect(res.status).toBe(201);
    expect(res.body.total_days).toBe(21);
  });
});

// ---------------------------------------------------------------------------
// POST → GET round-trip
// ---------------------------------------------------------------------------
describe('POST /api/logs/:date – upsert', () => {
  test('valid data → 200 with saved record', async () => {
    const payload = {
      weight_kg: 72.5,
      workout_type: 'Chest',
      cardio_completed: 1,
      cardio_duration_min: 20,
      total_steps: 9500,
      calories_kcal: 2100,
      protein_g: 140,
      water_l: 2.5,
      bedtime: '23:00',
      wake_time: '07:00',
      career_study_min: 90,
      extra_spent_inr: 200,
      spending_category: 'Food',
      porn_free: 1,
      masturbation_free: 1,
    };

    const res = await request(app).post(`/api/logs/${DAY1}`).send(payload);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(DAY1);
    expect(res.body.weight_kg).toBe(72.5);
    expect(res.body.cardio_completed).toBe(1);
    expect(res.body.protein_g).toBe(140);
  });

  test('GET after POST returns saved record', async () => {
    const res = await request(app).get(`/api/logs/${DAY1}`);
    expect(res.status).toBe(200);
    expect(res.body.date).toBe(DAY1);
    expect(res.body.weight_kg).toBe(72.5);
  });

  test('second POST updates (upsert) the record', async () => {
    const res = await request(app)
      .post(`/api/logs/${DAY1}`)
      .send({ weight_kg: 71.8 });
    expect(res.status).toBe(200);
    expect(res.body.weight_kg).toBe(71.8);
    expect(res.body.date).toBe(DAY1);
  });

  test('POST to date outside challenge → 400', async () => {
    const res = await request(app)
      .post(`/api/logs/${AFTER_END}`)
      .send({ weight_kg: 70 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('POST before challenge start → 400', async () => {
    const res = await request(app)
      .post(`/api/logs/${BEFORE_START}`)
      .send({ weight_kg: 70 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('negative weight_kg → 400 validation error', async () => {
    const res = await request(app)
      .post(`/api/logs/${DAY1}`)
      .send({ weight_kg: -5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
    expect(res.body.errors).toHaveProperty('weight_kg');
  });

  test('negative protein_g → 400 validation error', async () => {
    const res = await request(app)
      .post(`/api/logs/${DAY1}`)
      .send({ protein_g: -20 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('protein_g');
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs/:date – not found
// ---------------------------------------------------------------------------
describe('GET /api/logs/:date – not found', () => {
  test('GET date outside challenge window → 404', async () => {
    const res = await request(app).get(`/api/logs/${BEFORE_START}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// Null field preservation
// ---------------------------------------------------------------------------
describe('Null field preservation', () => {
  const DATE = '2026-10-13';

  test('fields not sent remain null in DB (not 0)', async () => {
    const res = await request(app)
      .post(`/api/logs/${DATE}`)
      .send({ weight_kg: 73, protein_g: 130 });
    expect(res.status).toBe(200);
    // Fields not in payload should be null
    expect(res.body.calories_kcal).toBeNull();
    expect(res.body.water_l).toBeNull();
    expect(res.body.cardio_completed).toBeNull();
    expect(res.body.brush_teeth).toBeNull();
    expect(res.body.extra_spent_inr).toBeNull();
  });

  test('GET confirms null fields are null', async () => {
    const res = await request(app).get(`/api/logs/${DATE}`);
    expect(res.status).toBe(200);
    expect(res.body.calories_kcal).toBeNull();
    expect(res.body.water_l).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Sleep duration calculation
// ---------------------------------------------------------------------------
describe('Sleep duration calculation', () => {
  test('23:00 → 07:00 gives sleep_duration_min = 480', async () => {
    const DATE = '2026-10-14';
    const res = await request(app)
      .post(`/api/logs/${DATE}`)
      .send({ bedtime: '23:00', wake_time: '07:00' });
    expect(res.status).toBe(200);
    expect(res.body.sleep_duration_min).toBe(480);
  });

  test('00:30 → 07:30 gives sleep_duration_min = 420', async () => {
    const DATE = '2026-10-15';
    const res = await request(app)
      .post(`/api/logs/${DATE}`)
      .send({ bedtime: '00:30', wake_time: '07:30' });
    expect(res.status).toBe(200);
    expect(res.body.sleep_duration_min).toBe(420);
  });
});

// ---------------------------------------------------------------------------
// hair_care = 2 preservation
// ---------------------------------------------------------------------------
describe('hair_care = 2 (not scheduled)', () => {
  test('hair_care = 2 is saved and returned correctly', async () => {
    const DATE = '2026-10-16';
    const res = await request(app)
      .post(`/api/logs/${DATE}`)
      .send({ hair_care: 2 });
    expect(res.status).toBe(200);
    expect(res.body.hair_care).toBe(2);

    const getRes = await request(app).get(`/api/logs/${DATE}`);
    expect(getRes.body.hair_care).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs/:date/exists
// ---------------------------------------------------------------------------
describe('GET /api/logs/:date/exists', () => {
  test('existing date returns exists: true', async () => {
    const res = await request(app).get(`/api/logs/${DAY1}/exists`);
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(true);
  });

  test('non-existing date returns exists: false', async () => {
    const res = await request(app).get('/api/logs/2026-10-30/exists');
    expect(res.status).toBe(200);
    expect(res.body.exists).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats/spending
// ---------------------------------------------------------------------------
describe('GET /api/stats/spending', () => {
  test('returns correct totals', async () => {
    const res = await request(app).get('/api/stats/spending');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalSpent');
    expect(res.body).toHaveProperty('budget');
    expect(res.body).toHaveProperty('remaining');
    expect(res.body).toHaveProperty('byDay');
    expect(Array.isArray(res.body.byDay)).toBe(true);
    // Day1 has 200 spent (from first test which was then overwritten; upsert keeps latest)
    expect(typeof res.body.totalSpent).toBe('number');
  });

  test('remaining = budget - totalSpent', async () => {
    const res = await request(app).get('/api/stats/spending');
    expect(res.body.remaining).toBeCloseTo(res.body.budget - res.body.totalSpent, 5);
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats/final-review
// ---------------------------------------------------------------------------
describe('GET /api/stats/final-review', () => {
  test('returns day1Weight from Oct 12', async () => {
    const res = await request(app).get('/api/stats/final-review');
    expect(res.status).toBe(200);
    // Day 1 was updated to 71.8 by the upsert test
    expect(res.body.day1Weight).toBe(71.8);
  });

  test('day21Weight is null (Nov 1 not logged yet)', async () => {
    const res = await request(app).get('/api/stats/final-review');
    expect(res.body.day21Weight).toBeNull();
  });

  test('weightChange is null when day21 missing', async () => {
    const res = await request(app).get('/api/stats/final-review');
    expect(res.body.weightChange).toBeNull();
  });

  test('has required top-level fields', async () => {
    const res = await request(app).get('/api/stats/final-review');
    expect(res.body).toHaveProperty('totalGymSessions');
    expect(res.body).toHaveProperty('totalCardioSessions');
    expect(res.body).toHaveProperty('avgSleep');
    expect(res.body).toHaveProperty('avgProtein');
    expect(res.body).toHaveProperty('totalStudyHours');
    expect(res.body).toHaveProperty('totalSpent');
    expect(res.body).toHaveProperty('daysLogged');
    expect(res.body).toHaveProperty('settings');
  });
});

// ---------------------------------------------------------------------------
// GET /api/export/json
// ---------------------------------------------------------------------------
describe('GET /api/export/json', () => {
  test('returns valid JSON with all records', async () => {
    const res = await request(app).get('/api/export/json');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('exportedAt');
    expect(res.body).toHaveProperty('settings');
  });

  test('Content-Disposition header is set', async () => {
    const res = await request(app).get('/api/export/json');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.json/);
  });
});

// ---------------------------------------------------------------------------
// GET /api/export/csv
// ---------------------------------------------------------------------------
describe('GET /api/export/csv', () => {
  test('returns CSV content type', async () => {
    const res = await request(app).get('/api/export/csv');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
  });

  test('Content-Disposition header is set', async () => {
    const res = await request(app).get('/api/export/csv');
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    expect(res.headers['content-disposition']).toMatch(/\.csv/);
  });
});

// ---------------------------------------------------------------------------
// GET /api/stats/overview
// ---------------------------------------------------------------------------
describe('GET /api/stats/overview', () => {
  test('returns correct structure', async () => {
    const res = await request(app).get('/api/stats/overview');
    expect(res.status).toBe(200);
    expect(res.body.totalDays).toBe(21);
    expect(res.body).toHaveProperty('daysLogged');
    expect(res.body).toHaveProperty('challengeStartDate');
    expect(res.body).toHaveProperty('challengeEndDate');
    expect(res.body).toHaveProperty('daysWithData');
    expect(Array.isArray(res.body.daysWithData)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/logs – all logs
// ---------------------------------------------------------------------------
describe('GET /api/logs', () => {
  test('returns array ordered by date', async () => {
    const res = await request(app).get('/api/logs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    // Verify ordering
    const dates = res.body.map(r => r.date);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
  });
});

// ---------------------------------------------------------------------------
// GET /api/settings
// ---------------------------------------------------------------------------
describe('GET /api/settings', () => {
  test('returns settings row', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
    expect(res.body.budget_inr).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/settings
// ---------------------------------------------------------------------------
describe('PUT /api/settings', () => {
  test('updates budget_inr', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ budget_inr: 2000 });
    expect(res.status).toBe(200);
    expect(res.body.budget_inr).toBe(2000);
  });

  test('negative budget fails', async () => {
    const res = await request(app)
      .put('/api/settings')
      .send({ budget_inr: -100 });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('errors');
  });
});

// ---------------------------------------------------------------------------
// Challenges
// ---------------------------------------------------------------------------
describe('Challenges API', () => {
  let weekId;

  test('lists the 21-day challenge', async () => {
    const res = await request(app).get('/api/challenges');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      name: '21-Day Challenge',
      start_date: '2026-10-12',
      end_date: '2026-11-01',
      total_days: 21,
      priority: 'high',
    });
  });

  test('creates a 7-day challenge', async () => {
    const res = await request(app).post('/api/challenges').send({
      name: '7-Day Reset',
      start_date: '2026-12-01',
      end_date: '2026-12-07',
      priority: 'low',
      budget_inr: 500,
    });
    expect(res.status).toBe(201);
    expect(res.body.total_days).toBe(7);
    expect(res.body.priority).toBe('low');
    weekId = res.body.id;
  });

  test('rejects end before start, bad priority and missing name', async () => {
    const res = await request(app).post('/api/challenges').send({
      name: '',
      start_date: '2026-12-10',
      end_date: '2026-12-01',
      priority: 'urgent',
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['end_date', 'name', 'priority']);
  });

  test('rejects impossible dates', async () => {
    const res = await request(app).post('/api/challenges').send({
      name: 'Bad', start_date: '2026-02-30', end_date: '2026-03-05',
    });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('start_date');
  });

  test('logs are accepted inside the new challenge window', async () => {
    const res = await request(app).post('/api/logs/2026-12-03').send({ weight_kg: 70, extra_spent_inr: 120 });
    expect(res.status).toBe(200);
  });

  test('logs are still rejected outside every challenge', async () => {
    const res = await request(app).post('/api/logs/2026-12-20').send({ weight_kg: 70 });
    expect(res.status).toBe(400);
  });

  test('stats are scoped to the challenge', async () => {
    const overview = await request(app).get(`/api/stats/overview?challengeId=${weekId}`);
    expect(overview.body.totalDays).toBe(7);
    expect(overview.body.daysWithData).toEqual(['2026-12-03']);

    const spending = await request(app).get(`/api/stats/spending?challengeId=${weekId}`);
    expect(spending.body.totalSpent).toBe(120);
    expect(spending.body.budget).toBe(500);

    const review = await request(app).get(`/api/stats/final-review?challengeId=${weekId}`);
    expect(review.body.daysLogged).toBe(1);
    expect(review.body.totalDays).toBe(7);

    const logs = await request(app).get(`/api/logs?challengeId=${weekId}`);
    expect(logs.body.map(l => l.date)).toEqual(['2026-12-03']);
  });

  test('default stats still cover the original window', async () => {
    const overview = await request(app).get('/api/stats/overview');
    expect(overview.body.daysWithData).not.toContain('2026-12-03');
  });

  test('unknown challengeId → 404', async () => {
    const res = await request(app).get('/api/stats/overview?challengeId=9999');
    expect(res.status).toBe(404);
  });

  test('updates dates and priority', async () => {
    const res = await request(app).put(`/api/challenges/${weekId}`).send({ end_date: '2026-12-21', priority: 'high' });
    expect(res.status).toBe(200);
    expect(res.body.total_days).toBe(21);
    expect(res.body.priority).toBe('high');
    expect(res.body.name).toBe('7-Day Reset');
  });

  describe('notes', () => {
    let noteId;

    test('adds a note', async () => {
      const res = await request(app)
        .post(`/api/challenges/${weekId}/notes`)
        .send({ category: 'priority', content: '  Sleep by 11pm  ' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ category: 'priority', content: 'Sleep by 11pm', done: 0 });
      noteId = res.body.id;
    });

    test('rejects empty content and unknown category', async () => {
      const res = await request(app)
        .post(`/api/challenges/${weekId}/notes`)
        .send({ category: 'random', content: ' ' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toHaveProperty('content');
      expect(res.body.errors).toHaveProperty('category');
    });

    test('marks a note done and lists it', async () => {
      const upd = await request(app).put(`/api/challenges/${weekId}/notes/${noteId}`).send({ done: 1 });
      expect(upd.body.done).toBe(1);
      const list = await request(app).get(`/api/challenges/${weekId}/notes`);
      expect(list.body).toHaveLength(1);
      const all = await request(app).get('/api/challenges');
      expect(all.body.find(c => c.id === weekId).notes_count).toBe(1);
    });

    test('deletes a note', async () => {
      const res = await request(app).delete(`/api/challenges/${weekId}/notes/${noteId}`);
      expect(res.status).toBe(200);
      const again = await request(app).delete(`/api/challenges/${weekId}/notes/${noteId}`);
      expect(again.status).toBe(404);
    });
  });

  test('deleting a challenge keeps its daily logs', async () => {
    await request(app).post(`/api/challenges/${weekId}/notes`).send({ content: 'temp' });
    const res = await request(app).delete(`/api/challenges/${weekId}`);
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/challenges/${weekId}`)).status).toBe(404);
    expect((await request(app).get('/api/logs/2026-12-03')).status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Nutrition targets & macros
// ---------------------------------------------------------------------------
describe('Nutrition targets', () => {
  test('settings have default targets', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.body).toMatchObject({
      calorie_target_kcal: 2200,
      protein_target_g: 140,
      carbs_target_g: 220,
      fat_target_g: 70,
      fiber_target_g: 30,
      water_target_l: 3.5,
    });
  });

  test('targets can be updated', async () => {
    const res = await request(app).put('/api/settings').send({ calorie_target_kcal: 1900, protein_target_g: 160 });
    expect(res.status).toBe(200);
    expect(res.body.calorie_target_kcal).toBe(1900);
    expect(res.body.protein_target_g).toBe(160);
  });

  test('negative target fails', async () => {
    const res = await request(app).put('/api/settings').send({ fat_target_g: -5 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('fat_target_g');
  });

  test('daily log stores carbs, fat and fiber', async () => {
    const res = await request(app).post('/api/logs/2026-10-20').send({ carbs_g: 200, fat_g: 60.5, fiber_g: 25 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ carbs_g: 200, fat_g: 60.5, fiber_g: 25 });
  });

  test('negative macros fail validation', async () => {
    const res = await request(app).post('/api/logs/2026-10-20').send({ carbs_g: -1 });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('carbs_g');
  });
});

// ---------------------------------------------------------------------------
// Browser backup restore (server lost its data)
// ---------------------------------------------------------------------------
describe('Restore from a browser copy', () => {
  test('export carries the database instance id', async () => {
    const res = await request(app).get('/api/export/json');
    expect(typeof res.body.instanceId).toBe('string');
    expect(res.body.instanceId.length).toBeGreaterThan(10);
  });

  test('restore brings back deleted challenges, notes and logs', async () => {
    const created = await request(app).post('/api/challenges').send({
      name: 'Backup Test', start_date: '2027-01-01', end_date: '2027-01-21', priority: 'low',
    });
    expect(created.status).toBe(201);
    const id = created.body.id;
    await request(app).post(`/api/challenges/${id}/notes`).send({ content: 'remember me' });
    await request(app).post('/api/logs/2027-01-02').send({ weight_kg: 72 });

    const backup = (await request(app).get('/api/export/json')).body;
    await request(app).delete(`/api/challenges/${id}`); // also removes its notes

    const res = await request(app).post('/api/export/restore').send(backup);
    expect(res.status).toBe(200);
    expect(res.body.restored.challenges).toBe(1);

    const back = await request(app).get(`/api/challenges/${id}`);
    expect(back.status).toBe(200);
    expect(back.body.name).toBe('Backup Test');
    const notes = await request(app).get(`/api/challenges/${id}/notes`);
    expect(notes.body.map(n => n.content)).toContain('remember me');
    const log = await request(app).get('/api/logs/2027-01-02');
    expect(log.body.weight_kg).toBe(72);
  });

  test('an older copy never overwrites newer edits', async () => {
    const backup = (await request(app).get('/api/export/json')).body;
    const ch = backup.challenges.find(c => c.name === 'Backup Test');
    await new Promise(r => setTimeout(r, 5));
    await request(app).put(`/api/challenges/${ch.id}`).send({ ...ch, name: 'Renamed Later' });
    await request(app).post('/api/logs/2027-01-02').send({ weight_kg: 71 });

    const res = await request(app).post('/api/export/restore').send(backup);
    expect(res.status).toBe(200);
    expect((await request(app).get(`/api/challenges/${ch.id}`)).body.name).toBe('Renamed Later');
    expect((await request(app).get('/api/logs/2027-01-02')).body.weight_kg).toBe(71);
  });
});

// ---------------------------------------------------------------------------
// Cleanup: close DB after all tests
// ---------------------------------------------------------------------------
afterAll(() => {
  try {
    const db = require('../../src/db/database');
    db.close();
  } catch (e) {
    // ignore
  }
});
