/** Pure technical-indicator maths. Everything here is computed in code, never by the AI. */

export type Bar = { day: string; open: number; high: number; low: number; close: number; volume: number };

export const sma = (v: number[], n: number): number | null =>
  v.length < n ? null : v.slice(-n).reduce((a, b) => a + b, 0) / n;

/** Full EMA series (seeded with the SMA of the first n values). Entries before index n-1 are NaN. */
export function emaSeries(v: number[], n: number): number[] {
  const out: number[] = new Array(v.length).fill(NaN);
  if (v.length < n) return out;
  const k = 2 / (n + 1);
  let e = v.slice(0, n).reduce((a, b) => a + b, 0) / n;
  out[n - 1] = e;
  for (let i = n; i < v.length; i++) {
    e = v[i] * k + e * (1 - k);
    out[i] = e;
  }
  return out;
}

/** Wilder's RSI. */
export function rsi(close: number[], n = 14): number | null {
  if (close.length <= n) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = close[i] - close[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= n; loss /= n;
  for (let i = n + 1; i < close.length; i++) {
    const d = close[i] - close[i - 1];
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

export type Macd = { macd: number; signal: number; hist: number; prevHist: number };

export function macd(close: number[]): Macd | null {
  const fast = emaSeries(close, 12), slow = emaSeries(close, 26);
  const line: number[] = [];
  for (let i = 0; i < close.length; i++) if (!Number.isNaN(slow[i])) line.push(fast[i] - slow[i]);
  const sig = emaSeries(line, 9);
  const last = line.length - 1;
  if (last < 9 || Number.isNaN(sig[last]) || Number.isNaN(sig[last - 1])) return null;
  return { macd: line[last], signal: sig[last], hist: line[last] - sig[last], prevHist: line[last - 1] - sig[last - 1] };
}

export function bollinger(close: number[], n = 20, k = 2): { mid: number; upper: number; lower: number; pctB: number } | null {
  if (close.length < n) return null;
  const w = close.slice(-n);
  const mid = w.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - mid) ** 2, 0) / n);
  const upper = mid + k * sd, lower = mid - k * sd;
  return { mid, upper, lower, pctB: upper === lower ? 0.5 : (close[close.length - 1] - lower) / (upper - lower) };
}

/** Return over the last `days` bars, in percent. */
export function returnOver(close: number[], days: number): number | null {
  if (close.length <= days) return null;
  const base = close[close.length - 1 - days];
  return base > 0 ? ((close[close.length - 1] - base) / base) * 100 : null;
}

/** Largest peak-to-trough fall in the series, as a positive percent. */
export function maxDrawdown(close: number[]): number {
  let peak = -Infinity, worst = 0;
  for (const c of close) {
    peak = Math.max(peak, c);
    if (peak > 0) worst = Math.max(worst, ((peak - c) / peak) * 100);
  }
  return worst;
}

/** Current fall from the highest close in the series, percent. */
export const drawdownNow = (close: number[]): number => {
  if (!close.length) return 0;
  const peak = Math.max(...close);
  return peak > 0 ? ((peak - close[close.length - 1]) / peak) * 100 : 0;
};

