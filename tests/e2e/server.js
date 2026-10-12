'use strict';

// Starts the app for the browser tests on a fresh local database.
// Turso variables are cleared so a test run can never touch real data.
const fs = require('fs');
const os = require('os');
const path = require('path');

delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbPath = path.join(os.tmpdir(), 'epic-davinci-e2e.db');
for (const suffix of ['', '-wal', '-shm']) {
  fs.rmSync(dbPath + suffix, { force: true });
}
process.env.DB_PATH = dbPath;

const app = require('../../src/server');
const port = Number(process.env.PORT) || 3210;
app.listen(port, () => console.log(`e2e server on :${port}, db ${dbPath}`));
