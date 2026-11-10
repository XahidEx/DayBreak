/**
 * Hint-level signal score, volatility rating and a backtest of the score.
 * Everything is computed in code from stored prices. The AI never produces or words these numbers.
 * Hints from past price patterns, not predictions and not financial advice.
 */
import { snapshot, type Bar, type Snapshot } from "./indicators";

export type Label = "Strong Buy" | "Buy" | "Neutral" | "Sell" | "Strong Sell";
export type Factor = { name: string; points: number; max: number; why: string };
export type Signal = { score: number; label: Label; factors: Factor[]; missing: string[] };

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function labelFor(score: number): Label {
  if (score >= 50) return "Strong Buy";
  if (score >= 20) return "Buy";
  if (score > -20) return "Neutral";
  if (score > -50) return "Sell";
  return "Strong Sell";
}

export function scoreSnapshot(s: Snapshot): Signal {
  const factors: Factor[] = [];
  const missing: string[] = [];
  const add = (name: string, points: number, max: number, why: string) => factors.push({ name, points: Math.round(points), max, why });

  if (s.sma50 !== null && s.sma200 !== null) {
    const up = s.sma50 > s.sma200;
    add("Long-term trend", up ? 20 : -20, 20, up ? "50-day average is above the 200-day average." : "50-day average is below the 200-day average.");
  } else missing.push("Long-term trend (needs 200 days of history)");

  if (s.sma200 !== null) {
    const up = s.price > s.sma200;
    add("Price vs 200-day average", up ? 10 : -10, 10, up ? "Price is above its 200-day average." : "Price is below its 200-day average.");
  }
  if (s.sma50 !== null) {
    const up = s.price > s.sma50;
    add("Price vs 50-day average", up ? 10 : -10, 10, up ? "Price is above its 50-day average." : "Price is below its 50-day average.");
  }
  if (s.macd) {
    const up = s.macd.hist > 0;
    add("MACD momentum", up ? 15 : -15, 15, up ? "MACD is above its signal line." : "MACD is below its signal line.");
  } else missing.push("MACD momentum");

  if (s.ret.m3 !== null) {
    const p = clamp((s.ret.m3 / 20) * 15, -15, 15);
    add("3-month momentum", p, 15, `Price is ${s.ret.m3 >= 0 ? "up" : "down"} ${Math.abs(s.ret.m3).toFixed(1)}% over 3 months.`);
  } else missing.push("3-month momentum");

  if (s.rsi14 !== null) {
    const r = s.rsi14;
    const p = r >= 70 ? -10 : r <= 30 ? 10 : 0;
    add("RSI extremes", p, 10, r >= 70 ? "RSI above 70: rose fast, often called overbought." : r <= 30 ? "RSI below 30: fell fast, often called oversold." : "RSI is in the normal range.");
  }
  if (s.boll) {
    const b = s.boll.pctB;
    const p = b > 1 ? -5 : b < 0 ? 5 : 0;
    add("Bollinger bands", p, 5, b > 1 ? "Stretched above the 20-day band." : b < 0 ? "Stretched below the 20-day band." : "Inside the 20-day bands.");
  }
  if (s.cross) {
    const g = s.cross.kind === "golden";
    add(g ? "Recent golden cross" : "Recent death cross", g ? 10 : -10, 10, `The 50-day average crossed ${g ? "above" : "below"} the 200-day ${s.cross.daysAgo} days ago.`);
  }

  const score = clamp(factors.reduce((a, f) => a + f.points, 0), -100, 100);
  return { score, label: labelFor(score), factors, missing };
}

export type Stability = {
  label: "Stable" | "Moderate" | "Volatile" | "Highly volatile";
  tone: "up" | "flat" | "down";
  annualVol: number;
  typicalDailyMove: number;
  bigMoveDays: number;
  worstDay: number;
  drawdown1y: number;
  summary: string;
};

/** Volatility rating from the last year of daily moves. Descriptive of the past only. */
export function stability(bars: Bar[], s: Snapshot): Stability | null {
  const year = bars.slice(-253);
  if (year.length < 40 || s.vol30 === null) return null;
  const moves: number[] = [];
  for (let i = 1; i < year.length; i++) moves.push(((year[i].close - year[i - 1].close) / year[i - 1].close) * 100);
  const avgAbs = moves.reduce((a, b) => a + Math.abs(b), 0) / moves.length;
  const bigMoveDays = moves.filter((m) => Math.abs(m) >= 3).length;
  const worstDay = Math.min(...moves);
  const v = s.vol30;
  const label = v < 20 ? "Stable" : v < 35 ? "Moderate" : v < 55 ? "Volatile" : "Highly volatile";
  const tone = label === "Stable" ? "up" : label === "Moderate" ? "flat" : "down";
  const summary =
    label === "Stable" ? "Its price moves calmly day to day."
    : label === "Moderate" ? "It swings about as much as a typical large stock."
    : label === "Volatile" ? "Its price swings a lot, so expect large moves in both directions."
    : "Its price swings wildly, so both gains and losses can be big and fast.";
  return { label, tone, annualVol: v, typicalDailyMove: avgAbs, bigMoveDays, worstDay, drawdown1y: s.drawdownFromHigh, summary };
}

export type Bucket = { label: Label; count: number; avgReturn: number | null; winRate: number | null };
export type Backtest = { horizon: number; samples: number; buckets: Bucket[]; baseline: { avgReturn: number | null; winRate: number | null } };

const LABELS: Label[] = ["Strong Buy", "Buy", "Neutral", "Sell", "Strong Sell"];

/**
 * Replay the score on this stock's own stored history: for each label, what happened over the next
 * `horizon` trading days. Samples every `step` days from day 200 on. Samples overlap, so treat as rough.
 */
export function backtest(bars: Bar[], horizon = 20, step = 5): Backtest | null {
  const start = 200;
  if (bars.length < start + horizon + step) return null;
  const rets = new Map<Label, number[]>(LABELS.map((l) => [l, []]));
  const all: number[] = [];
  for (let i = start; i + horizon < bars.length; i += step) {
    const snap = snapshot(bars.slice(0, i + 1));
    if (!snap) continue;
    const label = scoreSnapshot(snap).label;
    const r = ((bars[i + horizon].close - bars[i].close) / bars[i].close) * 100;
    rets.get(label)!.push(r);
    all.push(r);
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const win = (a: number[]) => (a.length ? (a.filter((x) => x > 0).length / a.length) * 100 : null);
  return {
    horizon,
    samples: all.length,
    buckets: LABELS.map((label) => ({ label, count: rets.get(label)!.length, avgReturn: avg(rets.get(label)!), winRate: win(rets.get(label)!) })),
    baseline: { avgReturn: avg(all), winRate: win(all) },
  };
}
