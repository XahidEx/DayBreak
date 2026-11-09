import { BriefOutput, validateBrief } from "./guard";
import { factSheet, fmtPct, fmtPrice, type StockFact } from "./facts";

const SYSTEM = `You write DayBreak, a short friendly morning note about a person's stock watchlist.
Rules:
- Use simple everyday words. No jargon. Short sentences.
- Use ONLY the facts and figures in the fact sheet, copied exactly as written. Never calculate, round, or invent any number, date, or reason.
- Never tell the reader to buy, sell, or hold. Never predict where a price will go. Never say what they should do.
- Headlines are claims by publishers: say "a headline from <publisher> said ..." and never state the cause as certain. If there is no headline, say the data does not show why.
- For every stock give exactly one honest reason for caution, based on the "Caution to convey" line, in your own gentle words.
- Include every stock in the sheet, once each, using its exact ticker symbol.
Reply with JSON only: {"greeting": string, "stocks": [{"symbol": string, "whatHappened": string, "whyItMayMatter": string, "caution": string}]}`;

async function callGemini(prompt: string): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("Gemini returned no text");
  return JSON.parse(text);
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
