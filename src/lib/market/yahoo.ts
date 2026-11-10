/** Free keyless daily history fallback from Yahoo Finance (v8 chart API, US symbols). */
import type { Bar } from "../indicators";

export async function getHistory(symbol: string, from: string): Promise<Bar[]> {
  const yhSym = symbol.toUpperCase().replace(/\./g, "-");
  const period1 = Math.max(0, Math.floor(Date.parse(from) / 1000) - 86_400);
  const period2 = Math.floor(Date.now() / 1000) + 86_400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yhSym)}?period1=${period1}&period2=${period2}&interval=1d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DayBreak/1.0)" },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 3600 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Yahoo failed: HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const result = data?.chart?.result?.[0];
  const timestamps: number[] | undefined = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!Array.isArray(timestamps) || !quote) throw new Error(`Yahoo returned no history for ${symbol}`);

  const byDay = new Map<string, Bar>();
  for (let i = 0; i < timestamps.length; i++) {
    const day = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = Number(quote.volume?.[i]) || 0;
    if (day >= from && [open, high, low, close].every((n) => typeof n === "number" && Number.isFinite(n))) {
      byDay.set(day, { day, open, high, low, close, volume });
    }
  }
  const bars = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  if (!bars.length) throw new Error(`Yahoo returned no bars for ${symbol}`);
  return bars;
}
