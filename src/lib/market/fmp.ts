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

export type Headline = { title: string; date: string; publisher: string; url?: string };

export type Fundamentals = {
  symbol: string;
  name: string | null;
  sector: string | null;
  marketCap: number | null;
  pe: number | null;
  eps: number | null;
  dividendYield: number | null;
  beta: number | null;
};

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
        ...(typeof r.url === "string" && /^https?:\/\//i.test(r.url) ? { url: r.url } : {}),
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

const numOrNull = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Company profile & valuation fundamentals from FMP. */
export async function getFundamentals(symbol: string): Promise<Fundamentals> {
  const [profRows, quoteRows] = await Promise.all([
    get<any[]>("/profile", { symbol }).catch(() => []),
    get<any[]>("/quote", { symbol }).catch(() => []),
  ]);
  const p = profRows?.[0] ?? {};
  const q = quoteRows?.[0] ?? {};
  if (!p.symbol && !q.symbol) throw new Error(`No fundamentals for ${symbol}`);
  const price = numOrNull(p.price) ?? numOrNull(q.price);
  const lastDiv = numOrNull(p.lastDividend ?? p.lastDiv);
  const divYield = lastDiv !== null && price && price > 0 ? (lastDiv / price) * 100 : null;
  return {
    symbol: symbol.toUpperCase(),
    name: typeof (p.companyName ?? q.name) === "string" ? String(p.companyName ?? q.name) : null,
    sector: typeof p.sector === "string" && p.sector.trim() ? p.sector.trim() : null,
    marketCap: numOrNull(p.marketCap ?? p.mktCap ?? q.marketCap),
    pe: numOrNull(q.pe ?? p.pe),
    eps: numOrNull(q.eps ?? p.eps),
    dividendYield: divYield,
    beta: numOrNull(p.beta),
  };
}