/** Annualised volatility of daily log returns over the last n bars, percent. */
export function volatility(close: number[], n = 30): number | null {
  if (close.length <= n) return null;
  const r: number[] = [];
  for (let i = close.length - n; i < close.length; i++) r.push(Math.log(close[i] / close[i - 1]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  const sd = Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / (r.length - 1));
  return sd * Math.sqrt(252) * 100;
}

/** Latest volume divided by the average of the prior n bars. */
export function volumeRatio(volume: number[], n = 20): number | null {
  if (volume.length <= n) return null;
  const avg = volume.slice(-n - 1, -1).reduce((a, b) => a + b, 0) / n;
  return avg > 0 ? volume[volume.length - 1] / avg : null;
}

export type Cross = { kind: "golden" | "death"; daysAgo: number } | null;

/** Most recent SMA50/SMA200 crossover within the last `lookback` bars. */
export function recentCross(close: number[], lookback = 30): Cross {
  if (close.length < 200 + lookback) return null;
  const diff = (end: number) => {
    const s = close.slice(0, end);
    return sma(s, 50)! - sma(s, 200)!;
  };
  for (let ago = 0; ago < lookback; ago++) {
    const now = diff(close.length - ago), before = diff(close.length - ago - 1);
    if (before <= 0 && now > 0) return { kind: "golden", daysAgo: ago };
    if (before >= 0 && now < 0) return { kind: "death", daysAgo: ago };
  }
  return null;
}

export type Snapshot = {
  asOf: string;
  price: number;
  sma20: number | null; sma50: number | null; sma200: number | null;
  rsi14: number | null;
  macd: Macd | null;
  boll: ReturnType<typeof bollinger>;
  ret: { d1: number | null; w1: number | null; m1: number | null; m3: number | null; m6: number | null; y1: number | null };
  vol30: number | null;
  volumeRatio: number | null;
  drawdownFromHigh: number;
  maxDrawdown: number;
  cross: Cross;
  bars: number;
};

export function snapshot(bars: Bar[]): Snapshot | null {
  if (bars.length < 2) return null;
  const close = bars.map((b) => b.close);
  const year = close.slice(-252);
  return {
    asOf: bars[bars.length - 1].day,
    price: close[close.length - 1],
    sma20: sma(close, 20), sma50: sma(close, 50), sma200: sma(close, 200),
    rsi14: rsi(close),
    macd: macd(close),
    boll: bollinger(close),
    ret: {
      d1: returnOver(close, 1), w1: returnOver(close, 5), m1: returnOver(close, 21),
      m3: returnOver(close, 63), m6: returnOver(close, 126), y1: returnOver(close, 252),
    },
    vol30: volatility(close),
    volumeRatio: volumeRatio(bars.map((b) => b.volume)),
    drawdownFromHigh: drawdownNow(year),
    maxDrawdown: maxDrawdown(close),
    cross: recentCross(close),
    bars: bars.length,
  };
}

export type Reading = { label: string; value: string; note: string; tone: "up" | "down" | "flat" };

const f = (n: number, d = 1) => n.toFixed(d);

/** Plain-English reading of each indicator. Descriptive only: no advice, no prediction. */
export function readings(s: Snapshot): Reading[] {
  const out: Reading[] = [];
  if (s.sma50 !== null && s.sma200 !== null) {
    const up = s.sma50 > s.sma200;
    out.push({
      label: "Trend (50 vs 200-day average)", value: `${f(s.sma50, 2)} vs ${f(s.sma200, 2)}`,
      note: up ? "The 50-day average is above the 200-day: the longer trend is up." : "The 50-day average is below the 200-day: the longer trend is down.",
      tone: up ? "up" : "down",
    });
  }
  if (s.sma50 !== null) {
    const above = s.price > s.sma50;
    out.push({
      label: "Price vs 50-day average", value: `${f(((s.price - s.sma50) / s.sma50) * 100)}%`,
      note: above ? "Trading above its 50-day average (short-term strength)." : "Trading below its 50-day average (short-term weakness).",
      tone: above ? "up" : "down",
    });
  }
  if (s.cross)
    out.push({
      label: s.cross.kind === "golden" ? "Golden cross" : "Death cross", value: `${s.cross.daysAgo} days ago`,
      note: s.cross.kind === "golden" ? "The 50-day average crossed above the 200-day recently." : "The 50-day average crossed below the 200-day recently.",
      tone: s.cross.kind === "golden" ? "up" : "down",
    });
  if (s.rsi14 !== null) {
    const r = s.rsi14;
    out.push({
      label: "RSI (14)", value: f(r),
      note: r >= 70 ? "Above 70: has risen fast and is often called overbought." : r <= 30 ? "Below 30: has fallen fast and is often called oversold." : "Between 30 and 70: no extreme.",
      tone: r >= 70 ? "down" : r <= 30 ? "up" : "flat",
    });
  }
  if (s.macd) {
    const bull = s.macd.hist > 0;
    const turned = (s.macd.hist > 0) !== (s.macd.prevHist > 0);
    out.push({
      label: "MACD momentum", value: f(s.macd.hist, 2),
      note: `${bull ? "MACD is above its signal line: momentum is positive." : "MACD is below its signal line: momentum is negative."}${turned ? " It just crossed." : ""}`,
      tone: bull ? "up" : "down",
    });
  }
  if (s.boll) {
    const b = s.boll.pctB;
    out.push({
      label: "Bollinger band position", value: `${f(b * 100, 0)}%`,
      note: b > 1 ? "Above the upper band: stretched high versus the last 20 days." : b < 0 ? "Below the lower band: stretched low versus the last 20 days." : "Inside the bands.",
      tone: b > 1 ? "down" : b < 0 ? "up" : "flat",
    });
  }
  if (s.volumeRatio !== null)
    out.push({
      label: "Volume vs 20-day average", value: `${f(s.volumeRatio, 1)}x`,
      note: s.volumeRatio >= 1.5 ? "Unusually heavy trading: the move has more weight behind it." : s.volumeRatio <= 0.6 ? "Light trading: the move is less convincing." : "Normal trading volume.",
      tone: "flat",
    });
  if (s.vol30 !== null)
    out.push({ label: "Volatility (30-day, annualised)", value: `${f(s.vol30)}%`, note: s.vol30 > 45 ? "Swings a lot." : s.vol30 < 20 ? "Moves calmly." : "Moderate swings.", tone: "flat" });
  out.push({
    label: "Below its 1-year high", value: `${f(s.drawdownFromHigh)}%`,
    note: `Worst fall in the stored history: ${f(s.maxDrawdown)}%.`, tone: "flat",
  });
  return out;
}
