import { describe, expect, it } from "vitest";
import { buildFact, factSheet } from "../src/lib/facts";
import { BriefOutput, validateBrief } from "../src/lib/guard";
import { templateBrief } from "../src/lib/summarize";
import { alertScorecard, ideaReturn, ideaScorecard } from "../src/lib/scorecard";

const quote = (price: number, prev = 100) => ({ symbol: "AAPL", price, previousClose: prev, yearHigh: 200, yearLow: 80, asOf: "2026-11-09" });

describe("facts", () => {
  it("flags jumps, drops, and quiet days", () => {
    expect(buildFact(quote(104), null, "2026-11-10", 3).flags).toEqual(["jump"]);
    expect(buildFact(quote(96), null, "2026-11-10", 3).flags).toEqual(["drop"]);
    expect(buildFact(quote(101), null, "2026-11-10", 3).flags).toEqual([]);
  });
  it("flags earnings within 7 days only", () => {
    expect(buildFact(quote(100), "2026-11-14", "2026-11-10", 3).flags).toEqual(["earnings_soon"]);
    expect(buildFact(quote(100), "2026-11-25", "2026-11-10", 3).flags).toEqual([]);
    expect(buildFact(quote(100), "2026-11-01", "2026-11-10", 3).flags).toEqual([]);
  });
  it("flags custom target_low and target_high watch levels and passes guard", () => {
    const lowFact = buildFact(quote(95, 96), null, "2026-11-10", 3, { low: 98, high: 120 });
    expect(lowFact.flags).toEqual(["target_low"]);
    const highFact = buildFact(quote(125, 124), null, "2026-11-10", 3, { low: 98, high: 120 });
    expect(highFact.flags).toEqual(["target_high"]);
    const sheet = factSheet([lowFact, highFact]);
    expect(validateBrief(templateBrief([lowFact, highFact]), [lowFact, highFact], sheet)).toEqual([]);
  });
  it("always gives a caution", () => {
    expect(buildFact(quote(101), null, "2026-11-10", 3).cautionHint.length).toBeGreaterThan(10);
  });
});

describe("guard", () => {
  const facts = [buildFact(quote(104.2), "2026-11-14", "2026-11-10", 3)];
  const sheet = factSheet(facts);
  const good: BriefOutput = {
    greeting: "Good morning.",
    stocks: [{ symbol: "AAPL", whatHappened: "AAPL rose +4.2% to $104.20.", whyItMayMatter: "The data does not show why.", caution: "Earnings are due in 4 days." }],
  };
  it("accepts a clean brief", () => expect(validateBrief(good, facts, sheet)).toEqual([]));
  it("rejects advice", () => {
    const bad = { ...good, greeting: "You should buy AAPL." };
    expect(validateBrief(bad, facts, sheet).length).toBeGreaterThan(0);
  });
  it("rejects predictions", () => {
    const bad = { ...good, stocks: [{ ...good.stocks[0], whyItMayMatter: "It will go up tomorrow." }] };
    expect(validateBrief(bad, facts, sheet).length).toBeGreaterThan(0);
  });
  it("rejects invented numbers", () => {
    const bad = { ...good, stocks: [{ ...good.stocks[0], whatHappened: "AAPL rose 9.9% to $104.20." }] };
    expect(validateBrief(bad, facts, sheet).join()).toContain("9.9");
  });
  it("rejects missing or extra stocks", () => {
    expect(validateBrief({ ...good, stocks: [{ ...good.stocks[0], symbol: "TSLA" }] }, facts, sheet).length).toBe(2);
  });
  it("template fallback passes its own guard", () => {
    expect(validateBrief(templateBrief(facts), facts, sheet)).toEqual([]);
  });
});

describe("scorecard", () => {
  it("computes long and short returns", () => {
    expect(ideaReturn({ direction: "long", entry_price: 100, close_price: null, current_price: 110 })).toBeCloseTo(10);
    expect(ideaReturn({ direction: "short", entry_price: 100, close_price: 90, current_price: 150 })).toBeCloseTo(10);
  });
  it("splits ideas by alert origin", () => {
    const s = ideaScorecard([
      { direction: "long", entry_price: 100, close_price: null, current_price: 110, has_alert: true },
      { direction: "long", entry_price: 100, close_price: null, current_price: 90, has_alert: false },
    ]);
    expect(s.fromAlerts.winRate).toBe(100);
    expect(s.own.winRate).toBe(0);
  });
  it("judges only old jump/drop alerts", () => {
    const s = alertScorecard([
      { kind: "jump", price: 100, current_price: 105, age_days: 5 },
      { kind: "drop", price: 100, current_price: 105, age_days: 5 },
      { kind: "jump", price: 100, current_price: 105, age_days: 1 },
      { kind: "earnings_soon", price: 100, current_price: 105, age_days: 9 },
    ]);
    expect(s.count).toBe(2);
    expect(s.continuedPct).toBe(50);
  });
});
