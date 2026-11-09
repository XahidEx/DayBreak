import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Used by uptime monitors. 503 if the DB is down, or no successful brief run in the last 76 hours. */
export async function GET() {
  try {
    const [last] = await sql`SELECT status, finished_at FROM job_runs WHERE status = 'ok' ORDER BY finished_at DESC LIMIT 1`;
    const [anyUser] = await sql`SELECT 1 AS x FROM users LIMIT 1`;
    const ageH = last ? (Date.now() - new Date(last.finished_at).getTime()) / 3_600_000 : null;
    const stale = !!anyUser && (ageH === null || ageH > 76); // briefs run Tue-Sat, so the longest normal gap is Sat to Tue (~72h)
    return Response.json({ ok: !stale, lastSuccessHoursAgo: ageH }, { status: stale ? 503 : 200 });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
