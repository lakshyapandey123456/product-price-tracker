# INE Product Price Tracker (Web Scraping Assignment)

Full-stack application that tracks product prices and stock availability over time from INE's mock storefront (`https://demo.inelabteamdev.com`).

## Tech Stack
- **Frontend**: React (Vite)
- **Backend**: Node.js (Express)
- **Database**: Supabase (PostgreSQL)
- **Scraper**: Playwright (Headless for automated runs, Headed for observation demo)
- **Scheduler**: `cron-job.org` triggering `/api/scrape/cron` every 2 hours

---

## 🚀 Quick Start (Local Run)

### 1. Database (Optional for quick local test)
If you have a Supabase project:
1. Copy the SQL in `database/schema.sql` and run it in your Supabase SQL Editor.
2. Copy your Project URL and anon/service_role key.
*(Note: If no Supabase credentials are provided, the backend automatically runs in memory mode for local testing).*

### 2. Backend Setup
```bash
cd backend
npm install
npx playwright install chromium

# (Optional) Set your Supabase credentials in a .env file:
# cp .env.example .env

npm start
```
Backend will run at `http://localhost:4000`.

### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
Frontend will run at `http://localhost:3000`. Open it in your browser!

---

## 🎥 Observable (Headed) Scraper Demo
To record your headed scraper run for the assignment submission (showing how the scraper navigates, simulates hover, handles delays, and reveals the price):

```bash
cd backend
npm run scrape:headed
# Or scrape a specific product ID:
node run-headed.js 46
```

A visible Chromium browser window will open, move the mouse over the price area, wait for dwell verification, click **Reveal price**, and log the output.

---

## ⏰ Scheduling (Every 2 Hours via cron-job.org)
Because free-tier cloud backends (like Render) sleep when idle:
1. Deploy the backend to Render.
2. Go to [cron-job.org](https://cron-job.org) (free).
3. Create a cron job pointing to:
   ```text
   GET https://<your-render-app>.onrender.com/api/scrape/cron?secret=ine-secret-scrape-key
   ```
4. Set execution schedule to **Every 2 hours**.
