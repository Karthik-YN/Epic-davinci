'use strict';

/**
 * database.js
 * Opens the database and initializes the schema.
 *
 * - With TURSO_DATABASE_URL (+ TURSO_AUTH_TOKEN) set, data lives in a hosted Turso
 *   (libSQL) database, so it survives restarts on hosts with a temporary disk (Render free tier).
 * - Otherwise a local SQLite file is used: DB_PATH, or data/tracker.db by default.
 *
 * All helpers are async and take named parameters ({ start, end } for @start/@end).
 */

const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./schema');

const TURSO_URL = process.env.TURSO_DATABASE_URL;

// Allow test environments to override the DB path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/tracker.db');

let client;
if (TURSO_URL) {
  client = createClient({ url: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });
} else {
  // Ensure the directory containing the DB file exists
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  client = createClient({ url: `file:${DB_PATH}` });
}

/** libSQL rows are array-like; hand plain objects to callers. */
function toObject(row) {
  return row ? { ...row } : undefined;
}

const db = {
  /** Where the data is stored, for startup logging. */
  location: TURSO_URL ? `Turso (${TURSO_URL})` : DB_PATH,

  /** All matching rows as plain objects. */
  async all(sql, args = {}) {
    const rs = await client.execute({ sql, args });
    return rs.rows.map(toObject);
  },

  /** First matching row, or undefined. */
  async get(sql, args = {}) {
    const rs = await client.execute({ sql, args });
    return toObject(rs.rows[0]);
  },

  /** Run a write. Returns { changes, lastInsertRowid }. */
  async run(sql, args = {}) {
    const rs = await client.execute({ sql, args });
    return {
      changes: rs.rowsAffected,
      lastInsertRowid: rs.lastInsertRowid !== undefined ? Number(rs.lastInsertRowid) : undefined,
    };
  },

  /** Run several statements separated by semicolons (no parameters). */
  async exec(sql) {
    await client.executeMultiple(sql);
  },

  close() {
    client.close();
  },
};

async function setup() {
  if (!TURSO_URL) {
    await db.exec('PRAGMA journal_mode = WAL;');
  }
  await db.exec('PRAGMA foreign_keys = ON;');
  await initDb(db);
}

/** Resolves once the schema is ready; requests wait on this before touching the DB. */
db.ready = setup();

module.exports = db;
