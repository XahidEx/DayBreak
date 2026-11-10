/**
 * Market data from Financial Modeling Prep (stable API).
 * Every number DayBreak shows or sends comes from here, never from the AI.
 */
const BASE = "https://financialmodelingprep.com/stable";

export type Quote = {
  symbol: string;
  price: number;
  previousClose: number;
  yearHigh: number;
  yearLow: number;
  /** ISO date (YYYY-MM-DD) of the latest price */
  asOf: string;
};

export type Headline = { title: string; date: string; publisher: string };

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP_API_KEY is not set");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("apikey", key);
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), next: { revalidate: 300 } } as RequestInit);
  if (!res.ok) throw new Error(`FMP ${path} failed: HTTP ${res.status}`);
  const json = (await res.json()) as T;
  // FMP reports some errors as 200 + {"Error Message": "..."}
  if (json && typeof json === "object" && !Array.isArray(json) && "Error Message" in json) {
    throw new Error(`FMP ${path}: ${(json as Record<string, string>)["Error Message"]}`);
  }
  return json;
}

export async function getQuote(symbol: string): Promise<Quote> {
  const rows = await get<any[]>("/quote", { symbol });
  const q = rows?.[0];
  if (!q || typeof q.price !== "number" || typeof q.previousClose !== "number") {
    throw new Error(`No quote data for ${symbol}`);
  }
  const ts = typeof q.timestamp === "number" ? new Date(q.timestamp * 1000) : new Date();
  return {
    symbol: String(q.symbol ?? symbol).toUpperCase(),
    price: q.price,
    previousClose: q.previousClose,
    yearHigh: Number(q.yearHigh) || q.price,
    yearLow: Number(q.yearLow) || q.price,
    asOf: ts.toISOString().slice(0, 10),
  };
}

/** Map of symbol -> next earnings date (YYYY-MM-DD) within [from, to]. */
export async function getEarningsDates(from: string, to: string): Promise<Map<string, string>> {
  const rows = await get<any[]>("/earnings-calendar", { from, to });
  const out = new Map<string, string>();
  for (const r of rows ?? []) {
    if (!r?.symbol || !r?.date) continue;
    const prev = out.get(r.symbol);
    if (!prev || r.date < prev) out.set(r.symbol, r.date);
  }
  return out;
}

/** Recent headlines. Optional: failures return an empty list. */
export async function getHeadlines(symbol: string, limit = 3): Promise<Headline[]> {
  try {
    const rows = await get<any[]>("/news/stock", { symbols: symbol, limit: String(limit) });
    return (rows ?? [])
      .filter((r) => r?.title)
      .slice(0, limit)
      .map((r) => ({
        title: String(r.title),
        date: String(r.publishedDate ?? "").slice(0, 10),
        publisher: String(r.publisher ?? r.site ?? "unknown"),
      }));
  } catch {
    return [];
  }
}

/** Daily OHLCV bars (oldest first) from `from` (YYYY-MM-DD) to today. */
export async function getHistory(symbol: string, from: string): Promise<import("../indicators").Bar[]> {
  const rows = await get<any[]>("/historical-price-eod/full", { symbol, from });
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.date && [r.open, r.high, r.low, r.close].every((n: unknown) => typeof n === "number"))
    .map((r) => ({ day: String(r.date).slice(0, 10), open: r.open, high: r.high, low: r.low, close: r.close, volume: Number(r.volume) || 0 }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
