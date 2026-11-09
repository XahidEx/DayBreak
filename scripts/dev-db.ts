/**
 * Local-only dev database: a throwaway embedded Postgres plus demo data, so the UI
 * can be previewed without Docker or API keys.   npm run dev:db
 */
import EmbeddedPostgres from "embedded-postgres";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import postgres from "postgres";

const pg = new EmbeddedPostgres({ databaseDir: ".devdb", user: "daybreak", password: "daybreak", port: 5432, persistent: true });
const fresh = !(await import("node:fs")).existsSync(".devdb/PG_VERSION");
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase("daybreak");

const sql = postgres("postgres://daybreak:daybreak@localhost:5432/daybreak", { onnotice: () => {} });
await sql.unsafe(readFileSync("db/schema.sql", "utf8"));

const [{ n }] = await sql`SELECT count(*)::int AS n FROM users`;
if (n === 0) {
  const [u] = await sql`INSERT INTO users (email, password_hash) VALUES ('demo@daybreak.local', ${await bcrypt.hash("demo-password-123", 10)}) RETURNING id`;
  for (const s of ["AAPL", "NVDA", "TSLA", "MSFT", "KO"]) await sql`INSERT INTO watchlist (user_id, symbol) VALUES (${u.id}, ${s})`;
  const body = {
    greeting: "Good morning. Two of your stocks had news overnight, and the rest stayed calm.",
    stocks: [
      { symbol: "NVDA", changePct: 4.6, whatHappened: "NVDA rose +4.6% to $142.30 (previous close $136.05).", whyItMayMatter: "A headline from Reuters said the company announced a new chip. The data does not confirm this is the cause.", caution: "One big up day is not a trend, and sharp rises sometimes give back part of the gain." },
      { symbol: "TSLA", changePct: -3.4, whatHappened: "TSLA fell -3.4% to $241.10 (previous close $249.60). It reports earnings in 3 days.", whyItMayMatter: "The data does not show why it dropped.", caution: "Earnings are due in 3 days, and results often move a share price sharply in either direction." },
    ],
    quietSymbols: ["AAPL", "MSFT", "KO"],
    notes: [],
  };
  const [b] = await sql`INSERT INTO briefs (user_id, brief_date, status, mode, headline, body, facts, email_sent)
    VALUES (${u.id}, current_date, 'alerts', 'ai', '2 things to know: NVDA, TSLA', ${sql.json(body as any)}, ${sql.json([] as any)}, true) RETURNING id`;
  await sql`INSERT INTO briefs (user_id, brief_date, status, mode, headline, body, facts, email_sent)
    VALUES (${u.id}, current_date - 1, 'quiet', 'quiet', 'Quiet night: nothing on your watchlist moved much and no earnings are close. Enjoy your day.',
    ${sql.json({ greeting: "Quiet night: nothing on your watchlist moved much and no earnings are close. Enjoy your day.", stocks: [], quietSymbols: ["AAPL"], notes: [] } as any)}, ${sql.json([] as any)}, true)`;
  const [a] = await sql`INSERT INTO brief_alerts (brief_id, user_id, symbol, kind, change_pct, price) VALUES (${b.id}, ${u.id}, 'NVDA', 'jump', 4.6, 142.3) RETURNING id`;
  await sql`INSERT INTO paper_ideas (user_id, symbol, direction, entry_price, note, alert_id) VALUES (${u.id}, 'NVDA', 'long', 140, 'Chip news looked real', ${a.id})`;
  await sql`INSERT INTO job_runs (status, finished_at) VALUES ('ok', now())`;
  console.log("Seeded demo user: demo@daybreak.local / demo-password-123");
}
await sql.end();
console.log("Dev database ready on :5432 (Ctrl+C to stop)");
process.on("SIGINT", async () => { await pg.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
