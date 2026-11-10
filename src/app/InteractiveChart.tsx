"use client";

import { useState } from "react";

type Props = {
  days: string[];
  close: number[];
  volume: number[];
  sma50: (number | null)[];
  sma200: (number | null)[];
};

const W = 800, H = 280, P = 10;

/** Price chart with live scrub header, volume bars, and distinct 50/200-day average lines. */
export function InteractiveChart({ days, close, volume, sma50, sma200 }: Props) {
  const [i, setI] = useState<number | null>(null);
  if (close.length < 2) return <div className="mute">Not enough history yet.</div>;

  const all = [...close, ...sma50, ...sma200].filter((v): v is number => v !== null && Number.isFinite(v));
  const min = Math.min(...all), max = Math.max(...all), span = max - min || 1;
  const maxVol = Math.max(...volume, 1);
  const n = close.length;
  const x = (k: number) => (k / (n - 1)) * W;
  const y = (v: number) => H - P - ((v - min) / span) * (H - 2 * P);
  const path = (s: (number | null)[]) => {
    let d = "", pen = false;
    s.forEach((v, k) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(k).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
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
  const barW = Math.max(1.5, Math.min(8, (W / n) * 0.65));

  return (
    <div>
      <div className="chart-head">
        <div>
          <div className="chart-head__px">
            ${close[k].toFixed(2)}{" "}
            {chg !== null && (
              <span className={`pill ${chg >= 0 ? "up" : "down"}`} style={{ fontSize: 12, padding: "2px 9px" }}>
                {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="mute" style={{ fontSize: 12.5 }}>
            {days[k]} · Vol {volume[k].toLocaleString("en-US")}
          </div>
        </div>
        <div className="chart-legend">
          {sma50[k] !== null && (
            <span>
              <i className="leg-dot" style={{ background: "var(--accent)" }} />
              50d ${sma50[k]!.toFixed(2)}
            </span>
          )}
          {sma200[k] !== null && (
            <span>
              <i className="leg-dot" style={{ background: "var(--sma200)" }} />
              200d ${sma200[k]!.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      <div
        style={{ position: "relative", touchAction: "pan-y", cursor: "crosshair" }}
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={() => setI(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: 260, display: "block" }} role="img" aria-label="Price history chart">
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity=".22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {volume.map((v, idx) => {
            const vh = (v / maxVol) * (H * 0.18);
            return (
              <rect
                key={idx}
                x={x(idx) - barW / 2}
                y={H - vh}
                width={barW}
                height={vh}
                fill="var(--mute)"
                opacity={i === idx ? 0.45 : 0.14}
              />
            );
          })}
          <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#chart-fill)" />
          <path d={path(sma200)} fill="none" stroke="var(--sma200)" strokeWidth="1.6" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
          <path d={path(sma50)} fill="none" stroke="var(--accent)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" vectorEffect="non-scaling-stroke" />
          {i !== null && <line x1={x(k)} x2={x(k)} y1={0} y2={H} stroke="var(--mute)" strokeWidth="1" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />}
        </svg>
        {i !== null && (
          <div
            style={{
              position: "absolute",
              left: `${leftPct}%`,
              top: `${topPct}%`,
              width: 11,
              height: 11,
              borderRadius: 99,
              background: color,
              border: "2.5px solid var(--bg)",
              boxShadow: "0 0 0 2px var(--edge)",
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
      <div className="range__lbl">
        <span>{days[0]} · ${close[0].toFixed(2)}</span>
        <span>drag or hover to inspect</span>
        <span>{days[n - 1]} · ${close[n - 1].toFixed(2)}</span>
      </div>
    </div>
  );
}
