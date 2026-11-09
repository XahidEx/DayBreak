import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BriefView } from "../../BriefView";

export const dynamic = "force-dynamic";

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const [b] = await sql`SELECT id, to_char(brief_date,'FMDay, FMDD FMMonth YYYY') AS d, body FROM briefs WHERE id = ${Number(id) || 0} AND user_id = ${user.id}`;
  if (!b) notFound();
  const alerts = await sql`SELECT id, symbol FROM brief_alerts WHERE brief_id = ${b.id} ORDER BY id DESC`;
  return (
    <>
      <Link href="/briefs" className="mute">← All briefs</Link>
      <h1>{b.d}</h1>
      {b.body.stocks.length > 0 && <p style={{ fontSize: 17 }}>{b.body.greeting}</p>}
      <BriefView body={b.body} alertIds={Object.fromEntries(alerts.map((a) => [a.symbol, a.id as number]))} />
    </>
  );
}
