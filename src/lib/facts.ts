import type { Headline, Quote } from "./market/fmp";

export type Flag = "jump" | "drop" | "earnings_soon";

export type StockFact = {
  symbol: string;
  price: number;
  previousClose: number;
  changePct: number;
  yearHigh: number;
  yearLow: number;
  pctBelowHigh: number;
  pctAboveLow: number;
  earningsDate: string | null;
  daysToEarnings: number | null;
  asOf: string;
  headlines: Headline[];
  flags: Flag[];
  cautionHint: string;
  spyChangePct?: number | null;
  volumeRatio?: number | null;
};

export const EARNINGS_WINDOW_DAYS = 7;

const DAY = 86_400_000;
const dayDiff = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / DAY);

export function cautionFor(f: Pick<StockFact, "flags" | "daysToEarnings" | "pctBelowHigh" | "pctAboveLow">): string {
  if (f.flags.includes("earnings_soon") && f.daysToEarnings !== null)
    return `Earnings are due in ${f.daysToEarnings} days, and results often move a share price sharply in either direction.`;
  if (f.flags.includes("jump"))
    return "One big up day is not a trend, and sharp rises sometimes give back part of the gain.";
  if (f.flags.includes("drop"))
    return "A big drop can have causes the data cannot show yet, and prices that fall can keep falling or bounce back, so it is unclear which.";
  if (f.pctBelowHigh <= 3)
    return "It is priced close to its 52-week high, so a lot of good news may already be in the price.";
  if (f.pctAboveLow <= 3)
    return "It is close to its 52-week low, which can mean the market sees real problems.";
  return "A quiet day tells you very little about what happens next.";
}

export function buildFact(
  q: Quote,
  earningsDate: string | null,
  today: string,
  thresholdPct: number,
): StockFact {
  const changePct = ((q.price - q.previousClose) / q.previousClose) * 100;
  const flags: Flag[] = [];
  if (changePct >= thresholdPct) flags.push("jump");
  if (changePct <= -thresholdPct) flags.push("drop");
  const daysToEarnings = earningsDate ? dayDiff(earningsDate, today) : null;
  if (daysToEarnings !== null && daysToEarnings >= 0 && daysToEarnings <= EARNINGS_WINDOW_DAYS)
    flags.push("earnings_soon");
  const pctBelowHigh = q.yearHigh > 0 ? ((q.yearHigh - q.price) / q.yearHigh) * 100 : 100;
  const pctAboveLow = q.yearLow > 0 ? ((q.price - q.yearLow) / q.yearLow) * 100 : 100;
  const partial = { flags, daysToEarnings, pctBelowHigh, pctAboveLow };
  return {
    symbol: q.symbol,
    price: q.price,
    previousClose: q.previousClose,
    changePct,
    yearHigh: q.yearHigh,
    yearLow: q.yearLow,
    pctBelowHigh,
    pctAboveLow,
    earningsDate: flags.includes("earnings_soon") ? earningsDate : null,
    daysToEarnings: flags.includes("earnings_soon") ? daysToEarnings : null,
    asOf: q.asOf,
    headlines: [],
    flags,
    cautionHint: cautionFor(partial),
  };
}

export const fmtPrice = (n: number) => n.toFixed(2);
export const fmtPct = (n: number) => `${n >= 0 ? "+" : "-"}${Math.abs(n).toFixed(1)}%`;

/** The only source of numbers the AI is allowed to use. */
export function factSheet(facts: StockFact[]): string {
  const lines = [
    "Definitions: a big move is a daily change of the alert threshold or more. Earnings count as soon when within 7 days. The 52-week range is the lowest and highest price in the past year.",
  ];
  for (const f of facts) {
    const spyLine =
      typeof f.spyChangePct === "number"
        ? `US market (SPY) change ${fmtPct(f.spyChangePct)} (${fmtPct(f.changePct - f.spyChangePct)} vs market). `
        : "";
    const volLine =
      typeof f.volumeRatio === "number"
        ? `Volume ${f.volumeRatio.toFixed(1)}x 20-day average. `
        : "";
    lines.push(
      `${f.symbol}: price $${fmtPrice(f.price)}, previous close $${fmtPrice(f.previousClose)}, change ${fmtPct(f.changePct)}, data as of ${f.asOf}. ` +
        spyLine +
        volLine +
        `52-week range $${fmtPrice(f.yearLow)} to $${fmtPrice(f.yearHigh)} (${f.pctBelowHigh.toFixed(1)}% below the high). ` +
        `Flags: ${f.flags.join(", ")}. ` +
        (f.earningsDate ? `Earnings on ${f.earningsDate} (in ${f.daysToEarnings} days). ` : "") +
        (f.headlines.length
          ? `Headlines: ${f.headlines.map((h) => `"${h.title}" (${h.publisher}, ${h.date})`).join("; ")}. `
          : "No headlines available. ") +
        `Caution to convey: ${f.cautionHint}`,
    );
  }
  return lines.join("\n");
}
