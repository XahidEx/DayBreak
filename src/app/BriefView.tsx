import Link from "next/link";
import { fmtPct } from "@/lib/facts";
import type { BriefBody } from "@/lib/generate";
import type { StockFact } from "@/lib/facts";
import { RangeBar, Sparkline } from "./charts";

export function BriefView({ body, alertIds, facts, series }: { body: BriefBody; alertIds?: Record<string, number>; facts?: StockFact[]; series?: Record<string, number[]> }) {
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
          {facts?.find((f) => f.symbol === s.symbol) && (
            <div className="stock-viz">
              <Sparkline values={series?.[s.symbol] ?? []} />
              {(() => { const f = facts.find((x) => x.symbol === s.symbol)!; return <RangeBar price={f.price} low={f.yearLow} high={f.yearHigh} />; })()}
            </div>
          )}
          <div className="stock-body" style={{ paddingTop: 14 }}>
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
