"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "@/lib/db";
import { createSession, destroySession, requireUser } from "@/lib/auth";
import { getQuote } from "@/lib/market";
import { syncHistory } from "@/lib/history";
import { syncFundamentals } from "@/lib/fundamentals";
import { generateBrief } from "@/lib/generate";
import { renderBrief, sendMail } from "@/lib/mail";

// Simple in-memory login throttle: 5 failures per 15 minutes per email.
const fails = new Map<string, { n: number; t: number }>();

export async function login(_: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").toLowerCase().trim();
  const password = String(form.get("password") ?? "");
  const f = fails.get(email);
  if (f && Date.now() - f.t < 15 * 60_000 && f.n >= 5) return "Too many attempts. Try again in a few minutes.";
  const [u] = await sql`SELECT id, password_hash FROM users WHERE email = ${email}`;
  // compare even if user is missing, to keep timing similar
  const ok = await bcrypt.compare(password, u?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!u || !ok) {
    fails.set(email, { n: (f && Date.now() - f.t < 15 * 60_000 ? f.n : 0) + 1, t: Date.now() });
    return "Wrong email or password.";
  }
  fails.delete(email);
  await createSession(u.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function addSymbol(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser();
  const symbol = String(form.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) return "That does not look like a stock symbol.";
  try {
    await getQuote(symbol);
  } catch (e) {
    console.error("addSymbol quote failed", symbol, e);
    const msg = e instanceof Error ? e.message : "unknown error";
    return /No quote data/.test(msg)
      ? `FMP returned no data for ${symbol}. Check the ticker, or it may not be covered by your FMP plan.`
      : `Could not check ${symbol}: ${msg}`;
  }
  await sql`INSERT INTO watchlist (user_id, symbol) VALUES (${user.id}, ${symbol}) ON CONFLICT DO NOTHING`;
  await Promise.all([syncHistory(symbol).catch(() => null), syncFundamentals(symbol).catch(() => null)]);
  revalidatePath("/");
  return null;
}

const optPrice = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

export async function setTargets(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser();
  const symbol = String(form.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) return "Invalid symbol.";
  const low = optPrice(form.get("targetLow"));
  const high = optPrice(form.get("targetHigh"));
  if (Number.isNaN(low) || Number.isNaN(high)) return "Watch prices must be positive numbers.";
  if (low !== null && high !== null && low >= high) return "Low watch price must be below high watch price.";
  await sql`
    INSERT INTO watchlist (user_id, symbol, target_low, target_high)
    VALUES (${user.id}, ${symbol}, ${low}, ${high})
    ON CONFLICT (user_id, symbol) DO UPDATE SET target_low = EXCLUDED.target_low, target_high = EXCLUDED.target_high
  `;
  revalidatePath("/");
  revalidatePath(`/stock/${symbol}`);
  return null;
}

export async function removeSymbol(form: FormData) {
  const user = await requireUser();
  const symbol = String(form.get("symbol") ?? "").trim().toUpperCase();
  await sql`DELETE FROM watchlist WHERE user_id = ${user.id} AND symbol = ${symbol}`;
  revalidatePath("/");
  revalidatePath(`/stock/${symbol}`);
}

export async function toggleWatch(form: FormData) {
  const user = await requireUser();
  const symbol = String(form.get("symbol") ?? "").trim().toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,9}$/.test(symbol)) return;
  const [exists] = await sql`SELECT 1 FROM watchlist WHERE user_id = ${user.id} AND symbol = ${symbol}`;
  if (exists) {
    await sql`DELETE FROM watchlist WHERE user_id = ${user.id} AND symbol = ${symbol}`;
  } else {
    await sql`INSERT INTO watchlist (user_id, symbol) VALUES (${user.id}, ${symbol}) ON CONFLICT DO NOTHING`;
  }
  revalidatePath("/");
  revalidatePath(`/stock/${symbol}`);
}

export async function generateNow(form: FormData) {
  const user = await requireUser();
  const watched = await sql`SELECT symbol FROM watchlist WHERE user_id = ${user.id}`;
  await Promise.all([
    ...watched.map((r) => syncHistory(r.symbol, 6).catch(() => null)),
    syncHistory("SPY", 6).catch(() => null),
  ]);
  const brief = await generateBrief(user.id);
  if (form.get("email") === "on") {
    const m = renderBrief(brief.body, brief.briefDate);
    if (await sendMail(user.email, m.subject, m.text, m.html)) await sql`UPDATE briefs SET email_sent = true WHERE id = ${brief.id}`;
  }
  revalidatePath("/", "layout");
  redirect(`/briefs/${brief.id}`);
}

const Idea = z.object({
  symbol: z.string().regex(/^[A-Z][A-Z.\-]{0,9}$/),
  direction: z.enum(["long", "short"]),
  note: z.string().max(500),
  alertId: z.coerce.number().int().positive().optional(),
});

export async function addIdea(_: string | null, form: FormData): Promise<string | null> {
  const user = await requireUser();
  const parsed = Idea.safeParse({
    symbol: String(form.get("symbol") ?? "").trim().toUpperCase(),
    direction: form.get("direction"),
    note: String(form.get("note") ?? ""),
    alertId: form.get("alertId") || undefined,
  });
  if (!parsed.success) return "Please check the symbol and direction.";
  let price: number;
  try {
    price = (await getQuote(parsed.data.symbol)).price;
  } catch {
    return `Could not get a price for ${parsed.data.symbol}.`;
  }
  // only link an alert that belongs to this user
  const [alert] = parsed.data.alertId ? await sql`SELECT id FROM brief_alerts WHERE id = ${parsed.data.alertId} AND user_id = ${user.id}` : [];
  await sql`INSERT INTO paper_ideas (user_id, symbol, direction, entry_price, note, alert_id)
            VALUES (${user.id}, ${parsed.data.symbol}, ${parsed.data.direction}, ${price}, ${parsed.data.note}, ${alert?.id ?? null})`;
  revalidatePath("/paper");
  return null;
}

export async function closeIdea(form: FormData) {
  const user = await requireUser();
  const [idea] = await sql`SELECT symbol FROM paper_ideas WHERE id = ${Number(form.get("id"))} AND user_id = ${user.id} AND closed_at IS NULL`;
  if (!idea) return;
  const q = await getQuote(idea.symbol);
  await sql`UPDATE paper_ideas SET closed_at = now(), close_price = ${q.price} WHERE id = ${Number(form.get("id"))} AND user_id = ${user.id}`;
  revalidatePath("/paper");
}

export async function deleteIdea(form: FormData) {
  const user = await requireUser();
  await sql`DELETE FROM paper_ideas WHERE id = ${Number(form.get("id"))} AND user_id = ${user.id}`;
  revalidatePath("/paper");
}
