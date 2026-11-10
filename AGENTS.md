# AGENTS.md

## Goal
DayBreak helps the owner invest more smartly in US stocks. It is a personal tool, not a product for others yet. It should:
- Send a calm morning brief on a watchlist.
- Explain why a stock moved (what happened) using real data and news.
- Show stock price history and technical indicators.
- Give hint-level signals (Strong Buy / Buy / Neutral / Sell / Strong Sell) with every factor visible and a backtest. They are hints, not certainty.

Roadmap order: history and indicators (done), "why is it down" explainer, signal score and backtest.

## Hosting
- Self-hosted on an **Ubuntu server via Coolify** (not Vercel), deployed from the `main` branch with `docker-compose.yml`.
- Three containers: `db` (Postgres), `web` (Next.js), `worker` (node-cron scheduler, 07:00 Asia/Dubai, Tue to Sat).
- The `web` container runs `npm run migrate` on start, so schema changes go in `db/schema.sql` and must be idempotent (`IF NOT EXISTS`).
- Secrets are Coolify env vars and build args; never commit `.env`.

## Stack
Next.js 15 (App Router) + React 19, TypeScript, Postgres (`postgres` lib), Gemini for text only, FMP + Finnhub (+ Stooq for history). All free plans, so respect rate limits: cache and store data rather than refetching.

## Rules
- **Numbers come from code, never from the AI.** The AI only words a fact sheet. `src/lib/guard.ts` rejects invented numbers and advice or prediction wording. If rating labels are added, update the guard deliberately and keep showing the reasons and a not-financial-advice note.
- US stocks only.
- The Docker image uses `node:22-slim` (npm 10). Regenerate `package-lock.json` with npm 10 (`npx npm@10 install --package-lock-only`), or `npm ci` fails on deploy.
- Write files as UTF-8 (a non-UTF-8 file breaks `next build`).

## Commands
`npm run dev` · `npm test` · `npm run typecheck` · `npm run build` · `npm run migrate` · `npm run brief` (run the morning job now)
Run typecheck, tests and build before committing.
