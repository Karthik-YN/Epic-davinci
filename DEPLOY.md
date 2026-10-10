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
   git commit -m "Initial 21-day health tracker commit"
   ```
3. Create a **Private** or Public repository on [GitHub.com](https://github.com/new).
4. Run the GitHub instructions to link and push your repo:
   ```bash
   git remote add origin https://github.com/<your-username>/epic-davinci.git
   git branch -M main
   git push -u origin main
   ```

---

## Step 2: Deploy on Render.com (100% Free)

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
5. Click **Create Web Service**.

Render will build your project in ~1-2 minutes and give you your live web app URL:
`https://epic-davinci-tracker.onrender.com`

---

## Step 3: Bookmark Your Web App Link

- **On your phone & laptop browser:** Bookmark `https://epic-davinci-tracker.onrender.com`.
- Now whenever you want to log your day, just tap your bookmark!

---

## 💡 Note on Render Free Tier Behavior

- **Sleep mode:** If you don't open the app for 15 minutes, Render puts the free service into sleep mode to save energy. When you open your link, it will take ~30-40 seconds for the first page load to wake up the server. Subsequent taps will be instant.
- **Data Persistence:** The local SQLite database (`data/tracker.db`) persists during normal app usage. To ensure your data survives server updates, use the **Export JSON** button in **Settings** periodically to keep a local download of your 21-day records.
