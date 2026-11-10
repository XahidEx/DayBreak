import { describe, expect, it } from "vitest";
import { snapshot, type Bar } from "../src/lib/indicators";
import { backtest, labelFor, scoreSnapshot, stability } from "../src/lib/signal";

const makeBars = (closes: number[]): Bar[] =>
  closes.map((c, i) => ({
    day: new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
    open: c,
    high: c * 1.005,
    low: c * 0.995,
    close: c,
    volume: 1_000_000,
  }));

describe("signal & stability", () => {
  it("maps scores to labels across all five bands", () => {
    expect(labelFor(65)).toBe("Strong Buy");
    expect(labelFor(25)).toBe("Buy");
    expect(labelFor(0)).toBe("Neutral");
    expect(labelFor(-25)).toBe("Sell");
    expect(labelFor(-70)).toBe("Strong Sell");
  });

  it("scores a sustained uptrend as Buy or Strong Buy with visible factors", () => {
    const closes = Array.from({ length: 260 }, (_, i) => 100 + i * 0.5 + Math.sin(i / 3) * 1.5);
    const snap = snapshot(makeBars(closes))!;
    const sig = scoreSnapshot(snap);
    expect(sig.score).toBeGreaterThanOrEqual(20);
    expect(["Buy", "Strong Buy"]).toContain(sig.label);
    expect(sig.factors.length).toBeGreaterThanOrEqual(5);
  });

  it("scores a sustained downtrend as Sell or Strong Sell", () => {
    const closes = Array.from({ length: 260 }, (_, i) => 250 - i * 0.5 + Math.sin(i / 3) * 1.5);
    const snap = snapshot(makeBars(closes))!;
    const sig = scoreSnapshot(snap);
    expect(sig.score).toBeLessThanOrEqual(-20);
    expect(["Sell", "Strong Sell"]).toContain(sig.label);
  });

  it("rates low-noise series as Stable and high-swing series as Volatile/Highly volatile", () => {
    const calm = makeBars(Array.from({ length: 120 }, (_, i) => 100 + (i % 2 === 0 ? 0.2 : -0.2)));
    const calmStab = stability(calm, snapshot(calm)!)!;
    expect(calmStab.label).toBe("Stable");

    const wild = makeBars(Array.from({ length: 120 }, (_, i) => 100 * (i % 2 === 0 ? 1.04 : 0.96)));
    const wildStab = stability(wild, snapshot(wild)!)!;
    expect(["Volatile", "Highly volatile"]).toContain(wildStab.label);
    expect(wildStab.bigMoveDays).toBeGreaterThan(50);
  });

  it("computes backtest buckets and baseline over stored history", () => {
    const bars = makeBars(Array.from({ length: 300 }, (_, i) => 100 + i * 0.3 + Math.sin(i / 4) * 3));
    const bt = backtest(bars, 20, 5)!;
    expect(bt).not.toBeNull();
    expect(bt.samples).toBeGreaterThan(10);
    expect(bt.buckets.reduce((s, b) => s + b.count, 0)).toBe(bt.samples);
  });
});
