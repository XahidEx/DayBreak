import cron from "node-cron";
import { sql } from "../src/lib/db";
import { generateBrief, dateIn } from "../src/lib/generate";
import { syncHistory } from "../src/lib/history";
import { renderBrief, sendMail } from "../src/lib/mail";

/** Healthchecks.io-style dead-man's switch: if no success ping arrives on schedule, they email/alert you. */
async function ping(suffix: "" | "/start" | "/fail") {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return;
  try {
    await fetch(url.replace(/\/$/, "") + suffix, { signal: AbortSignal.timeout(10_000) });
  } catch (e) {
    console.error("healthcheck ping failed", e);
  }
}

export async function runDaily() {
  const [job] = await sql`INSERT INTO job_runs DEFAULT VALUES RETURNING id`;
  await ping("/start");
  const problems: string[] = [];
  try {
    // keep stored price history current for every watched symbol (a failure here must not block the brief)
    for (const r of await sql`SELECT DISTINCT symbol FROM watchlist`) {
      try { await syncHistory(r.symbol, 6); } catch (e) { console.error(`history sync failed for ${r.symbol}`, e); }
    }
    const users = await sql`SELECT id, email, timezone FROM users`;
    for (const u of users) {
      try {
        const brief = await generateBrief(u.id);
        const mail = renderBrief(brief.body, brief.briefDate);
        const sent = await sendMail(u.email, mail.subject, mail.text, mail.html);
        if (!sent) throw new Error("email not sent (SMTP not configured)");
        await sql`UPDATE briefs SET email_sent = true WHERE id = ${brief.id}`;
        console.log(`[${dateIn(u.timezone)}] brief ${brief.id} sent to ${u.email}`);
      } catch (e) {
        problems.push(`${u.email}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } catch (e) {
    problems.push(e instanceof Error ? e.message : String(e));
  }

  if (problems.length === 0) {
    await sql`UPDATE job_runs SET status='ok', finished_at=now() WHERE id=${job.id}`;
    await ping("");
  } else {
    const detail = problems.join("\n");
    console.error("Brief run failed:\n" + detail);
    await sql`UPDATE job_runs SET status='failed', finished_at=now(), detail=${detail} WHERE id=${job.id}`;
    await ping("/fail");
    const admin = process.env.ADMIN_EMAIL;
    if (admin) await sendMail(admin, "DayBreak: morning brief FAILED", detail).catch((e) => console.error("alert email failed", e));
  }
}

const schedule = process.env.BRIEF_CRON ?? "0 7 * * 2-6"; // 07:00 Tue-Sat in Gulf time = after each US trading day Mon-Fri
const tz = process.env.BRIEF_TZ ?? "Asia/Dubai";

if (process.argv.includes("--now")) {
  runDaily().then(() => process.exit(0));
} else {
  cron.schedule(schedule, () => void runDaily(), { timezone: tz });
  console.log(`DayBreak worker running. Schedule "${schedule}" (${tz})`);
}
