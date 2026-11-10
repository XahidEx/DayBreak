import { sql } from "./db";
import { getHistory } from "./market";
import type { Bar } from "./indicators";

const YEARS = 5;
const DAY = 86_400_000;

/** Fetch and store daily bars for a symbol. Skips the network if it synced in the last `maxAgeHours`. */
export async function syncHistory(symbol: string, maxAgeHours = 12): Promise<{ bars: number; fetched: boolean }> {
  const [meta] = await sql`SELECT synced_at FROM price_sync WHERE symbol = ${symbol}`;
  const [last] = await sql`SELECT max(day)::text AS day, count(*)::int AS n FROM prices WHERE symbol = ${symbol}`;
  if (meta && last.n > 0 && Date.now() - new Date(meta.synced_at).getTime() < maxAgeHours * 3_600_000)
    return { bars: last.n, fetched: false };

  // incremental: re-fetch a week of overlap to pick up corrections; full backfill the first time
  const from = last.day
    ? new Date(Date.parse(last.day) - 7 * DAY).toISOString().slice(0, 10)
    : new Date(Date.now() - YEARS * 365 * DAY).toISOString().slice(0, 10);
  const bars = await getHistory(symbol, from);
  if (!bars.length) throw new Error(`No history available for ${symbol}`);

  for (let i = 0; i < bars.length; i += 500) {
    const rows = bars.slice(i, i + 500).map((b) => ({ symbol, day: b.day, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }));
    await sql`INSERT INTO prices ${sql(rows)} ON CONFLICT (symbol, day) DO UPDATE SET open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low, close = EXCLUDED.close, volume = EXCLUDED.volume`;
  }
  await sql`INSERT INTO price_sync (symbol, source) VALUES (${symbol}, 'api') ON CONFLICT (symbol) DO UPDATE SET synced_at = now()`;
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM prices WHERE symbol = ${symbol}`;
  return { bars: n, fetched: true };
}

/** Stored bars, oldest first. */
export async function loadBars(symbol: string): Promise<Bar[]> {
  const rows = await sql`SELECT day::text AS day, open, high, low, close, volume FROM prices WHERE symbol = ${symbol} ORDER BY day`;
  return rows as unknown as Bar[];
}
