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
