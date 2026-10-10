# Epic Davinci — 21-Day Health & Lifestyle Tracker

A personal, production-quality web application to track your 21-day health challenge.

**Challenge Period:** October 12, 2026 – November 1, 2026  
**Final Review:** November 2, 2026

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)

### Installation

```bash
# Clone or download the project, then:
cd epic-davinci
npm install
```

### Start the application

```bash
npm start
```

The server starts on port **3000**. You'll see output like:

```
🚀 Epic Davinci Tracker running at:
   Local:   http://localhost:3000
   Network: http://192.168.1.x:3000
```

Open **http://localhost:3000** in your browser.

---

## Accessing from Your Mobile Device

When your phone and laptop are on the **same Wi-Fi network**:

1. Find your laptop's local IP address:
   - **macOS:** System Preferences → Network, or run `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - **Windows:** Run `ipconfig`, look for "IPv4 Address"
   - **Linux:** Run `ip addr show` or `hostname -I`
2. The IP is also printed when the server starts (see "Network:" line above).
3. On your phone, open: `http://192.168.1.x:3000` (replace with your actual IP).

> **Privacy note:** Any device on your Wi-Fi can access the app while the server is running. The app is not exposed to the internet. No authentication is required — this is a single-user local application. Stop the server when not in use if you share your network.

---

## Features

### 10 Tracked Life Aspects
1. **Fitness** — weight, workouts, cardio, steps, plank
2. **Nutrition & Hydration** — calories, protein, water, meal planning
3. **Sleep** — bedtime, wake time, auto-calculated duration (midnight-aware)
4. **Career (AI/ML & DSA)** — topics, practical work, study hours
5. **Oral, Skin & Hair Care** — brushing, skincare, hair care (with "not scheduled" state)
6. **Spirituality** — Hanuman Chalisa
7. **Mental Discipline** — private habit tracking, pranayama
8. **Personal Growth** — podcasts, communication, planning
9. **Personal Care & Routine** — bed, hygiene, room reset, stockings
10. **Financial Discipline** — ₹1,500 challenge budget tracking

### Plus
- **Daily Reflection** — best thing, obstacles, improvements
- **Daily Planning** — tomorrow's top 3 priorities

### Application Sections
- **Dashboard** — today's overview, progress, key metrics
- **Daily Log** — full data entry for any challenge date
- **Calendar** — visual overview of all 21 days
- **Trends** — charts for weight, steps, protein, water, sleep, study
- **Final Review** — November 2 summary with all statistics
- **Settings** — waist measurements, budget, export/backup

---

## Data Storage

All data is stored locally in a SQLite database:

```
epic-davinci/data/tracker.db
```

**Backup:**
```bash
cp data/tracker.db data/tracker.db.backup-$(date +%Y%m%d)
```

**Restore:**
```bash
# Stop the server first
cp data/tracker.db.backup-YYYYMMDD data/tracker.db
# Restart the server
```

---

## Export & Restore

### Export all data
- Click **Export JSON** or **Export CSV** in the Settings page, or:
```bash
curl http://localhost:3000/api/export/json -o challenge-backup.json
curl http://localhost:3000/api/export/csv -o challenge-data.csv
```

The JSON export includes all daily records, all field values (including nulls for unanswered fields), and challenge settings.

### Restore from JSON
The safest restore method is to copy back the `tracker.db` file (see Backup above).

---

## Running Tests

```bash
npm test
```

Tests cover:
- Date utilities (challenge day calculation, sleep duration across midnight)
- Input validation (all field types and boundaries)
- API endpoints (create, read, update, persistence, duplicates)
- Sleep duration calculations
- Spending totals and budget
- Final review statistics
- Export functionality

---

## Project Structure

```
epic-davinci/
├── src/
│   ├── server.js           # Express app entry point
│   ├── db/
│   │   ├── database.js     # SQLite connection
│   │   └── schema.js       # Table definitions
│   ├── routes/
│   │   ├── logs.js         # /api/logs endpoints
│   │   ├── stats.js        # /api/stats endpoints
│   │   ├── settings.js     # /api/settings endpoints
│   │   └── export.js       # /api/export endpoints
│   └── utils/
│       ├── dateUtils.js    # Date/time helpers
│       └── validation.js   # Input validation
├── public/
│   ├── index.html          # SPA shell
│   ├── css/
│   │   └── main.css        # Complete design system
│   ├── js/
│   │   ├── app.js          # Router & bootstrap
│   │   ├── utils.js        # Shared frontend utilities
│   │   └── pages/
│   │       ├── dashboard.js
│   │       ├── dailyLog.js
│   │       ├── calendar.js
│   │       ├── trends.js
│   │       ├── finalReview.js
│   │       └── settings.js
│   └── img/
│       └── favicon.svg
├── tests/
│   ├── unit/
│   │   ├── dateUtils.test.js
│   │   └── validation.test.js
│   └── integration/
│       └── api.test.js
├── data/
│   └── tracker.db          # Created automatically on first run
├── jest.config.js
├── package.json
└── README.md
```

---

## Database Schema

The primary table `daily_logs` stores one row per challenge date with a UNIQUE constraint on `date`. All habit fields default to NULL (unanswered) — they are never automatically set to 0 or false.

Key design decisions:
- `NULL` = not yet answered (different from explicitly answered No/0)
- `hair_care`: 0=Not completed, 1=Completed, 2=Not scheduled
- Binary (Yes/No) fields: 1=Yes, 0=No, NULL=not set
- Sleep duration calculated server-side from bedtime + wake_time; supports midnight crossing
- Spending totals calculated from all saved records — missing days are not counted as ₹0

---

## Privacy & Security

- All data stays on your machine
- No external API calls, no analytics, no cloud sync
- Sensitive reflection text is stored only in your local SQLite database
- User-entered text is rendered safely (textContent, not innerHTML)
- The app does not require or implement user authentication
- LAN access means anyone on your Wi-Fi can reach the app — stop the server when sharing networks

---

## Troubleshooting

**"Cannot connect to server"** — Make sure `npm start` is running.

**Port 3000 in use** — Set a different port: `PORT=3001 npm start`

**Mobile can't connect** — Check that both devices are on the same Wi-Fi. Check firewall settings on your laptop.

**Database issues** — The database is created automatically at `data/tracker.db`. If it becomes corrupted, restore from a backup.
