import { useId } from "react";

/** Tiny price line from stored daily snapshots. Renders nothing until there are two points. */
export function Sparkline({ values }: { values: number[] }) {
  const id = useId();
  if (values.length < 2) return <div className="mute" style={{ fontSize: 12, margin: "8px 0 4px" }}>Trend appears after a few briefs.</div>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const W = 200, H = 44;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * W, H - 4 - ((v - min) / span) * (H - 8)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg className={`spark ${up ? "up" : "down"}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Price trend over ${values.length} briefs`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={up ? "var(--up)" : "var(--down)"} stopOpacity=".28" />
          <stop offset="1" stopColor={up ? "var(--up)" : "var(--down)"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="area" d={`${d} L${W} ${H} L0 ${H} Z`} fill={`url(#${id})`} />
      <path className="line" d={d} pathLength={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Where the price sits between its 52-week low and high. */
export function RangeBar({ price, low, high }: { price: number; low: number; high: number }) {
  if (!(high > low)) return null;
  const pos = Math.min(100, Math.max(0, ((price - low) / (high - low)) * 100));
  return (
    <div className="range" title={`${pos.toFixed(0)}% of the way up its 52-week range`}>
      <div className="range__bar"><span className="range__dot" style={{ left: `${pos}%` }} /></div>
      <div className="range__lbl"><span>${low.toFixed(2)}</span><span>52-week range</span><span>${high.toFixed(2)}</span></div>
    </div>
  );
}

/** Full price chart with optional 50/200-day average lines. Server-renderable, no JS needed. */
export function PriceChart({ days, close, sma50, sma200 }: { days: string[]; close: number[]; sma50: (number | null)[]; sma200: (number | null)[] }) {
  if (close.length < 2) return <div className="mute">Not enough history yet.</div>;
  const all = [...close, ...sma50, ...sma200].filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(...all), max = Math.max(...all), span = max - min || 1;
  const W = 800, H = 280, P = 6;
  const x = (i: number) => (i / (close.length - 1)) * W;
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const path = (s: (number | null)[]) => {
    let d = "", pen = false;
    s.forEach((v, i) => { if (v === null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `; pen = true; });
    return d;
  };
  const up = close[close.length - 1] >= close[0];
  const line = path(close);
  return (
    <div>
      <svg className={`spark ${up ? "up" : "down"}`} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 280 }} role="img" aria-label="Price history chart">
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={up ? "var(--up)" : "var(--down)"} opacity=".12" />
        <path d={path(sma200)} fill="none" stroke="var(--mute)" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <path d={path(sma50)} fill="none" stroke="var(--mute)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        <path d={line} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="range__lbl"><span>{days[0]} · ${close[0].toFixed(2)}</span><span>solid: 50-day avg · dashed: 200-day avg</span><span>{days[days.length - 1]} · ${close[close.length - 1].toFixed(2)}</span></div>
    </div>
  );
}
