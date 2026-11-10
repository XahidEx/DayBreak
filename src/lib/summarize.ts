import { BriefOutput, validateBrief } from "./guard";
import { factSheet, fmtPct, fmtPrice, type StockFact } from "./facts";

const SYSTEM = `You write DayBreak, a short friendly morning note about a person's stock watchlist.
Rules:
- Use simple everyday words. No jargon. Short sentences.
- Use ONLY the facts and figures in the fact sheet, copied exactly as written. Never calculate, round, or invent any number, date, or reason.
- Never tell the reader to buy, sell, or hold. Never predict where a price will go. Never say what they should do.
- In "whatHappened", state the price and change, and if US market (SPY) change or volume vs average is in the sheet, mention whether the stock moved with the market or on its own and whether volume was heavy.
- Headlines are claims by publishers: say "a headline from <publisher> said ..." and never state the cause as certain. If there is no headline, say the data does not show why.
- For every stock give exactly one honest reason for caution, based on the "Caution to convey" line, in your own gentle words.
- Include every stock in the sheet, once each, using its exact ticker symbol.
Reply with JSON only: {"greeting": string, "stocks": [{"symbol": string, "whatHappened": string, "whyItMayMatter": string, "caution": string}]}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Models are tried in order; overloaded (429/5xx) or retired (404) models fall through to the next. */
function modelChain(): string[] {
  const chain = [process.env.GEMINI_MODEL, ...(process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-flash-latest").split(",")];
  return [...new Set(chain.map((m) => m?.trim()).filter((m): m is string => !!m))];
}

async function callGemini(prompt: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  let lastError = "no model tried";
  for (const model of modelChain()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await sleep(2000 * attempt * attempt);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      }).catch((e) => ({ ok: false, status: 0, json: async () => ({}), error: e }) as any);
      if (res.ok) {
        const data = (await res.json()) as any;
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (typeof text !== "string") throw new Error(`Gemini (${model}) returned no text`);
        return JSON.parse(text);
      }
      lastError = `${model} HTTP ${res.status}`;
      if (res.status === 404 || res.status === 400 || res.status === 401 || res.status === 403) break; // retrying won't help; try next model
    }
  }
  throw new Error(`Gemini unavailable (${lastError})`);
}

/** Plain, deterministic fallback: used if the AI fails or breaks the rules. */
export function templateBrief(facts: StockFact[]): BriefOutput {
  return {
    greeting: "Good morning. Here is what changed on your watchlist.",
    stocks: facts.map((f) => {
      const parts: string[] = [];
      if (f.flags.includes("jump") || f.flags.includes("drop"))
        parts.push(`${f.symbol} ${f.changePct >= 0 ? "rose" : "fell"} ${fmtPct(f.changePct)} to $${fmtPrice(f.price)} (previous close $${fmtPrice(f.previousClose)}).`);
      else parts.push(`${f.symbol} is at $${fmtPrice(f.price)}, ${fmtPct(f.changePct)} on the day.`);
      if (typeof f.spyChangePct === "number")
        parts.push(`The US market (SPY) moved ${fmtPct(f.spyChangePct)} (${fmtPct(f.changePct - f.spyChangePct)} vs market).`);
      if (typeof f.volumeRatio === "number")
        parts.push(`Volume was ${f.volumeRatio.toFixed(1)}x its 20-day average.`);
      if (f.flags.includes("target_low") && typeof f.targetLow === "number")
        parts.push(`It is at or below your $${fmtPrice(f.targetLow)} low watch level.`);
      if (f.flags.includes("target_high") && typeof f.targetHigh === "number")
        parts.push(`It is at or above your $${fmtPrice(f.targetHigh)} high watch level.`);
      if (f.earningsDate) parts.push(`It reports earnings on ${f.earningsDate}.`);
      const h = f.headlines[0];
      return {
        symbol: f.symbol,
        whatHappened: parts.join(" "),
        whyItMayMatter: h
          ? `A headline from ${h.publisher} said: "${h.title}". The data does not confirm this is the cause.`
          : "The data does not show why.",
        caution: f.cautionHint,
      };
    }),
  };
}

export async function summarize(facts: StockFact[]): Promise<{ mode: "ai" | "template"; output: BriefOutput; note?: string }> {
  const sheet = factSheet(facts);
  let feedback = "";
  let lastNote = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGemini(`Fact sheet:\n${sheet}${feedback}`);
      const parsed = BriefOutput.safeParse(raw);
      if (!parsed.success) throw new Error("Output shape invalid");
      const errors = validateBrief(parsed.data, facts, sheet);
      if (errors.length === 0) return { mode: "ai", output: parsed.data };
      lastNote = errors.join(" ");
      feedback = `\n\nYour previous reply broke the rules: ${lastNote} Fix this and reply again.`;
    } catch (e) {
      lastNote = e instanceof Error ? e.message : String(e);
    }
  }
  return { mode: "template", output: templateBrief(facts), note: `AI summary unavailable (${lastNote}); plain version used.` };
}
