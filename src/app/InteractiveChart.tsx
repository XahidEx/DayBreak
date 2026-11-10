"use client";

import { useState } from "react";

type Props = {
  days: string[];
  close: number[];
  volume: number[];
  sma50: (number | null)[];
  sma200: (number | null)[];
};

const W = 800, H = 280, P = 8;

/** Price chart with a hover crosshair that shows the date, price and averages at that point. */
export function InteractiveChart({ days, close, volume, sma50, sma200 }: Props) {
  const [i, setI] = useState<number | null>(null);
  if (close.length < 2) return <div className="mute">Not enough history yet.</div>;

  const all = [...close, ...sma50, ...sma200].filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(...all), max = Math.max(...all), span = max - min || 1;
  const n = close.length;
  const x = (k: number) => (k / (n - 1)) * W;
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const path = (s: (number | null)[]) => {
    let d = "", pen = false;
    s.forEach((v, k) => { if (v === null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(k).toFixed(1)} ${y(v).toFixed(1)} `; pen = true; });
    return d;
  };
  const up = close[n - 1] >= close[0];
  const color = up ? "var(--up)" : "var(--down)";
  const line = path(close);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const f = (e.clientX - r.left) / r.width;
    setI(Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))));
  };

  const k = i ?? n - 1;
  const prev = k > 0 ? close[k - 1] : null;
  const chg = prev ? ((close[k] - prev) / prev) * 100 : null;
  const leftPct = (k / (n - 1)) * 100;
  const topPct = (y(close[k]) / H) * 100;

  return (
    <div>
      <div
        style={{ position: "relative", touchAction: "pan-y", cursor: "crosshair" }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setI(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 280, display: "block" }} role="img" aria-label="Price history chart">
          <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={color} opacity=".12" />
          <path d={path(sma200)} fill="none" stroke="var(--mute)" strokeWidth="1.5" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <path d={path(sma50)} fill="none" stroke="var(--mute)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {i !== null && <line x1={x(k)} x2={x(k)} y1={0} y2={H} stroke="var(--mute)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {i !== null && (
          <>
            <div style={{ position: "absolute", left: `${leftPct}%`, top: `${topPct}%`, width: 10, height: 10, borderRadius: 99, background: color, border: "2px solid var(--glass)", transform: "translate(-50%, -50%)", pointerEvents: "none" }} />
            <div
              style={{
                position: "absolute", top: 8, left: `${leftPct}%`, pointerEvents: "none", whiteSpace: "nowrap",
                transform: `translateX(${leftPct > 70 ? "calc(-100% - 12px)" : "12px"})`,
                padding: "8px 12px", borderRadius: 12, fontSize: 13, lineHeight: 1.5,
                background: "var(--glass)", WebkitBackdropFilter: "blur(14px)", backdropFilter: "blur(14px)", border: "1px solid var(--line)",
              }}
            >
              <div className="mute" style={{ fontSize: 12 }}>{days[k]}</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                ${close[k].toFixed(2)}{" "}
                {chg !== null && <span className={chg >= 0 ? "up" : "down"} style={{ fontSize: 12 }}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</span>}
              </div>
              {sma50[k] !== null && <div className="mute">50-day avg ${sma50[k]!.toFixed(2)}</div>}
              {sma200[k] !== null && <div className="mute">200-day avg ${sma200[k]!.toFixed(2)}</div>}
              <div className="mute">Volume {volume[k].toLocaleString("en-US")}</div>
            </div>
          </>
        )}
      </div>
      <div className="range__lbl">
        <span>{days[0]} · ${close[0].toFixed(2)}</span>
        <span>solid: 50-day avg · dashed: 200-day avg</span>
        <span>{days[n - 1]} · ${close[n - 1].toFixed(2)}</span>
      </div>
    </div>
  );
}
