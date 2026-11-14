# DayBreak ☀

**A calm, self-hosted morning brief and stock analysis tool for US equities.**

DayBreak watches your US stock list overnight and sends a short morning note only when something actually happened: a big daily move, upcoming earnings, or a custom watch price crossed. When a stock moves, it explains *why* by comparing the move against the broader US market (`SPY`), its sector ETF (`XLK`, `XLF`, etc.), trading volume, and real news headlines.

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

- **Calm Morning Brief (Web + Email)**: Runs on a schedule after the US market close. If nothing on your watchlist moved beyond your threshold (default `±3%`), has earnings within 7 days, or crossed a custom watch price, it sends a single quiet line with no AI call wasted.
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

### Sample Fact Sheet → Morning Note

Below is an actual fact sheet built by `factSheet()` (`src/lib/facts.ts`) for three alert types (`jump`, `drop` + `earnings_soon`, and `target_low`), followed by the morning note verified by `validateBrief()` (`src/lib/guard.ts`):

```text
Definitions: a big move is a daily change of the alert threshold or more. Earnings count as soon when within 7 days. The 52-week range is the lowest and highest price in the past year.
NVDA: price $142.30, previous close $136.04, change +4.6%, data as of 2026-11-13. US market (SPY) change +0.4% (+4.2% vs market). Volume 2.1x 20-day average. 52-week range $75.60 to $149.76 (5.0% below the high). Flags: jump. Headlines: "Nvidia unveils next-generation server rack shipments for Q4" (Reuters, 2026-11-13). Caution to convey: One big up day is not a trend, and sharp rises sometimes give back part of the gain.
TSLA: price $241.10, previous close $249.59, change -3.4%, data as of 2026-11-13. US market (SPY) change +0.4% (-3.8% vs market). Volume 1.6x 20-day average. 52-week range $138.80 to $271.00 (11.0% below the high). Flags: drop, earnings_soon. Earnings on 2026-11-17 (in 3 days). No headlines available. Caution to convey: Earnings are due in 3 days, and results often move a share price sharply in either direction.
KO: price $61.80, previous close $62.15, change -0.6%, data as of 2026-11-13. US market (SPY) change +0.4% (-1.0% vs market). Volume 0.9x 20-day average. 52-week range $57.93 to $73.53 (16.0% below the high). Flags: target_low. Price is at or below user's low watch level of $62.00. No headlines available. Caution to convey: Crossing below a target price does not mean a stock has stopped falling; check what changed before acting.
```

What you read at 7:00 AM (web & email):

> **Good morning. Three stocks on your watchlist triggered alerts overnight, while AAPL and MSFT had a quiet session.**
>
> - **NVDA (`+4.6%`)**
>   - **What happened:** NVDA rose `+4.6%` to `$142.30` from a previous close of `$136.04`, outpacing the US market (`SPY +0.4%`, `+4.2%` vs market) on heavy volume at `2.1x` its 20-day average.
>   - **Why it may matter:** A headline from Reuters said *"Nvidia unveils next-generation server rack shipments for Q4"*, though the data does not confirm this caused the move.
>   - **Be careful:** One big up day is not a trend, and sharp single-day gains sometimes give back part of the move.
> - **TSLA (`-3.4%`)**
>   - **What happened:** TSLA fell `-3.4%` to `$241.10` from `$249.59` while SPY rose `+0.4%` (`-3.8%` vs market) on `1.6x` average volume, with earnings scheduled for `2026-11-17` (in 3 days).
>   - **Why it may matter:** No headlines were returned for the session, so the data does not show what drove the drop.
>   - **Be careful:** Earnings are due in 3 days, and quarterly results often move the stock sharply in either direction.
> - **KO (`-0.6%`)**
>   - **What happened:** KO edged down `-0.6%` to `$61.80` from `$62.15` on `0.9x` average volume, crossing below your `$62.00` low watch level.
>   - **Why it may matter:** No company headlines accompanied the move; the data does not show a specific catalyst.
>   - **Be careful:** Crossing below a watch level does not mean a stock has stopped falling, so check what changed before acting.

---

### Sample Signal Breakdown & Per-Stock Backtest (`src/lib/signal.ts`)

Every stock page computes a transparent `-100` to `+100` hint score and immediately replays that exact rule across the stock's own 5-year history (`1,265` daily bars, `209` overlapping 20-trading-day windows) beside a random-day baseline—so you can see when a technical rule actually helped and when a dip-buying bull trend made `"Sell"` signals bounce back:

**Factor weights (`MSFT` snapshot — Score `+32 / ±100` → `Buy`):**

| Factor | Points | Why |
| :--- | :---: | :--- |
| Long-term trend | `+20 / 20` | 50-day average is above the 200-day average. |
| Price vs 200-day average | `+10 / 10` | Price is above its 200-day average. |
| Price vs 50-day average | `+10 / 10` | Price is above its 50-day average. |
| MACD momentum | `-15 / 15` | MACD is below its signal line. |
| 3-month momentum | `+7 / 15` | Price is up 9.1% over 3 months. |
| RSI extremes | `0 / 10` | RSI is in the normal range. |
| Bollinger bands | `0 / 5` | Inside the 20-day bands. |

**20-trading-day forward backtest vs. random-day baseline (`NVDA`, 209 samples over 5 years):**

| Signal Label | Occurrences | Avg 20-Day Forward Return | Win Rate (Up After 20d) |
| :--- | :---: | :---: | :---: |
| **Strong Buy** (`score ≥ +50`) | 80 times | `+7.0%` | `69%` |
| **Buy** (`+20` to `+49`) | 65 times | `+3.4%` | `65%` |
| **Neutral** (`-19` to `+19`) | 39 times | `+5.2%` | `72%` |
| **Sell** (`-49` to `-20`) | 18 times | `+12.9%` | `72%` |
| **Strong Sell** (`score ≤ -50`) | 7 times | `+1.2%` | `43%` |
| *Random-day baseline (any day)* | *209 samples* | *`+5.9%`* | *`67%`* |

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
- `db`: Postgres 16 with persistent volume (`dbdata`)
- `web`: Next.js 15 server (runs idempotent `npm run migrate` automatically on startup)
- `worker`: `node-cron` scheduler for the daily brief and history sync

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

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for local setup instructions and project guidelines before opening a pull request.

## Disclaimer

DayBreak is for **informational and educational purposes only** and does **not** constitute financial, investment, trading, or legal advice. Signal scores, technical indicators, and backtests describe past price patterns only and cannot predict future market performance. Always do your own research and consult a qualified financial professional before making investment decisions.

## License

Released under the [MIT License](LICENSE).
