/** Finnhub fallback/news source (free tier: 60 calls/min, personal use). */
import type { Headline, Quote } from "./fmp";

const BASE = "https://finnhub.io/api/v1";

export const finnhubEnabled = () => !!process.env.FINNHUB_API_KEY;

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set");
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "X-Finnhub-Token": key },
    signal: AbortSignal.timeout(15_000),
    next: { revalidate: 300 },
  } as RequestInit);
  if (!res.ok) throw new Error(`Finnhub ${path} failed: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function getQuote(symbol: string): Promise<Quote> {
  const [q, m] = await Promise.all([
    get<any>("/quote", { symbol }),
    get<any>("/stock/metric", { symbol, metric: "all" }).catch(() => null),
  ]);
  // Finnhub answers unknown symbols with all zeros
  if (!q || !q.c || !q.pc) throw new Error(`No quote data for ${symbol}`);
  return {
    symbol,
    price: q.c,
    previousClose: q.pc,
    yearHigh: Number(m?.metric?.["52WeekHigh"]) || q.c,
    yearLow: Number(m?.metric?.["52WeekLow"]) || q.c,
    asOf: new Date((q.t || Date.now() / 1000) * 1000).toISOString().slice(0, 10),
  };
}

export async function getEarningsDates(from: string, to: string): Promise<Map<string, string>> {
  const r = await get<any>("/calendar/earnings", { from, to });
  const out = new Map<string, string>();
  for (const e of r?.earningsCalendar ?? []) {
    if (!e?.symbol || !e?.date) continue;
    const prev = out.get(e.symbol);
    if (!prev || e.date < prev) out.set(e.symbol, e.date);
  }
  return out;
}

export async function getHeadlines(symbol: string, limit = 3): Promise<Headline[]> {
  const day = 86_400_000;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const rows = await get<any[]>("/company-news", { symbol, from: iso(Date.now() - 3 * day), to: iso(Date.now()) });
  const seen = new Set<string>();
  return (rows ?? [])
    .filter((r) => r?.headline && !seen.has(r.headline) && seen.add(r.headline))
    .sort((a, b) => b.datetime - a.datetime)
    .slice(0, limit)
    .map((r) => ({
      title: String(r.headline),
      date: new Date(r.datetime * 1000).toISOString().slice(0, 10),
      publisher: String(r.source ?? "unknown"),
    }));
}
