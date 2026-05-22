# StudyLog — Setup Guide

## Files
- `index.html` — Main app
- `style.css` — Styles
- `app.js` — All app logic
- `supabase-config.js` — **Your Supabase credentials go here**
- `supabase-setup.sql` — Run this once in Supabase SQL editor

---

## Step 1 — Supabase (free, takes 2 min)

1. Go to https://supabase.com → Sign up → New Project
2. Wait for it to provision (~1 min)
3. Go to **SQL Editor** → New Query → paste contents of `supabase-setup.sql` → Run
4. Go to **Settings → API**:
   - Copy **Project URL**
   - Copy **anon / public** key
5. Open `supabase-config.js` and replace:
   ```js
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'eyJhbGci...your-anon-key...';
   ```

---

## Step 2 — Run Locally

Open `index.html` directly in Chrome/Edge/Firefox.

> **Tip:** Use VS Code + Live Server extension for best experience.  
> Right-click `index.html` → Open with Live Server

---

## Step 3 — Deploy to Vercel (optional, makes it accessible anywhere)

1. Push all 5 files to a GitHub repo
2. Go to https://vercel.com → New Project → Import repo
3. Deploy (no build settings needed — it's static)
4. In Supabase → Authentication → URL Configuration:
   - Add your Vercel URL (e.g. `https://my-studylog.vercel.app`) to **Redirect URLs**

---

## Features

| Feature | Description |
|---|---|
| 🔐 Auth | Login, signup, forgot password via Supabase |
| ⏱ Timer | Pomodoro (25/5/15 min) + custom duration |
| 📝 Log | Log sessions with subject, time, category, notes |
| 📚 Subjects | Create your own subject list, pick from dropdown |
| 📊 Dashboard | Weekly chart, top subjects, recent sessions |
| 📅 Weekly | Bar chart + category breakdown |
| 🗓 Monthly | Heatmap calendar — click a day to see sessions |
| ⬇ Export | Download all sessions as CSV |
| 🏅 Badges | 8 achievement badges auto-unlocked |
| ✏️ Edit | Edit any logged session |
| 👤 Profile | Name, daily goal, theme (dark/light/forest/ocean) |
| ☁️ Sync | All data in Supabase — access from any device |
