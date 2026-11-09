import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { logout } from "./actions";
import { DISCLAIMER } from "@/lib/mail";
import "./globals.css";

export const metadata: Metadata = { title: "DayBreak", description: "A calm morning note on your watchlist. Information only." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/" className="logo">☀ DayBreak</Link>
          {user && (
            <nav>
              <Link href="/">Today</Link>
              <Link href="/briefs">History</Link>
              <Link href="/paper">Paper ideas</Link>
              <form action={logout}><button className="link">Log out</button></form>
            </nav>
          )}
        </header>
        <main>{children}</main>
        <footer>{DISCLAIMER}</footer>
      </body>
    </html>
  );
}
