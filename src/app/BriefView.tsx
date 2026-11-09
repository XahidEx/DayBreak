import Link from "next/link";
import { fmtPct } from "@/lib/facts";
import type { BriefBody } from "@/lib/generate";

export function BriefView({ body, alertIds }: { body: BriefBody; alertIds?: Record<string, number> }) {
  const quiet = body.stocks.length === 0;
  return (
    <>
      {quiet && (
        <div className="card quiet-card">
          <div className="big">🌤</div>
          <p>{body.greeting}</p>
          {body.quietSymbols.length > 0 && <p className="mute">Checked: {body.quietSymbols.join(", ")}</p>}
        </div>
      )}
      {body.stocks.map((s) => (
        <div key={s.symbol} className="card stock">
          <div className="stock-head">
            <div className="avatar">{s.symbol.slice(0, 4)}</div>
            <div className="grow"><div className="sym">{s.symbol}</div></div>
            <span className={`pill ${s.changePct >= 0 ? "up" : "down"}`}>{fmtPct(s.changePct)}</span>
          </div>
          <div className="stock-body">
            <div><div className="label">What happened</div><p>{s.whatHappened}</p></div>
            <div><div className="label">Why it may matter</div><p>{s.whyItMayMatter}</p></div>
            <div className="caution"><div className="label">Be careful</div><p>{s.caution}</p></div>
            <Link className="cta" href={`/paper?symbol=${s.symbol}${alertIds?.[s.symbol] ? `&alert=${alertIds[s.symbol]}` : ""}`}>Note a paper idea →</Link>
          </div>
        </div>
      ))}
      {!quiet && body.quietSymbols.length > 0 && <p className="mute">Quiet overnight: {body.quietSymbols.join(", ")}</p>}
      {body.notes.map((n, i) => <p key={i} className="mute">Note: {n}</p>)}
    </>
  );
}

export function greetingFor(hour: number) {
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
