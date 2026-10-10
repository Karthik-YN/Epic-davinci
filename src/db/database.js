'use strict';

/**
 * database.js
 * Opens (or creates) the SQLite database and initializes schema.
 * DB_PATH can be overridden via env var for testing.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { initDb } = require('./schema');

// Allow test environments to override the DB path
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/tracker.db');

// Ensure the directory containing the DB file exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
initDb(db);

module.exports = db;
