'use strict';

/**
 * tests/unit/validation.test.js
 * Unit tests for src/utils/validation.js
 */

const { validateDailyLog } = require('../../src/utils/validation');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const validBase = {
  date: '2026-10-12',
  weight_kg: 75,
  total_steps: 8000,
  calories_kcal: 2000,
  protein_g: 150,
  water_l: 3,
  cardio_duration_min: 30,
  plank_duration_sec: 60,
  pranayama_min: 10,
  career_study_min: 60,
  extra_spent_inr: 0,
  bedtime: '23:00',
  wake_time: '07:00',
  cardio_completed: 1,
  fruits_veggies: 1,
  junk_food: 0,
  within_calorie_target: 1,
  planned_meals_tomorrow: 1,
  brush_teeth: 1,
  tongue_scrape: 1,
  floss: 0,
  morning_skincare: 1,
  night_skincare: 1,
  hair_care: 1,
  hanuman_chalisa: 1,
  porn_free: 1,
  masturbation_free: 1,
  social_media_limit: 1,
  podcast: 0,
  communication: 1,
  planned_tomorrow: 1,
  bed_setup: 1,
  body_detox: 0,
  shower: 1,
  room_reset: 1,
  stockings: 0,
  plank_completed: 1,
  sleep_manual_override: 0,
};

// ---------------------------------------------------------------------------
// Valid cases
// ---------------------------------------------------------------------------
describe('validateDailyLog – valid cases', () => {
  test('complete valid log passes', () => {
    const { valid, errors } = validateDailyLog({ ...validBase });
    expect(valid).toBe(true);
    expect(errors).toEqual({});
  });

  test('empty optional fields pass (treated as null)', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12' });
    expect(valid).toBe(true);
  });

  test('missing optional fields entirely pass', () => {
    const { valid } = validateDailyLog({ date: '2026-10-15' });
    expect(valid).toBe(true);
  });

  test('null optional fields pass', () => {
    const { valid } = validateDailyLog({
      date: '2026-10-12',
      weight_kg: null,
      protein_g: null,
      bedtime: null,
    });
    expect(valid).toBe(true);
  });

  test('hair_care = 0 is valid', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', hair_care: 0 });
    expect(valid).toBe(true);
  });

  test('hair_care = 1 is valid', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', hair_care: 1 });
    expect(valid).toBe(true);
  });

  test('hair_care = 2 (not scheduled) is valid', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', hair_care: 2 });
    expect(valid).toBe(true);
  });

  test('water_l = 0 is valid', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', water_l: 0 });
    expect(valid).toBe(true);
  });

  test('extra_spent_inr = 0 is valid', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', extra_spent_inr: 0 });
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Weight validation
// ---------------------------------------------------------------------------
describe('validateDailyLog – weight_kg', () => {
  test('negative weight fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', weight_kg: -1 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('weight_kg');
  });

  test('zero weight fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', weight_kg: 0 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('weight_kg');
  });

  test('weight > 200 fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', weight_kg: 201 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('weight_kg');
  });

  test('weight exactly 200 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', weight_kg: 200 });
    expect(valid).toBe(true);
  });

  test('weight exactly 30 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', weight_kg: 30 });
    expect(valid).toBe(true);
  });

  test('weight 29.9 fails (below 30)', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', weight_kg: 29.9 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('weight_kg');
  });
});

// ---------------------------------------------------------------------------
// Steps validation
// ---------------------------------------------------------------------------
describe('validateDailyLog – total_steps', () => {
  test('negative steps fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', total_steps: -1 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('total_steps');
  });

  test('non-integer steps (float) fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', total_steps: 5000.5 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('total_steps');
  });

  test('zero steps passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', total_steps: 0 });
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Non-negative numeric fields
// ---------------------------------------------------------------------------
describe('validateDailyLog – non-negative fields', () => {
  test('negative water_l fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', water_l: -0.5 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('water_l');
  });

  test('negative protein_g fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', protein_g: -10 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('protein_g');
  });

  test('negative calories_kcal fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', calories_kcal: -100 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('calories_kcal');
  });

  test('negative extra_spent_inr fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', extra_spent_inr: -50 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('extra_spent_inr');
  });

  test('negative career_study_min fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', career_study_min: -30 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('career_study_min');
  });
});

// ---------------------------------------------------------------------------
// Time format validation
// ---------------------------------------------------------------------------
describe('validateDailyLog – bedtime/wake_time', () => {
  test('invalid bedtime format fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', bedtime: '11pm' });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('bedtime');
  });

  test('invalid wake_time format fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', wake_time: '7:00' });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('wake_time');
  });

  test('24:00 is invalid hour', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', bedtime: '24:00' });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('bedtime');
  });

  test('valid 23:59 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', bedtime: '23:59' });
    expect(valid).toBe(true);
  });

  test('valid 00:00 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', wake_time: '00:00' });
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Binary fields
// ---------------------------------------------------------------------------
describe('validateDailyLog – binary fields', () => {
  test('porn_free = 2 fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', porn_free: 2 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('porn_free');
  });

  test('cardio_completed = -1 fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', cardio_completed: -1 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('cardio_completed');
  });

  test('brush_teeth = 0 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', brush_teeth: 0 });
    expect(valid).toBe(true);
  });

  test('brush_teeth = 1 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', brush_teeth: 1 });
    expect(valid).toBe(true);
  });

  test('plank_completed = 0 passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-12', plank_completed: 0 });
    expect(valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// hair_care
// ---------------------------------------------------------------------------
describe('validateDailyLog – hair_care', () => {
  test('hair_care = 3 is invalid', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', hair_care: 3 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('hair_care');
  });

  test('hair_care = -1 is invalid', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-12', hair_care: -1 });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('hair_care');
  });
});

// ---------------------------------------------------------------------------
// date field
// ---------------------------------------------------------------------------
describe('validateDailyLog – date', () => {
  test('date outside challenge window fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-11-02' });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('date');
  });

  test('date before challenge start fails', () => {
    const { valid, errors } = validateDailyLog({ date: '2026-10-11' });
    expect(valid).toBe(false);
    expect(errors).toHaveProperty('date');
  });

  test('date within challenge passes', () => {
    const { valid } = validateDailyLog({ date: '2026-10-20' });
    expect(valid).toBe(true);
  });
});
