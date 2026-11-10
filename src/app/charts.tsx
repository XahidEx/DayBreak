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
