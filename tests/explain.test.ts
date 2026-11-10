import { describe, expect, it } from "vitest";
import { compareWithMarket, notableDays } from "../src/lib/explain";
import { fmtMarketCap, sectorEtfFor } from "../src/lib/fundamentals";
import { buildFact, factSheet } from "../src/lib/facts";
import { validateBrief } from "../src/lib/guard";
import { snapshot, type Bar } from "../src/lib/indicators";
import { templateBrief } from "../src/lib/summarize";

const makeBars = (closes: number[], lastVol = 1000): Bar[] =>
  closes.map((c, i) => ({
    day: new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString().slice(0, 10),
    open: c,
    high: c,
    low: c,
    close: c,
    volume: i === closes.length - 1 ? lastVol : 1000,
  }));

describe("explain", () => {
  it("classifies a sharp drop while SPY is flat as company-specific", () => {
    const stock = makeBars([...Array.from({ length: 25 }, () => 100), 94], 2500);
    const spy = makeBars([...Array.from({ length: 25 }, () => 500), 501]);
    const cmp = compareWithMarket(snapshot(stock)!, spy);
    expect(cmp.driver).toBe("company-specific");
    expect(cmp.volumeNote).toContain("heavy");
  });

  it("classifies a drop that matches SPY's drop as market-wide", () => {
    const stock = makeBars([...Array.from({ length: 25 }, () => 100), 97.5]);
    const spy = makeBars([...Array.from({ length: 25 }, () => 500), 489]);
    const cmp = compareWithMarket(snapshot(stock)!, spy);
    expect(cmp.driver).toBe("market-wide");
  });

  it("classifies a drop that matches the sector ETF while SPY is flat as sector-wide", () => {
    const stock = makeBars([...Array.from({ length: 25 }, () => 100), 96.5]);
    const spy = makeBars([...Array.from({ length: 25 }, () => 500), 500.5]);
    const xlk = makeBars([...Array.from({ length: 25 }, () => 200), 193.6]);
    const cmp = compareWithMarket(snapshot(stock)!, spy, { etf: "XLK", label: "Technology", bars: xlk });
    expect(cmp.driver).toBe("sector-wide");
    expect(cmp.sectorEtf).toBe("XLK");
  });

  it("maps sectors to SPDR ETFs and formats market cap", () => {
    expect(sectorEtfFor("Technology")).toEqual({ etf: "XLK", label: "Technology" });
    expect(sectorEtfFor("Semiconductors")).toEqual({ etf: "XLK", label: "Technology" });
    expect(sectorEtfFor("Financial Services")).toEqual({ etf: "XLF", label: "Financials" });
    expect(sectorEtfFor(null)).toBeNull();
    expect(fmtMarketCap(3_250_000_000_000)).toBe("$3.25T");
    expect(fmtMarketCap(45_600_000_000)).toBe("$45.6B");
  });

  it("finds the biggest single-day moves in the lookback window", () => {
    const bars = makeBars([100, 101, 95, 96, 103, 103]);
    const big = notableDays(bars, 30, 3, [{ title: "Product launch", date: "2025-01-05", publisher: "Reuters", url: "https://example.com/a" }]);
    expect(big.length).toBe(2);
    expect(Math.abs(big[0].changePct)).toBeGreaterThan(5);
    expect(big.find((d) => d.day === "2025-01-05")?.headline?.title).toBe("Product launch");
  });

  it("keeps templateBrief valid against guard when SPY and volume facts are present", () => {
    const f = buildFact({ symbol: "AAPL", price: 95, previousClose: 100, yearHigh: 120, yearLow: 80, asOf: "2026-11-10" }, null, "2026-11-10", 3);
    f.spyChangePct = -0.8;
    f.volumeRatio = 2.4;
    const sheet = factSheet([f]);
    const out = templateBrief([f]);
    expect(validateBrief(out, [f], sheet)).toEqual([]);
  });
});
