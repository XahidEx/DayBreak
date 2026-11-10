/**
 * "Why did it move?" explainer — compares a stock's move against the US market (SPY),
 * checks trading volume, finds the biggest recent single-day moves, and pairs them with news headlines.
 * All numbers come from code; never invented by AI.
 */
import type { Bar, Snapshot } from "./indicators";
import { returnOver } from "./indicators";
import type { Headline } from "./market";

export type MoveDriver = "company-specific" | "sector-wide" | "market-wide" | "in-line" | "quiet";

export type SectorBenchmark = {
  etf: string;
  label: string;
  bars: Bar[];
};

export type MoveComparison = {
  stock1d: number;
  spy1d: number | null;
  excess1d: number | null;
  stock1w: number | null;
  spy1w: number | null;
  stock1m: number | null;
  spy1m: number | null;
  sectorEtf: string | null;
  sectorLabel: string | null;
  sector1d: number | null;
  sector1w: number | null;
  sector1m: number | null;
  driver: MoveDriver;
  summary: string;
  volumeNote: string | null;
};

export type NotableDay = {
  day: string;
  changePct: number;
  close: number;
  volumeRatio: number | null;
  headline?: Headline;
};

const fmtSigned = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

/** Compare a stock's 1d/1w/1m move with SPY (and optional sector ETF) and explain whether the move is market-wide, sector-wide, or company-specific. */
export function compareWithMarket(snap: Snapshot, spyBars: Bar[], sector?: SectorBenchmark | null): MoveComparison {
  const stock1d = snap.ret.d1 ?? 0;
  const stock1w = snap.ret.w1;
  const stock1m = snap.ret.m1;
  const spyClose = spyBars.map((b) => b.close);
  const spy1d = returnOver(spyClose, 1);
  const spy1w = returnOver(spyClose, 5);
  const spy1m = returnOver(spyClose, 21);
  const excess1d = spy1d !== null ? stock1d - spy1d : null;

  const secClose = sector?.bars.map((b) => b.close) ?? [];
  const sector1d = secClose.length ? returnOver(secClose, 1) : null;
  const sector1w = secClose.length ? returnOver(secClose, 5) : null;
  const sector1m = secClose.length ? returnOver(secClose, 21) : null;
  const sectorExcess1d = sector1d !== null ? stock1d - sector1d : null;

  let driver: MoveDriver = "quiet";
  let summary: string;

  if (Math.abs(stock1d) < 1.2) {
    driver = "quiet";
    summary =
      spy1d !== null
        ? `Moved ${fmtSigned(stock1d)} on the latest day while the US market (SPY) moved ${fmtSigned(spy1d)} — a normal, quiet session.`
        : `Moved ${fmtSigned(stock1d)} on the latest day — a normal, quiet session.`;
  } else if (spy1d === null || excess1d === null) {
    driver = "company-specific";
    summary = `Moved ${fmtSigned(stock1d)} on the latest day.`;
  } else if (Math.sign(stock1d) === Math.sign(spy1d) && Math.abs(spy1d) >= 1.0 && Math.abs(excess1d) < 1.5) {
    driver = "market-wide";
    summary = `Moved ${fmtSigned(stock1d)} on the latest day while the US market (SPY) moved ${fmtSigned(spy1d)}. Most of this move came from the broader market rather than company-specific news.`;
  } else if (
    sector &&
    sector1d !== null &&
    sectorExcess1d !== null &&
    Math.sign(stock1d) === Math.sign(sector1d) &&
    Math.abs(sector1d) >= 1.0 &&
    Math.abs(sectorExcess1d) < 1.5
  ) {
    driver = "sector-wide";
    summary = `Moved ${fmtSigned(stock1d)} on the latest day along with the ${sector.label} sector (${sector.etf} ${fmtSigned(sector1d)}), while the broader US market (SPY) moved ${fmtSigned(spy1d)}.`;
  } else if (Math.abs(excess1d) >= 2.0) {
    driver = "company-specific";
    const dir = stock1d < 0 ? "Fell" : "Rose";
    const secBit =
      sector && sector1d !== null
        ? ` and ${sector.label} (${sector.etf}) moved ${fmtSigned(sector1d)}`
        : "";
    summary = `${dir} ${fmtSigned(stock1d)} on the latest day while the US market (SPY) moved ${fmtSigned(spy1d)}${secBit} (${fmtSigned(excess1d)} vs. market). That gap points to something specific to this stock.`;
  } else {
    driver = "in-line";
    summary = `Moved ${fmtSigned(stock1d)} on the latest day compared with ${fmtSigned(spy1d)} for the US market (SPY).`;
  }

  let volumeNote: string | null = null;
  if (snap.volumeRatio !== null) {
    if (snap.volumeRatio >= 1.8)
      volumeNote = `Trading volume was ${snap.volumeRatio.toFixed(1)}x its 20-day average — heavy activity backed the move.`;
    else if (snap.volumeRatio <= 0.6)
      volumeNote = `Trading volume was ${snap.volumeRatio.toFixed(1)}x its 20-day average — lighter than usual.`;
    else
      volumeNote = `Trading volume was ${snap.volumeRatio.toFixed(1)}x its 20-day average (normal).`;
  }

  return {
    stock1d,
    spy1d,
    excess1d,
    stock1w,
    spy1w,
    stock1m,
    spy1m,
    sectorEtf: sector?.etf ?? null,
    sectorLabel: sector?.label ?? null,
    sector1d,
    sector1w,
    sector1m,
    driver,
    summary,
    volumeNote,
  };
}

/** Find the largest single-day moves (by absolute %) in the last `lookback` bars, optionally pairing each with a headline from that day (±1 day). */
export function notableDays(bars: Bar[], lookback = 30, limit = 3, headlines: Headline[] = []): NotableDay[] {
  if (bars.length < 2) return [];
  const start = Math.max(1, bars.length - lookback);
  const out: NotableDay[] = [];
  for (let i = start; i < bars.length; i++) {
    const prev = bars[i - 1].close;
    if (prev <= 0) continue;
    const changePct = ((bars[i].close - prev) / prev) * 100;
    const volSlice = bars.slice(Math.max(0, i - 20), i);
    const avgVol = volSlice.length ? volSlice.reduce((s, b) => s + b.volume, 0) / volSlice.length : 0;
    const volumeRatio = avgVol > 0 ? bars[i].volume / avgVol : null;
    const day = bars[i].day;
    const dayMs = Date.parse(day);
    const headline = headlines.find((h) => h.date && Math.abs(Date.parse(h.date) - dayMs) <= 86_400_000);
    out.push({ day, changePct, close: bars[i].close, volumeRatio, ...(headline ? { headline } : {}) });
  }
  return out
    .filter((d) => Math.abs(d.changePct) >= 2.0)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, limit);
}

export type MoveExplanation = {
  comparison: MoveComparison;
  bigDays: NotableDay[];
  headlines: Headline[];
};
