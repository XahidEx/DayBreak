import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "./ActionForm";
import { BriefView } from "./BriefView";
import { addSymbol, generateNow, removeSymbol } from "./actions";

export const dynamic = "force-dynamic";

export default async function Today() {
  const user = await requireUser();
  const [brief] = await sql`SELECT id, brief_date, body FROM briefs WHERE user_id = ${user.id} ORDER BY brief_date DESC LIMIT 1`;
  const alerts = brief ? await sql`SELECT id, symbol FROM brief_alerts WHERE brief_id = ${brief.id} ORDER BY id DESC` : [];
  const alertIds = Object.fromEntries(alerts.map((a) => [a.symbol, a.id as number]));
  const list = await sql`SELECT symbol FROM watchlist WHERE user_id = ${user.id} ORDER BY symbol`;

  return (
    <>
      <h1>Latest brief</h1>
      {brief ? (
        <BriefView body={brief.body} alertIds={alertIds} date={String(brief.brief_date instanceof Date ? brief.brief_date.toISOString().slice(0, 10) : brief.brief_date)} />
      ) : (
        <p className="mute">No brief yet. Add some stocks and generate one, or wait for tomorrow morning.</p>
      )}

      <h2>Your watchlist</h2>
      <div className="chips">
        {list.map((r) => (
          <form key={r.symbol} action={removeSymbol} className="chip">
            <input type="hidden" name="symbol" value={r.symbol} />
            {r.symbol}
            <button aria-label={`Remove ${r.symbol}`}>×</button>
          </form>
        ))}
        {list.length === 0 && <span className="mute">Nothing here yet.</span>}
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
