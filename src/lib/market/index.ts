/**
 * One entry point for market data. FMP is primary; Finnhub covers symbols or endpoints
 * FMP's free plan refuses (HTTP 402) and provides headlines.
 */
import * as fmp from "./fmp";
import * as fh from "./finnhub";
import * as stooq from "./stooq";

export type { Fundamentals, Headline, Quote } from "./fmp";

export async function getQuote(symbol: string): Promise<fmp.Quote> {
  try {
    return await fmp.getQuote(symbol);
  } catch (e) {
    if (!fh.finnhubEnabled()) throw e;
    try {
      return await fh.getQuote(symbol);
    } catch (e2) {
      const a = e instanceof Error ? e.message : String(e);
      const b = e2 instanceof Error ? e2.message : String(e2);
      throw new Error(`${a}; Finnhub: ${b}`);
    }
  }
}

export async function getEarningsDates(from: string, to: string): Promise<Map<string, string>> {
  try {
    return await fmp.getEarningsDates(from, to);
  } catch (e) {
    if (!fh.finnhubEnabled()) throw e;
    return fh.getEarningsDates(from, to);
  }
}

/** Optional: never throws. Finnhub first (FMP news needs a paid plan), then FMP. */
export async function getHeadlines(symbol: string, limit = 3, daysBack = 3): Promise<fmp.Headline[]> {
  if (fh.finnhubEnabled()) {
    try {
      const h = await fh.getHeadlines(symbol, limit, daysBack);
      if (h.length) return h;
    } catch {}
  }
  return fmp.getHeadlines(symbol, limit);
}

/** Daily bars, oldest first. FMP first, then keyless Stooq. */
export async function getHistory(symbol: string, from: string): Promise<import("../indicators").Bar[]> {
  try {
    const bars = await fmp.getHistory(symbol, from);
    if (bars.length) return bars;
    throw new Error(`FMP returned no history for ${symbol}`);
  } catch (e) {
    try {
      return await stooq.getHistory(symbol, from);
    } catch (e2) {
      const a = e instanceof Error ? e.message : String(e);
      const b = e2 instanceof Error ? e2.message : String(e2);
      throw new Error(`${a}; Stooq: ${b}`);
    }
  }
}

/** Company profile and valuation metrics. Merges FMP and Finnhub when available. */
export async function getFundamentals(symbol: string): Promise<fmp.Fundamentals | null> {
  let a: fmp.Fundamentals | null = null;
  try {
    a = await fmp.getFundamentals(symbol);
  } catch {}
  if (fh.finnhubEnabled()) {
    try {
      const b = await fh.getFundamentals(symbol);
      if (!a) return b;
      return {
        symbol: a.symbol,
        name: a.name ?? b.name,
        sector: a.sector ?? b.sector,
        marketCap: a.marketCap ?? b.marketCap,
        pe: a.pe ?? b.pe,
        eps: a.eps ?? b.eps,
        dividendYield: a.dividendYield ?? b.dividendYield,
        beta: a.beta ?? b.beta,
      };
    } catch {}
  }
  return a;
}
