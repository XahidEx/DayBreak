import Link from "next/link";
import { sql } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function History() {
  const user = await requireUser();
  const rows = await sql`SELECT id, to_char(brief_date,'FMDy, FMDD FMMon YYYY') AS d, status, headline, email_sent FROM briefs WHERE user_id = ${user.id} ORDER BY brief_date DESC LIMIT 90`;
  const jobs = await sql`SELECT status, started_at, detail FROM job_runs ORDER BY id DESC LIMIT 5`;
  return (
    <>
      <h1>Past briefs</h1>
      <p className="mute">Every morning note, kept so you can look back.</p>
      {rows.length === 0 && <div className="card mute">Nothing yet. Your first brief will show up here.</div>}
      {rows.map((r) => (
        <Link key={r.id} href={`/briefs/${r.id}`} className="card history-item">
          <span className={`dot ${r.status}`} />
          <div className="grow">
            <strong>{r.d}</strong>
            <div className="mute">{r.headline}{r.email_sent ? "" : " · not emailed"}</div>
          </div>
        </Link>
      ))}
      <h2>Morning job status</h2>
      <div className="card">
        <table><tbody>
          {jobs.map((j, i) => (
            <tr key={i}><td>{new Date(j.started_at).toLocaleString()}</td><td className={j.status === "failed" ? "down" : "up"}>{j.status}</td><td className="mute">{j.detail}</td></tr>
          ))}
          {jobs.length === 0 && <tr><td className="mute">No runs yet.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
