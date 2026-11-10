# DayBreak ☀

**A calm, self-hosted morning brief and stock analysis tool for US equities.**

DayBreak watches your US stock list overnight and sends a short morning note only when something actually happened—a big daily move, upcoming earnings, or a custom watch price crossed. When a stock moves, it explains *why* by comparing the move against the broader US market (`SPY`), its sector ETF (`XLK`, `XLF`, etc.), trading volume, and real news headlines.

> **Information only, not financial advice.** DayBreak is an opinionated personal tool for US stocks. Every number is computed deterministically in code; the AI only words a verified fact sheet.

---

## Screenshots

| Today & Morning Brief | Stock Analysis & Signal Backtest |
| :---: | :---: |
| ![Today dashboard](docs/screenshots/today.png) | ![Stock analysis page](docs/screenshots/stock.png) |

| Paper Ideas Scorecard | Mobile View |
| :---: | :---: |
| ![Paper ideas scorecard](docs/screenshots/paper.png) | ![Mobile view](docs/screenshots/mobile.png) |

---

## Key Features

- **Calm Morning Brief (Web + Email)**: Runs on a schedule after the US market close. If nothing on your watchlist moved beyond your threshold (default `±3%`), has earnings within 7 days, or crossed a custom watch price, it sends a single quiet line—no AI call wasted.
- **Strict AI Guardrails (`src/lib/guard.ts`)**: Numbers come from code, never from the AI. Gemini receives a plain-text fact sheet and returns JSON. `validateBrief()` rejects any output containing a number not in the fact sheet, any buy/sell/recommendation wording, or any price prediction. If the AI breaks a rule twice, DayBreak falls back to a deterministic template (`src/lib/summarize.ts`).
- **"Why Did It Move?" Explainer (`src/lib/explain.ts`)**: Compares 1D / 1W / 1M returns against `SPY` and the stock's SPDR Sector ETF (`XLK`, `XLF`, `XLV`, `XLE`, etc.) to classify sessions as **Market-wide**, **Sector-wide**, **Company-specific**, or **Quiet**, paired with 20-day volume ratios and date-matched news headlines.
- **5-Year Interactive Chart & Technical Indicators (`src/lib/indicators.ts`)**: Pure TypeScript calculations for 20/50/200-day SMAs, Golden/Death crosses, Wilder's RSI(14), MACD(12,26,9), Bollinger Bands, 30-day annualized volatility, and max drawdown.
- **Transparent Signal Hints & Per-Stock Backtest (`src/lib/signal.ts`)**: Computes a `-100` to `+100` hint score (`Strong Sell` to `Strong Buy`) with every contributing factor and point weight visible, then replays that exact scoring rule across the stock's own stored history (20-day forward returns vs. random-day baseline) so you can see whether the signal actually worked on that stock in the past.
- **Fundamentals & Valuation Context (`src/lib/fundamentals.ts`)**: Displays Market Cap, P/E Ratio, EPS, Dividend Yield, and Beta (cached weekly in Postgres).
- **Custom Watch Price Levels**: Set optional low/high price levels on any stock to get alerted in your morning brief when price crosses your level.
- **Paper Ideas & Honest Scorecard (`src/lib/scorecard.ts`)**: Log pretend long/short ideas (linked to a morning alert or on your own) and track win rate and follow-through before risking real money.
- **Command Palette (`Ctrl+K` / `Cmd+K`)**: Jump directly to any US stock's analysis page, add tickers to your watchlist, trigger a brief, or switch between light and dark frosted-glass themes.

---

## How It Keeps the AI Honest

1. **Deterministic Data (`src/lib/market/`)**: Quotes, 5-year daily OHLCV bars, earnings dates, fundamentals, and headlines are fetched from **Financial Modeling Prep (FMP)**, **Finnhub**, and **Yahoo Finance** (with **Stooq** as a final fallback) and cached in Postgres.
2. **Code-Built Fact Sheet (`src/lib/facts.ts`)**: All percentages, 52-week range positions, volume ratios, and caution notes are calculated in TypeScript and serialized into a strict fact sheet.
3. **Zero-Trust Validation (`src/lib/guard.ts`)**: The LLM output is parsed with Zod and checked token-by-token. Any invented number, missing symbol, or advisory/predictive phrase (`"should"`, `"buy"`, `"will rise"`, `"undervalued"`, etc.) is rejected.

