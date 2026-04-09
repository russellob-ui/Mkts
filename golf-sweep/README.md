# London Banter & Woody — Major Sweep 2026

Bloomberg-inspired golf sweepstake for 8 friends. Live scores from Slash Golf API via RapidAPI. Built for Masters 2026.

## Tech Stack

- **Next.js 15** (App Router, TypeScript)
- **Tailwind CSS** (dark mode, Augusta green theme)
- **Drizzle ORM** + PostgreSQL
- **Slash Golf API** via RapidAPI (live scores)

## Deploy to Railway

### 1. Create a new Railway project

Go to [railway.com](https://railway.com) and create a new project from this GitHub repo.

### 2. Add PostgreSQL

In your Railway project, click **+ New** → **Database** → **PostgreSQL**. This auto-provides `DATABASE_URL`.

### 3. Set Environment Variables

In your Railway service settings → **Variables**, add:

| Variable | Value | Notes |
|----------|-------|-------|
| `DATABASE_URL` | Auto-provided by Railway Postgres plugin | Already set if you added Postgres |
| `RAPIDAPI_KEY` | Your RapidAPI key for Slash Golf | Sign up at rapidapi.com, subscribe to "Live Golf Data" |
| `ADMIN_PASSCODE` | `claretjug` | Used to access /admin |
| `CRON_SECRET` | Generate a random 32-char string | Used to protect the poll endpoint |

Generate a CRON_SECRET:
```bash
openssl rand -hex 16
```

### 4. Deploy

Railway will automatically build and deploy. The build command runs `drizzle-kit push` to create DB tables, then `next build`.

### 5. First Boot — Auto Seed

On first visit, the app will:
1. Call Slash Golf `getSchedule(2026)` to find the Masters
2. Call `getLeaderboard` to get live scores
3. Create all 8 players, golfers, picks, and round 1 scores
4. If Slash Golf is unreachable, it creates an empty tournament shell (use /admin paste fallback)

### 6. Set Up Score Polling (CRITICAL)

The poll endpoint fetches live scores from Slash Golf for tournaments with status `live`.

**Option A: Railway Cron (preferred)**

In your Railway service, go to **Settings** → **Cron** and add:

- Schedule: `* * * * *` (every minute)
- Command: `curl -H "x-cron-secret: YOUR_CRON_SECRET" https://YOUR-APP.up.railway.app/api/cron/poll-scores`

**Option B: cron-job.org (free)**

1. Go to [cron-job.org](https://cron-job.org) and create a free account
2. Create a new cron job:
   - URL: `https://YOUR-APP.up.railway.app/api/cron/poll-scores`
   - Schedule: Every 1 minute
   - Request method: GET
   - Add header: `x-cron-secret: YOUR_CRON_SECRET`
3. Enable only when tournament is live (to stay within API rate limits)

**Rate Limit Warning:** Slash Golf Pro tier = 2,000 calls/month. At 1 call/min, a 4-day tournament = ~5,760 calls. Consider polling every 2-3 minutes, or only during play hours (UK: 6pm-midnight for Masters).

### 7. Using /admin

Go to `https://YOUR-APP.up.railway.app/admin` and enter the admin passcode (`claretjug`).

- **Poll Now** — manually trigger a score update (great for testing)
- **Paste Scores** — fallback if API is down. Paste leaderboard text in format: `T3 ABERG -3 6 -3`
- **Mark Round Complete** — triggers round bonuses (ROTD +5, BOR +2)
- **Mark Tournament Finished** — triggers finishing position points
- **Manual Override** — override any golfer's position/score

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, current tournament, sweep leader |
| `/leaderboard` | Live leaderboard sorted by position, auto-refreshes 30s |
| `/season` | Cumulative points across all 4 majors |
| `/player/[slug]` | Individual player page with round-by-round breakdown |
| `/admin` | Admin panel (passcode protected) |

## Points System

| Position | Points |
|----------|--------|
| Winner | 50 |
| 2nd | 30 |
| 3rd | 20 |
| T4-T5 | 15 |
| T6-T10 | 10 |
| T11-T20 | 6 |
| T21-T30 | 3 |
| Made cut outside T30 | 1 |
| MC/WD/DQ | 0 |

**Bonuses per round:**
- Round of the Day: +5 (best score among our 8, split on ties)
- Best of Round: +2 (leading among our 8 at end of round, split on ties)

## Players

| # | Player | Golfer | Odds |
|---|--------|--------|------|
| 1 | Ian | Scottie Scheffler | 11/2 |
| 2 | Matt Haigh | Jon Rahm | 10/1 |
| 3 | Paul | Rory McIlroy | 12/1 |
| 4 | John | Ludvig Aberg | 16/1 |
| 5 | James | Matt Fitzpatrick | 22/1 |
| 6 | Russell | Robert MacIntyre | 28/1 |
| 7 | Woody | Justin Rose | 30/1 |
| 8 | Stuart | Shane Lowry | 66/1 |

## Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env  # then fill in values

# Push schema to DB
npm run db:push

# Run dev server
npm run dev
```

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/leaderboard` | GET | None | Current tournament leaderboard (reads from DB) |
| `/api/season` | GET | None | Season standings |
| `/api/player?slug=X` | GET | None | Player details |
| `/api/seed` | POST | None | Seed DB on first boot |
| `/api/cron/poll-scores` | GET | `x-cron-secret` header | Poll Slash Golf for live scores |
| `/api/admin/paste-scores` | POST | `x-admin-passcode` header | Parse pasted leaderboard text |
| `/api/admin/override` | POST | `x-admin-passcode` header | Manual score override |
| `/api/admin/mark-round-complete` | POST | `x-admin-passcode` header | Calculate round bonuses |
| `/api/admin/mark-tournament-finished` | POST | `x-admin-passcode` header | Calculate finish points |
