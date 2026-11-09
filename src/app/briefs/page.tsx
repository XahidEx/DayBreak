import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function History() {
  const user = await requireUser();
  const rows = await sql`SELECT id, to_char(brief_date,'YYYY-MM-DD') AS d, status, headline, email_sent FROM briefs WHERE user_id = ${user.id} ORDER BY brief_date DESC LIMIT 90`;
  const jobs = await sql`SELECT status, started_at, detail FROM job_runs ORDER BY id DESC LIMIT 5`;
  return (
    <>
      <h1>Past briefs</h1>
      {rows.length === 0 && <p className="mute">Nothing yet.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card">
          <Link href={`/briefs/${r.id}`}><strong>{r.d}</strong></Link> <span className="mute">{r.status}{r.email_sent ? "" : " · not emailed"}</span>
          <div>{r.headline}</div>
        </div>
      ))}
      <h2>Morning job status</h2>
      <table><tbody>
        {jobs.map((j, i) => (
          <tr key={i}><td>{new Date(j.started_at).toLocaleString()}</td><td className={j.status === "failed" ? "down" : ""}>{j.status}</td><td className="mute">{j.detail}</td></tr>
        ))}
      </tbody></table>
    </>
  );
}
