import { sql } from "./db";
import { getFundamentals, type Fundamentals } from "./market";

const SECTOR_MAP: { match: RegExp; etf: string; label: string }[] = [
  { match: /tech|software|semiconductor|hardware|electronic|internet|computer|it services/i, etf: "XLK", label: "Technology" },
  { match: /financ|bank|insur|capital|asset|credit|broker/i, etf: "XLF", label: "Financials" },
  { match: /health|pharma|biotech|medical|life science/i, etf: "XLV", label: "Health Care" },
  { match: /energy|oil|gas|petroleum/i, etf: "XLE", label: "Energy" },
  { match: /consumer defensive|staple|food|beverage|tobacco|household/i, etf: "XLP", label: "Consumer Staples" },
  { match: /consumer cyclical|discretionary|retail|auto|apparel|hotel|restaurant|leisure|e-commerce/i, etf: "XLY", label: "Consumer Discretionary" },
  { match: /industrial|aerospace|defense|machinery|transport|airline|building|construction/i, etf: "XLI", label: "Industrials" },
  { match: /communicat|media|telecom|entertainment|interactive/i, etf: "XLC", label: "Communication Services" },
  { match: /utilit|electric|water|power/i, etf: "XLU", label: "Utilities" },
  { match: /real estate|reit/i, etf: "XLRE", label: "Real Estate" },
  { match: /material|chemical|mining|metal|steel|paper|packaging/i, etf: "XLB", label: "Materials" },
];

/** Map a provider sector/industry string to its SPDR US Sector ETF. */
export function sectorEtfFor(sector: string | null | undefined): { etf: string; label: string } | null {
  if (!sector) return null;
  for (const s of SECTOR_MAP) {
    if (s.match.test(sector)) return { etf: s.etf, label: s.label };
  }
  return null;
}

/** Format market cap in plain B / T / M units. */
export function fmtMarketCap(n: number | null): string {
  if (n === null || !(n > 0)) return "n/a";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

/** Load or sync company fundamentals, cached in Postgres for `maxAgeDays` (default 7 days). */
export async function syncFundamentals(symbol: string, maxAgeDays = 7): Promise<Fundamentals | null> {
  const sym = symbol.toUpperCase();
  const [row] = await sql`
    SELECT symbol, name, sector, market_cap, pe, eps, div_yield, beta, updated_at
    FROM fundamentals WHERE symbol = ${sym}
  `.catch(() => []);

  if (row && Date.now() - new Date(row.updated_at).getTime() < maxAgeDays * 86_400_000) {
    return {
      symbol: row.symbol,
      name: row.name,
      sector: row.sector,
      marketCap: row.market_cap,
      pe: row.pe,
      eps: row.eps,
      dividendYield: row.div_yield,
      beta: row.beta,
    };
  }

  const fresh = await getFundamentals(sym).catch(() => null);
  if (!fresh) {
    return row
      ? {
          symbol: row.symbol,
          name: row.name,
          sector: row.sector,
          marketCap: row.market_cap,
          pe: row.pe,
          eps: row.eps,
          dividendYield: row.div_yield,
          beta: row.beta,
        }
      : null;
  }

  await sql`
    INSERT INTO fundamentals (symbol, name, sector, market_cap, pe, eps, div_yield, beta, updated_at)
    VALUES (${sym}, ${fresh.name}, ${fresh.sector}, ${fresh.marketCap}, ${fresh.pe}, ${fresh.eps}, ${fresh.dividendYield}, ${fresh.beta}, now())
    ON CONFLICT (symbol) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, fundamentals.name),
      sector = COALESCE(EXCLUDED.sector, fundamentals.sector),
      market_cap = COALESCE(EXCLUDED.market_cap, fundamentals.market_cap),
      pe = COALESCE(EXCLUDED.pe, fundamentals.pe),
      eps = COALESCE(EXCLUDED.eps, fundamentals.eps),
      div_yield = COALESCE(EXCLUDED.div_yield, fundamentals.div_yield),
      beta = COALESCE(EXCLUDED.beta, fundamentals.beta),
      updated_at = now()
  `.catch(() => null);

  return fresh;
}
