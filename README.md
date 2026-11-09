# DayBreak ☀

A calm morning note on your stock watchlist. Real numbers from Financial Modeling Prep; Gemini only writes the words.

**Information only, not financial advice.** It never says buy or sell and never predicts.

## How it keeps the AI honest
1. Prices, changes, earnings dates and 52-week ranges come from the data API (`src/lib/market/fmp.ts`), and flags and caution hints are computed in code (`src/lib/facts.ts`).
2. Gemini receives a fact sheet and returns JSON (`src/lib/summarize.ts`).
3. A guard (`src/lib/guard.ts`) rejects any output that contains a number not in the sheet, advice or prediction wording, or missing or extra tickers. It retries once, then falls back to a plain template.
4. A quiet day produces a fixed one-line message with no AI call.

## Run locally
```
cp .env.example .env        # fill in keys (see comments inside)
docker compose up -d db     # or any Postgres; match DATABASE_URL
npm run migrate
npm run create-user -- you@example.com 'a-long-password'
npm run dev                 # http://localhost:3000
npm run brief               # run the morning job once, now
```

## Deploy on your Ubuntu server
```
docker compose up -d --build
docker compose run --rm web npm run create-user -- you@example.com 'a-long-password'
```
Three containers: `db` (Postgres), `web` (the site, bound to localhost:3000) and `worker` (the scheduler, 07:00 Asia/Dubai, Tue to Sat).
Put Caddy or nginx with HTTPS in front, then set `COOKIE_SECURE=true`. Back up the `dbdata` volume (`pg_dump` nightly).

## Monitoring (so a missed brief never goes unnoticed)
- **Failure alert**: if any step fails, the worker emails `ADMIN_EMAIL` and pings `/fail`.
- **Dead-man's switch**: set `HEALTHCHECK_URL` from a free healthchecks.io check (cron schedule `0 7 * * 2-6`, timezone Asia/Dubai, grace 2h). If the server or worker dies, no ping arrives and *they* alert you. This is the check that catches total outages.
- `GET /api/health` returns 503 if the database is down or there has been no successful run in 76 hours. Point UptimeRobot at it.
- The History page shows the last job runs.

## Why the Ubuntu server, not Vercel
A daily job plus a failure monitor and a database fit one box well and cost nothing extra. Vercel would need cron, a hosted database and an outside monitor. If you go multi-user later, the code is already user-scoped, and the web app can move to Vercel while the worker stays put.

## Before inviting others
Signup is off on purpose (users are created from the CLI). Before opening it you need to add the following:
- Sign-up and password reset.
- A per-user brief time and timezone.
- Terms and a privacy page.
- Check your data provider's licence permits redistribution.
- Rate limiting that survives restarts. The current login throttle is in memory.
