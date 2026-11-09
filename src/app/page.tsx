import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "./ActionForm";
import { BriefView, greetingFor } from "./BriefView";
import { addSymbol, generateNow, removeSymbol } from "./actions";

export const dynamic = "force-dynamic";

export default async function Today() {
  const user = await requireUser();
  const [brief] = await sql`SELECT id, to_char(brief_date,'FMDay, FMDD FMMonth') AS d, status, headline, body FROM briefs WHERE user_id = ${user.id} ORDER BY brief_date DESC LIMIT 1`;
  const alerts = brief ? await sql`SELECT id, symbol FROM brief_alerts WHERE brief_id = ${brief.id} ORDER BY id DESC` : [];
  const alertIds = Object.fromEntries(alerts.map((a) => [a.symbol, a.id as number]));
  const list = await sql`SELECT symbol FROM watchlist WHERE user_id = ${user.id} ORDER BY symbol`;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: user.timezone }).format(new Date()));
  const n = brief?.body?.stocks?.length ?? 0;

  return (
    <>
      <section className="hero">
        <div className="date">{brief ? brief.d : "Welcome"}</div>
        <h1>{greetingFor(hour)} ☀</h1>
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

      {brief && <BriefView body={brief.body} alertIds={alertIds} />}

      <h2>Your watchlist</h2>
      <div className="chips">
        {list.map((r) => (
          <form key={r.symbol} action={removeSymbol} className="chip">
            <input type="hidden" name="symbol" value={r.symbol} />
            {r.symbol}
            <button aria-label={`Remove ${r.symbol}`}>×</button>
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
