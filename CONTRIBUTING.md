# Contributing to DayBreak

Thanks for your interest in contributing to DayBreak!

DayBreak is a calm, self-hosted morning brief and analysis tool for US stocks. To keep the project fast, honest, and easy to self-host, please review the guidelines below before opening a pull request.

## Core Principles

1. **Numbers come from code, never from the AI**
   Every price, percentage, technical indicator, and signal score must be calculated deterministically in TypeScript (`src/lib/`). The AI only words a verified fact sheet (`src/lib/facts.ts`), and `src/lib/guard.ts` rejects any output with invented numbers, missing symbols, or advisory/predictive phrasing. Never weaken or bypass the guard without a clear, well-tested reason.

2. **Calm information, not hype or certainty**
   DayBreak gives context and backtested hints (`Strong Buy` to `Strong Sell`), never predictions or financial advice. Keep copy clear, plain-English, and free of jargon.

3. **Respect free API tiers**
   Most self-hosters run DayBreak on free plans (FMP, Finnhub, Gemini, Yahoo Finance). Always cache and reuse data in Postgres (`prices`, `price_sync`, `fundamentals`) rather than refetching on every request.

4. **Keep the stack lean**
   DayBreak intentionally avoids heavy UI frameworks, charting libraries, and ORMs. We use Next.js App Router, raw parameterized SQL via `postgres`, hand-crafted SVG charts, and `src/app/globals.css`.

## Quick Local Setup (No Docker or API Keys Required)

You can run DayBreak locally with seeded demo data in under a minute using the embedded Postgres runner:

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/DayBreak.git
   cd DayBreak
   npm install
   ```

2. Start the embedded development database in one terminal:
   ```bash
   npm run dev:db
   ```
   This starts a local Postgres instance in `.devdb/` on port `5432`, runs `db/schema.sql`, and creates a demo account (`demo@daybreak.local` / `demo-password-123`).

3. Start the Next.js dev server in a second terminal:
   ```bash
   SESSION_SECRET=demo-secret-at-least-32-characters-long npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and sign in with `demo@daybreak.local` / `demo-password-123`.

## Where Contributions Are Welcome

- **Market data adapters (`src/lib/market/`)**: Optional fallback providers for quotes, history, fundamentals, or news (e.g. Tiingo, Polygon/Massive, Alpha Vantage, Twelve Data).
- **Notification channels (`src/lib/mail.ts`)**: Optional delivery methods alongside SMTP email (e.g. Telegram, Discord, Slack, or Ntfy webhooks).
- **Indicators, explainers, and backtesting (`src/lib/indicators.ts`, `src/lib/explain.ts`, `src/lib/signal.ts`)**: Pure, deterministic math with unit tests in `tests/`.
- **UI and mobile improvements (`src/app/`)**: Accessibility, responsive layout fixes, and light/dark theme polish.

If you plan to work on a large change, open an issue first so we can discuss the design.

## Pull Request Checklist

Before submitting a PR, make sure all of the following pass:

```bash
npm run typecheck
npm test
npm run build
```

A few technical details to keep in mind:
- **Database migrations**: The `web` container runs `npm run migrate` on startup. Any schema change in `db/schema.sql` must be idempotent (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`).
- **UTF-8 encoding**: Save all source files as UTF-8 without BOM (non-UTF-8 files break `next build`).
- **Lockfile compatibility**: The production Dockerfile uses `node:22-slim` (npm 10). If you add or update a package in `package.json`, regenerate `package-lock.json` using npm 10 (`npx npm@10 install --package-lock-only`) so `npm ci` succeeds in Docker.
- **Tests**: Add or update unit tests in `tests/` for any new indicator, signal factor, explainer rule, or guard change.
