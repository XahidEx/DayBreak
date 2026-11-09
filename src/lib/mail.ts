import nodemailer from "nodemailer";
import type { BriefBody } from "./generate";
import { fmtPct } from "./facts";

export const DISCLAIMER = "DayBreak is information only, not financial advice. It does not tell you what to buy or sell, and nobody can predict the market.";

function transport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function renderBrief(body: BriefBody, date: string) {
  const text = [
    body.greeting,
    ...body.stocks.map((s) => `\n${s.symbol} (${fmtPct(s.changePct)})\n${s.whatHappened}\nWhy it may matter: ${s.whyItMayMatter}\nBe careful: ${s.caution}`),
    body.stocks.length && body.quietSymbols.length ? `\nQuiet: ${body.quietSymbols.join(", ")}` : "",
    ...body.notes.map((n) => `\nNote: ${n}`),
    `\n--\n${DISCLAIMER}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;color:#1c1917">
<p style="font-size:16px">${esc(body.greeting)}</p>
${body.stocks
  .map(
    (s) => `<div style="border-left:3px solid #f59e0b;padding-left:12px;margin:16px 0"><strong>${esc(s.symbol)}</strong> ${esc(fmtPct(s.changePct))}<br>${esc(s.whatHappened)}<br><em>Why it may matter:</em> ${esc(s.whyItMayMatter)}<br><em>Be careful:</em> ${esc(s.caution)}</div>`,
  )
  .join("")}
${body.stocks.length && body.quietSymbols.length ? `<p>Quiet: ${esc(body.quietSymbols.join(", "))}</p>` : ""}
${body.notes.map((n) => `<p style="color:#78716c">Note: ${esc(n)}</p>`).join("")}
<hr><p style="font-size:12px;color:#78716c">${esc(DISCLAIMER)}</p></div>`;
  return { subject: `DayBreak ${date}: ${body.stocks.length ? `${body.stocks.length} to know` : "quiet night"}`, text, html };
}

export async function sendMail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
  const t = transport();
  if (!t) {
    console.warn("SMTP not configured; email not sent");
    return false;
  }
  await t.sendMail({ from: process.env.MAIL_FROM ?? "DayBreak <daybreak@localhost>", to, subject, text, html });
  return true;
}
