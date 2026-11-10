import { sql } from "./db";
import { getEarningsDates, getHeadlines, getQuote, type Quote } from "./market";
import { buildFact, type StockFact } from "./facts";
import { loadBars } from "./history";
import { volumeRatio } from "./indicators";
import { summarize } from "./summarize";

export type BriefBody = {
  greeting: string;
  stocks: { symbol: string; whatHappened: string; whyItMayMatter: string; caution: string; changePct: number }[];
  quietSymbols: string[];
  notes: string[];
};

export const QUIET_LINE = "Quiet night: nothing on your watchlist moved much and no earnings are close. Enjoy your day.";

export function dateIn(tz: string, d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);
}

export async function generateBrief(userId: number): Promise<{ id: number; headline: string; body: BriefBody; briefDate: string }> {
  const [user] = await sql`SELECT timezone FROM users WHERE id = ${userId}`;
  if (!user) throw new Error(`User ${userId} not found`);
  const today = dateIn(user.timezone);
  const threshold = Number(process.env.MOVE_THRESHOLD_PCT ?? 3);
  const symbols: string[] = (await sql`SELECT symbol FROM watchlist WHERE user_id = ${userId} ORDER BY symbol`).map((r) => r.symbol);
  const notes: string[] = [];

  let facts: StockFact[] = [];
  if (symbols.length > 0) {
    const [results, spyQuote] = await Promise.all([
      Promise.allSettled(symbols.map((s) => getQuote(s))),
      getQuote("SPY").catch(() => null),
    ]);
    const spyChangePct =
      spyQuote && spyQuote.previousClose > 0
        ? ((spyQuote.price - spyQuote.previousClose) / spyQuote.previousClose) * 100
        : null;
    const quotes: Quote[] = [];
    results.forEach((r, i) => (r.status === "fulfilled" ? quotes.push(r.value) : notes.push(`Could not get data for ${symbols[i]}.`)));
    if (quotes.length === 0) throw new Error("No market data could be fetched for any watchlist symbol");

    let earnings = new Map<string, string>();
    try {
      const end = new Date(Date.parse(today) + 14 * 86_400_000).toISOString().slice(0, 10);
      earnings = await getEarningsDates(today, end);
    } catch {
      notes.push("Earnings dates were unavailable this morning.");
    }
    facts = await Promise.all(
      quotes.map(async (q) => {
        const f = buildFact(q, earnings.get(q.symbol) ?? null, today, threshold);
        f.spyChangePct = spyChangePct;
        const bars = await loadBars(q.symbol).catch(() => []);
        f.volumeRatio = volumeRatio(bars.map((b) => b.volume));
        return f;
      }),
    );
    const stale = facts.filter((f) => (Date.parse(today) - Date.parse(f.asOf)) / 86_400_000 > 4);
    if (stale.length) notes.push(`Prices for ${stale.map((f) => f.symbol).join(", ")} look out of date.`);
  }

  const flagged = facts.filter((f) => f.flags.length > 0);
  await Promise.all(flagged.map(async (f) => (f.headlines = await getHeadlines(f.symbol, 4))));

  let mode: "quiet" | "ai" | "template" = "quiet";
  let body: BriefBody;
  if (symbols.length === 0) {
    body = { greeting: "Your watchlist is empty. Add a few stocks and I will keep an eye on them.", stocks: [], quietSymbols: [], notes };
  } else if (flagged.length === 0) {
    body = { greeting: QUIET_LINE, stocks: [], quietSymbols: facts.map((f) => f.symbol), notes };
  } else {
    const s = await summarize(flagged);
    mode = s.mode;
    if (s.note) notes.push(s.note);
    const pct = new Map(flagged.map((f) => [f.symbol, f.changePct]));
    body = {
      greeting: s.output.greeting,
      stocks: s.output.stocks.map((x) => ({ ...x, symbol: x.symbol.toUpperCase(), changePct: pct.get(x.symbol.toUpperCase()) ?? 0 })),
      quietSymbols: facts.filter((f) => f.flags.length === 0).map((f) => f.symbol),
      notes,
    };
  }

  const status = flagged.length ? "alerts" : "quiet";
  const headline = flagged.length ? `${flagged.length} thing${flagged.length > 1 ? "s" : ""} to know: ${flagged.map((f) => f.symbol).join(", ")}` : QUIET_LINE;

  const id = await sql.begin(async (tx) => {
    const [row] = await tx`
      INSERT INTO briefs (user_id, brief_date, status, mode, headline, body, facts, email_sent)
      VALUES (${userId}, ${today}, ${status}, ${mode}, ${headline}, ${tx.json(body as any)}, ${tx.json(facts as any)}, false)
      ON CONFLICT (user_id, brief_date) DO UPDATE SET status = EXCLUDED.status, mode = EXCLUDED.mode, headline = EXCLUDED.headline,
        body = EXCLUDED.body, facts = EXCLUDED.facts, email_sent = false, created_at = now()
      RETURNING id`;
    // Replace alerts (only if no paper idea points at the old ones)
    await tx`DELETE FROM brief_alerts WHERE brief_id = ${row.id} AND id NOT IN (SELECT alert_id FROM paper_ideas WHERE alert_id IS NOT NULL)`;
    for (const f of flagged)
      for (const kind of f.flags)
        await tx`INSERT INTO brief_alerts (brief_id, user_id, symbol, kind, change_pct, price) VALUES (${row.id}, ${userId}, ${f.symbol}, ${kind}, ${f.changePct}, ${f.price})`;
    return row.id as number;
  });

  return { id, headline, body, briefDate: today };
}