---

## Quick Preview (Zero Config, No Docker or API Keys Needed)

Want to explore the UI immediately with demo data? DayBreak includes an embedded Postgres dev runner:

```bash
npm install
npm run dev:db    # starts embedded Postgres on :5432 and seeds demo@daybreak.local / demo-password-123
```

Then in a second terminal:

```bash
SESSION_SECRET=demo-secret-at-least-32-characters-long npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with `demo@daybreak.local` / `demo-password-123`.

---

## Run Locally with Real Data

```bash
cp .env.example .env        # fill in your API keys (all free tiers work)
docker compose up -d db     # start Postgres 16
npm run migrate             # apply db/schema.sql
npm run create-user -- you@example.com 'a-password-of-12+-chars'
npm run dev                 # http://localhost:3000
npm run brief               # run the morning brief job once right now
```

### Environment Variables (`.env`)

| Variable | Description |
| :--- | :--- |
| `DATABASE_URL` | Postgres connection string (`postgres://daybreak:...@localhost:5432/daybreak`) |
| `SESSION_SECRET` | 32+ character secret for signing `HttpOnly` JWT session cookies |
| `FMP_API_KEY` | [Financial Modeling Prep](https://site.financialmodelingprep.com/) API key (free tier) |
| `FINNHUB_API_KEY` | [Finnhub](https://finnhub.io/) API key (free tier; fallback quotes, fundamentals & news headlines) |
| `GEMINI_API_KEY` | [Google Gemini](https://aistudio.google.com/) API key (free tier; words the morning brief) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | Optional SMTP settings (e.g., Resend, Postmark, Gmail) for morning emails |
| `BRIEF_CRON` & `BRIEF_TZ` | Cron schedule for the worker (default `0 7 * * 2-6` in `Asia/Dubai`, after US Mon–Fri close) |
| `MOVE_THRESHOLD_PCT` | Daily `%` move that triggers a jump/drop alert (default `3`) |
| `HEALTHCHECK_URL` | Optional [Healthchecks.io](https://healthchecks.io/) dead-man's switch URL |

---

## Self-Hosting (Docker Compose / Coolify)

DayBreak is designed to run on a single Ubuntu VPS via **Docker Compose** or **Coolify**:

```bash
docker compose up -d --build
docker compose exec web npm run create-user -- you@example.com 'a-password-of-12+-chars'
```

This starts three containers from a single build:
- `db` — Postgres 16 with persistent volume (`dbdata`)
- `web` — Next.js 15 server (runs idempotent `npm run migrate` automatically on startup)
- `worker` — `node-cron` scheduler for the daily brief and history sync

### Monitoring & Reliability
- **Failure Alert**: If any step of the morning job fails, `worker` emails `ADMIN_EMAIL` and pings `${HEALTHCHECK_URL}/fail`.
- **Dead-Man's Switch**: Pings `${HEALTHCHECK_URL}/start` and `${HEALTHCHECK_URL}` on completion so total server outages never go unnoticed.
- **Health Endpoint**: `GET /api/health` returns HTTP `200` if Postgres is healthy and a brief succeeded within the last 76 hours (or `503` otherwise, ready for UptimeRobot / Coolify healthchecks).

---

## Tech Stack & Commands

- **Framework**: Next.js 15 (App Router) + React 19, TypeScript
- **Database**: PostgreSQL (`postgres` driver, raw SQL, zero ORM overhead)
- **Styling**: Custom frosted-glass CSS with light/dark view transitions & SVG charts (`src/app/globals.css`)
- **Tests**: Vitest (`tests/`)

```bash
npm run dev         # start Next.js dev server
npm test            # run Vitest unit test suite
npm run typecheck   # run TypeScript compiler check
npm run build       # production Next.js build
npm run migrate     # apply idempotent db/schema.sql
npm run brief       # trigger the morning brief job immediately
```

---

## Disclaimer

DayBreak is for **informational and educational purposes only** and does **not** constitute financial, investment, trading, or legal advice. Signal scores, technical indicators, and backtests describe past price patterns only and cannot predict future market performance. Always do your own research and consult a qualified financial professional before making investment decisions.

## License

Released under the [MIT License](LICENSE).
