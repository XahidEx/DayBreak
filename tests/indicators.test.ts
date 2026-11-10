import { describe, expect, it } from "vitest";
import { bollinger, emaSeries, macd, maxDrawdown, recentCross, returnOver, rsi, sma, snapshot, volatility, volumeRatio, type Bar } from "../src/lib/indicators";

const bars = (close: number[]): Bar[] =>
  close.map((c, i) => ({ day: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10), open: c, high: c, low: c, close: c, volume: 1000 }));
const range = (n: number, f: (i: number) => number) => Array.from({ length: n }, (_, i) => f(i));

describe("indicators", () => {
  it("sma averages the last n values", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toBe(4);
    expect(sma([1, 2], 3)).toBeNull();
  });
  it("ema seeds with the sma", () => {
    const e = emaSeries([1, 2, 3, 4, 5], 3);
    expect(e[2]).toBe(2);
    expect(e[4]).toBeGreaterThan(e[3]);
  });
  it("rsi is 100 on a pure uptrend and 0 on a pure downtrend", () => {
    expect(rsi(range(30, (i) => 10 + i))).toBe(100);
    expect(rsi(range(30, (i) => 100 - i))).toBe(0);
    expect(rsi([1, 2, 3])).toBeNull();
  });
  it("rsi matches a known mixed series closely", () => {
    const c = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    expect(rsi(c)!).toBeGreaterThan(65);
    expect(rsi(c)!).toBeLessThan(75);
  });
  it("macd is positive in a steady uptrend", () => {
    const m = macd(range(80, (i) => 100 + i * 0.5 + Math.sin(i) ))!;
    expect(m.macd).toBeGreaterThan(0);
  });
  it("bollinger puts a price at the mean at 50%", () => {
    const b = bollinger([...range(19, (i) => (i % 2 ? 11 : 9)), 10])!;
    expect(b.pctB).toBeGreaterThan(0.3);
    expect(b.pctB).toBeLessThan(0.7);
  });
  it("returns and drawdown", () => {
    expect(returnOver([100, 110], 1)).toBeCloseTo(10);
    expect(maxDrawdown([100, 150, 75, 120])).toBeCloseTo(50);
  });
  it("volatility is zero for a flat series", () => {
    expect(volatility(range(40, () => 50))).toBe(0);
  });
  it("volume ratio compares to the prior average", () => {
    expect(volumeRatio([...range(20, () => 100), 300])).toBe(3);
  });
  it("detects a golden cross", () => {
    // long decline then sharp rally: SMA50 crosses above SMA200 during the rally
    const c = [...range(250, (i) => 200 - i * 0.3), ...range(60, (i) => 125 + i * 3)];
    const x = recentCross(c, 60);
    expect(x?.kind).toBe("golden");
  });
  it("snapshot needs at least two bars and fills what it can", () => {
    expect(snapshot(bars([1]))).toBeNull();
    const s = snapshot(bars(range(30, (i) => 10 + i)))!;
    expect(s.sma20).not.toBeNull();
    expect(s.sma200).toBeNull();
    expect(s.price).toBe(39);
  });
});
