# 🌐 How to Deploy to Render (Free Cloud Access)

Deploying your **Epic Davinci Tracker** to **Render.com** lets you access your tracker from anywhere (office, home, on-the-go) via a single link saved in your phone or laptop browser.

---

## Step 1: Push Code to GitHub

1. Open your terminal in the project folder:
   ```bash
   cd /Users/karthiknandakumar/Documents/antigravity/epic-davinci
   ```
2. Initialize git (if not already done) and push to your GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial health tracker commit"
   ```
3. Create a **Private** or Public repository on [GitHub.com](https://github.com/new).
4. Run the GitHub instructions to link and push your repo:
   ```bash
   git remote add origin https://github.com/<your-username>/epic-davinci.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Create a free Turso database (keeps your data permanently)

Render's free plan **wipes its disk every time the app sleeps or redeploys** (after ~15 minutes
without visits). Without an external database, your challenges, notes and logs would reset and
deleted challenges would come back. Turso is a free hosted SQLite database that fixes this.

1. Sign up at **[turso.tech](https://turso.tech)** (free plan, no card needed).
2. Click **Create Database**. Name it `epic-davinci` and pick the location closest to your
   Render region (e.g. Singapore / Frankfurt / Oregon).
3. Open the database and copy its **URL**. It looks like
   `libsql://epic-davinci-<your-username>.turso.io`.
4. Click **Create Token** (read & write, no expiry) and copy the token.

---

## Step 3: Deploy on Render.com (100% Free)

1. Sign up for a free account at **[render.com](https://render.com)**.
2. In the Render Dashboard, click **New +** → **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your GitHub repository.
4. Fill in the deployment details:
   - **Name:** `epic-davinci-tracker`
   - **Region:** Nearest region (e.g. Singapore / Frankfurt / Oregon)
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Under **Environment Variables**, add:
   - `TURSO_DATABASE_URL` = the URL from Step 2
   - `TURSO_AUTH_TOKEN` = the token from Step 2
6. Click **Create Web Service**.

**Already deployed?** Open your service → **Environment** → add the two variables above → **Save**.
Also check **Settings → Build Command** is just `npm install` (the old
`npm rebuild better-sqlite3 …` step is no longer needed). Render redeploys automatically.

In the Render **Logs** you should see a line like:

```
DB:        Turso (libsql://epic-davinci-<your-username>.turso.io)
```

If it shows a file path instead, the variables aren't set.

Render will build your project in ~1-2 minutes and give you your live web app URL:
`https://epic-davinci-tracker.onrender.com`

---

## Step 4: Bookmark Your Web App Link

- **On your phone & laptop browser:** Bookmark `https://epic-davinci-tracker.onrender.com`.
- Now whenever you want to log your day, just tap your bookmark!

---

## 💡 Note on Render Free Tier Behavior

- **Sleep mode:** If you don't open the app for 15 minutes, Render puts the free service into sleep mode to save energy. When you open your link, it will take ~30-40 seconds for the first page load to wake up the server. Subsequent taps will be instant.
- **Copy saved in your browser:** Every change is also saved in the browser you use (localStorage).
  If Render wipes the server's data, the app puts that copy back automatically the next time you open
  it in the same browser — so your challenges survive even **without** Turso. The copy is per browser
  and per device: clearing site data deletes it, and a phone and laptop each keep their own copy.
  Turso (Step 2) is still the most reliable option, especially if you use several devices.
- **Data Persistence:** With Turso configured, all data lives in the Turso database and survives sleep, restarts and redeploys. Without it, data is lost whenever Render restarts the app. Exporting JSON from **Settings** now and then is still a good backup.
- **Running locally:** without the Turso variables, the app uses the local file `data/tracker.db`.
  To work against your Turso data from your laptop, set the same two variables before `npm start`.
