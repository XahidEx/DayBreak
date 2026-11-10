import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "./ActionForm";
import { BriefView, greetingFor } from "./BriefView";
import { CountUp } from "./CountUp";
import { RangeBar, Sparkline } from "./charts";
import { loadBars } from "@/lib/history";
import { snapshot } from "@/lib/indicators";
import { scoreSnapshot, stability, type Label } from "@/lib/signal";
import type { StockFact } from "@/lib/facts";
import { fmtPct } from "@/lib/facts";
import { addSymbol, generateNow, removeSymbol } from "./actions";

export const dynamic = "force-dynamic";

const labelTone = (l: Label) => (l === "Strong Buy" || l === "Buy" ? "up" : l === "Neutral" ? "" : "down");

export default async function Today() {
  const user = await requireUser();
  const [brief] = await sql`SELECT id, to_char(brief_date,'FMDay, FMDD FMMonth') AS d, status, headline, body, facts FROM briefs WHERE user_id = ${user.id} ORDER BY brief_date DESC LIMIT 1`;
  const alerts = brief ? await sql`SELECT id, symbol FROM brief_alerts WHERE brief_id = ${brief.id} ORDER BY id DESC` : [];
  const alertIds = Object.fromEntries(alerts.map((a) => [a.symbol, a.id as number]));
  const list = await sql`SELECT symbol, target_low, target_high FROM watchlist WHERE user_id = ${user.id} ORDER BY symbol`;
  const targets = new Map<string, { low: number | null; high: number | null }>(
    list.map((r) => [r.symbol as string, { low: r.target_low as number | null, high: r.target_high as number | null }]),
  );
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: user.timezone }).format(new Date()));
  const n = brief?.body?.stocks?.length ?? 0;
  const facts: StockFact[] = brief?.facts ?? [];
  // price history per symbol from the daily snapshots already stored with each brief (oldest first)
  const past = await sql`SELECT facts FROM (SELECT facts, brief_date FROM briefs WHERE user_id = ${user.id} ORDER BY brief_date DESC LIMIT 30) t ORDER BY brief_date`;
  const series = new Map<string, number[]>();
  for (const r of past) for (const f of r.facts as StockFact[]) series.set(f.symbol, [...(series.get(f.symbol) ?? []), f.price]);
  const [{ open }] = await sql`SELECT count(*)::int AS open FROM paper_ideas WHERE user_id = ${user.id} AND closed_at IS NULL`;
  const mover = [...facts].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))[0];
  const avg = facts.length ? facts.reduce((s, f) => s + f.changePct, 0) / facts.length : null;
  const hints = new Map<string, { label: Label; stab: string | null; stabTone: string }>();
  await Promise.all(
    facts.map(async (f) => {
      const bars = await loadBars(f.symbol);
      if (bars.length >= 2) series.set(f.symbol, bars.slice(-30).map((b) => b.close));
      const snap = snapshot(bars);
      if (!snap) return;
      const sig = scoreSnapshot(snap);
      const st = stability(bars, snap);
      hints.set(f.symbol, { label: sig.label, stab: st?.label ?? null, stabTone: st ? (st.tone === "flat" ? "" : st.tone) : "" });
    }),
  );

  return (
    <>
      <section className="hero">
        <div className="date">{brief ? brief.d : "Welcome"}</div>
        <h1>{greetingFor(hour)} {"\u2600"}</h1>
        <p>
          {!brief
            ? "No brief yet. Add a few stocks below and your first note will arrive tomorrow morning."
            : n === 0
              ? "Nothing to worry about overnight. Enjoy your day."
              : `${n} thing${n > 1 ? "s" : ""} worth knowing about today.`}
        </p>
        {brief && (
          <div className="badges">
            <span className="badge">{list.length} watched</span>
            <span className="badge">{n === 0 ? "All quiet" : `${n} alert${n > 1 ? "s" : ""}`}</span>
          </div>
        )}
      </section>

      <div className="kpis">
        <div className="kpi"><div className="k">Watching</div><div className="v"><CountUp value={list.length} /></div><div className="s">symbols on your list</div></div>
        <div className="kpi"><div className="k">Alerts today</div><div className="v"><CountUp value={n} /></div><div className="s">{brief ? (n === 0 ? "all quiet" : "worth a look") : "no brief yet"}</div></div>
        <div className="kpi"><div className="k">Average move</div><div className={`v ${avg === null ? "" : avg >= 0 ? "up" : "down"}`}>{avg === null ? "n/a" : <CountUp value={avg} decimals={1} prefix="+" suffix="%" />}</div><div className="s">{mover ? `biggest: ${mover.symbol} ${fmtPct(mover.changePct)}` : "after your first brief"}</div></div>
        <div className="kpi"><div className="k">Open paper ideas</div><div className="v"><CountUp value={open} /></div><div className="s">tracked, not traded</div></div>
      </div>

      {brief && <BriefView body={brief.body} alertIds={alertIds} facts={facts} series={Object.fromEntries(series)} />}

      {facts.length > 0 && (
        <>
          <h2>Your watchlist at a glance</h2>
          <div className="tiles">
            {facts.map((f) => {
              const h = hints.get(f.symbol);
              const t = targets.get(f.symbol);
              return (
                <div key={f.symbol} className="card tile">
                  <div className="tile__top"><Link href={`/stock/${f.symbol}`} className="sym">{f.symbol}</Link><span className={`pill ${f.changePct >= 0 ? "up" : "down"}`}>{fmtPct(f.changePct)}</span></div>
                  <div className="tile__px">${f.price.toFixed(2)}</div>
                  {(h || (t && (t.low !== null || t.high !== null))) && (
                    <div className="row" style={{ marginTop: 6, gap: 6 }}>
                      {h && <span className={`pill ${labelTone(h.label)}`} style={{ fontSize: 12, padding: "2px 9px" }}>{h.label}</span>}
                      {h?.stab && <span className={`pill ${h.stabTone}`} style={{ fontSize: 12, padding: "2px 9px" }}>{h.stab}</span>}
                      {t && t.low !== null && (
                        <span className={`pill ${f.price <= t.low ? "up" : ""}`} style={{ fontSize: 12, padding: "2px 9px" }} title="Low watch price">
                          ≤ ${t.low.toFixed(2)}
                        </span>
                      )}
                      {t && t.high !== null && (
                        <span className={`pill ${f.price >= t.high ? "down" : ""}`} style={{ fontSize: 12, padding: "2px 9px" }} title="High watch price">
                          ≥ ${t.high.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                  <Sparkline values={series.get(f.symbol) ?? []} />
                  <RangeBar price={f.price} low={f.yearLow} high={f.yearHigh} />
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2>Your watchlist</h2>
      <div className="chips">
        {list.map((r) => (
          <form key={r.symbol} action={removeSymbol} className="chip">
            <input type="hidden" name="symbol" value={r.symbol} />
            <Link href={`/stock/${r.symbol}`} style={{ color: "inherit", textDecoration: "none" }}>
              {r.symbol}
              {(r.target_low !== null || r.target_high !== null) && (
                <span className="mute" style={{ fontSize: 12, fontWeight: 500, marginLeft: 5 }}>
                  {[r.target_low !== null ? `≤$${Number(r.target_low).toFixed(0)}` : "", r.target_high !== null ? `≥$${Number(r.target_high).toFixed(0)}` : ""].filter(Boolean).join(" ")}
                </span>
              )}
            </Link>
            <button aria-label={`Remove ${r.symbol}`}>{"\u00d7"}</button>
          </form>
        ))}
        {list.length === 0 && <span className="mute">Nothing here yet. Add your first stock below.</span>}
      </div>
      <ActionForm action={addSymbol} className="row">
        <input name="symbol" placeholder="Add a symbol, e.g. AAPL" maxLength={10} required />
        <button>Add</button>
      </ActionForm>

      <h2>Try it now</h2>
      <form action={generateNow} className="row">
        <button className="ghost">Generate a brief now</button>
        <label className="mute"><input type="checkbox" name="email" /> also email it</label>
      </form>
    </>
  );
}
