import { z } from "zod";
import type { StockFact } from "./facts";

export const BriefOutput = z.object({
  greeting: z.string().min(1).max(300),
  stocks: z
    .array(
      z.object({
        symbol: z.string(),
        whatHappened: z.string().min(1).max(400),
        whyItMayMatter: z.string().min(1).max(500),
        caution: z.string().min(1).max(400),
      }),
    )
    .min(1),
});
export type BriefOutput = z.infer<typeof BriefOutput>;

/** Words that turn information into advice or prediction. */
const BANNED = [
  /\b(buy|buying|sell|selling|should|recommend\w*|must|undervalued|overvalued|guarantee\w*)\b/i,
  /\b(will|going to) (rise|fall|go up|go down|drop|jump|soar|crash|climb|surge)\b/i,
  /\bprice target\b/i,
  /\b(great|good|bad) (time|opportunity) to\b/i,
];

const numberTokens = (text: string): string[] =>
  text.replace(/(\d),(?=\d{3}\b)/g, "$1").match(/\d+(?:\.\d+)?/g) ?? [];

export function validateBrief(out: BriefOutput, facts: StockFact[], sheet: string): string[] {
  const errors: string[] = [];
  // Allow numbers from the fact sheet plus harmless small integers (1, 2) used in everyday phrasing
  const allowed = new Set([...numberTokens(sheet), "1", "2"]);
  const expected = new Set(facts.map((f) => f.symbol));
  const got = new Set(out.stocks.map((s) => s.symbol.toUpperCase()));

  for (const s of expected) if (!got.has(s)) errors.push(`Missing stock ${s}.`);
  for (const s of got) if (!expected.has(s)) errors.push(`Unexpected stock ${s}.`);

  const all = [out.greeting, ...out.stocks.flatMap((s) => [s.whatHappened, s.whyItMayMatter, s.caution])];
  for (const text of all) {
    for (const re of BANNED) {
      const m = text.match(re);
      if (m) errors.push(`Advice or prediction wording not allowed: "${m[0]}".`);
    }
    for (const n of numberTokens(text)) {
      if (!allowed.has(n)) errors.push(`Number ${n} is not in the fact sheet.`);
    }
  }
  return [...new Set(errors)];
}
