/** Free keyless daily history fallback (US symbols only). Best effort: Stooq may change or throttle. */
import type { Bar } from "../indicators";

export async function getHistory(symbol: string, from: string): Promise<Bar[]> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase().replace(/\./g, "-"))}.us&i=d`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Stooq failed: HTTP ${res.status}`);
  const text = await res.text();
  if (!/^Date,Open,High,Low,Close/i.test(text)) throw new Error(`Stooq returned no data for ${symbol}`);
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((l) => l.split(","))
    .map(([day, o, h, lo, c, v]) => ({ day, open: +o, high: +h, low: +lo, close: +c, volume: Number(v) || 0 }))
    .filter((b) => b.day >= from && [b.open, b.high, b.low, b.close].every(Number.isFinite));
}
