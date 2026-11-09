import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getQuote } from "@/lib/market/fmp";
import { alertScorecard, ideaReturn, ideaScorecard } from "@/lib/scorecard";
import { ActionForm } from "../ActionForm";
import { addIdea, closeIdea, deleteIdea } from "../actions";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n === null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);

export default async function Paper({ searchParams }: { searchParams: Promise<{ symbol?: string; alert?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const ideas = await sql`SELECT id, symbol, direction, entry_price, close_price, note, alert_id, to_char(opened_at,'YYYY-MM-DD') AS opened, closed_at FROM paper_ideas WHERE user_id = ${user.id} ORDER BY opened_at DESC`;
  const alerts = await sql`SELECT kind, price, symbol, EXTRACT(EPOCH FROM (now() - created_at)) / 86400 AS age FROM brief_alerts WHERE user_id = ${user.id}`;

  const symbols = [...new Set([...ideas.filter((i) => !i.closed_at).map((i) => i.symbol), ...alerts.filter((a) => Number(a.age) >= 3).map((a) => a.symbol)])];
  const prices = new Map<string, number>();
  await Promise.all(symbols.map(async (s) => { try { prices.set(s, (await getQuote(s)).price); } catch {} }));

  const rows = (ideas as any[]).map((i) => ({ ...i, current: (prices.get(i.symbol) ?? null) as number | null }));
  const idea = ideaScorecard(rows.map((r) => ({ direction: r.direction, entry_price: r.entry_price, close_price: r.close_price, current_price: r.current, has_alert: r.alert_id !== null })));
  const alert = alertScorecard(alerts.map((a) => ({ kind: a.kind, price: a.price, current_price: prices.get(a.symbol) ?? null, age_days: Number(a.age) })));

  return (
    <>
      <h1>Paper ideas</h1>
      <p className="mute">Pretend trades, no real money. Judge honestly whether the alerts helped.</p>
      <ActionForm action={addIdea} className="card">
        <div className="row">
          <input name="symbol" placeholder="Symbol" defaultValue={sp.symbol} size={8} required />
          <select name="direction"><option value="long">Long (expect up)</option><option value="short">Short (expect down)</option></select>
          <input name="note" placeholder="Why? (optional)" maxLength={500} style={{ flex: 1, minWidth: 160 }} />
          {sp.alert && <input type="hidden" name="alertId" value={sp.alert} />}
          <button>Add idea</button>
        </div>
        {sp.alert && <p className="mute">Linked to a DayBreak alert.</p>}
      </ActionForm>

      <h2>Scorecard</h2>
      <div className="stats">
        {([["All ideas", idea.all], ["From an alert", idea.fromAlerts], ["My own", idea.own]] as const).map(([n, s]) => (
          <div key={n} className="stat">
            <div className="mute">{n}</div>
            <div className={`n ${s.avgReturn === null ? "" : s.avgReturn >= 0 ? "up" : "down"}`}>{pct(s.avgReturn)}</div>
            <div className="mute">{s.count} idea{s.count === 1 ? "" : "s"} · {s.winRate === null ? "no win rate yet" : `${s.winRate.toFixed(0)}% winners`}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <p className="mute" style={{ margin: 0 }}>
          Alerts at least 3 days old: {alert.count}. {alert.count ? `The price kept moving the same way after ${alert.continuedPct!.toFixed(0)}% of them (average ${pct(alert.avgFollowThrough)}).` : "Not enough history yet."}
          {" "}Small samples are mostly noise, so give it a few weeks.
        </p>
      </div>

      <h2>Ideas</h2>
      {rows.length === 0 && <p className="mute">None yet.</p>}
      {rows.map((r) => {
        const ret = ideaReturn({ direction: r.direction, entry_price: r.entry_price, close_price: r.close_price, current_price: r.current });
        return (
          <div key={r.id} className="card">
            <div className="stock-head" style={{ padding: 0 }}>
              <div className="avatar">{r.symbol.slice(0, 4)}</div>
              <div className="grow">
                <div className="sym">{r.symbol} <span className="mute">{r.direction}</span></div>
                <div className="mute">From ${r.entry_price.toFixed(2)} on {r.opened}{r.alert_id !== null ? " · from an alert" : ""}</div>
              </div>
              <span className={`pill ${ret === null ? "" : ret >= 0 ? "up" : "down"}`}>{pct(ret)}</span>
            </div>
            <div className="mute" style={{ marginTop: 8 }}>{r.closed_at ? `Closed at $${r.close_price?.toFixed(2)}` : `Now ${r.current ? `$${r.current.toFixed(2)}` : "n/a"}`}</div>
            {r.note && <p>{r.note}</p>}
            <div className="row" style={{ marginTop: 8 }}>
              {!r.closed_at && <form action={closeIdea}><input type="hidden" name="id" value={r.id} /><button className="ghost">Close</button></form>}
              <form action={deleteIdea}><input type="hidden" name="id" value={r.id} /><button className="link">Delete</button></form>
            </div>
          </div>
        );
      })}
    </>
  );
}

