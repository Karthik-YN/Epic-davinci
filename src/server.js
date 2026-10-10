'use strict';

/**
 * server.js
 * Express application entry point for the 21-Day Health & Lifestyle Tracker.
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');

// ---------------------------------------------------------------------------
// Ensure data/ directory exists before opening the database
// ---------------------------------------------------------------------------
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();

// CORS – allow LAN access from any origin
app.use(cors());

// Parse JSON request bodies (up to 1 MB)
app.use(express.json({ limit: '1mb' }));

// Serve static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/api/logs',     require('./routes/logs'));
app.use('/api/stats',    require('./routes/stats'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/export',   require('./routes/export'));

// Catch-all: serve index.html for client-side routing (SPA fallback)
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, '../public/index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message || err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

// Only listen when running directly (not when imported by tests)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Epic Davinci Tracker running on port ${PORT}`);
    console.log(`   Local:   http://localhost:${PORT}`);

    // Print all LAN IP addresses
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const iface of nets[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          console.log(`   Network: http://${iface.address}:${PORT}  (${name})`);
        }
      }
    }

    console.log(`\n   Challenge: 2026-10-12 → 2026-11-01`);
    console.log(`   DB:        ${process.env.DB_PATH || path.join(__dirname, '../data/tracker.db')}\n`);
  });
}

module.exports = app;
