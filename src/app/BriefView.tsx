import Link from "next/link";
import { fmtPct } from "@/lib/facts";
import type { BriefBody } from "@/lib/generate";

export function BriefView({ body, alertIds, date }: { body: BriefBody; alertIds?: Record<string, number>; date?: string }) {
  return (
    <>
      {date && <p className="mute">{date}</p>}
      <p style={{ fontSize: 18 }}>{body.greeting}</p>
      {body.stocks.map((s) => (
        <div key={s.symbol} className="card alert">
          <strong>{s.symbol}</strong>{" "}
          <span className={s.changePct >= 0 ? "up" : "down"}>{fmtPct(s.changePct)}</span>
          <p>{s.whatHappened}</p>
          <p><em>Why it may matter:</em> {s.whyItMayMatter}</p>
          <p><em>Be careful:</em> {s.caution}</p>
          <Link className="mute" href={`/paper?symbol=${s.symbol}${alertIds?.[s.symbol] ? `&alert=${alertIds[s.symbol]}` : ""}`}>Note a paper idea →</Link>
        </div>
      ))}
      {body.stocks.length > 0 && body.quietSymbols.length > 0 && <p className="mute">Quiet: {body.quietSymbols.join(", ")}</p>}
      {body.notes.map((n, i) => <p key={i} className="mute">Note: {n}</p>)}
    </>
  );
}
