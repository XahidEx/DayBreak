"use client";

import { useEffect, useRef, useState } from "react";

/** Number that eases up from zero when it appears. Renders the final value without JS or with reduced motion. */
export function CountUp({ value, decimals = 0, prefix = "", suffix = "" }: { value: number; decimals?: number; prefix?: string; suffix?: string }) {
  const [v, setV] = useState(value);
  const raf = useRef(0);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now(), dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(value * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    setV(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  const sign = prefix === "+" && value < 0 ? "" : prefix;
  return <>{sign}{v.toFixed(decimals)}{suffix}</>;
}
