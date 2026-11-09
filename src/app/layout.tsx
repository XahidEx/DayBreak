import type { Metadata } from "next";
import Link from "next/link";
import { getUser } from "@/lib/auth";
import { logout } from "./actions";
import { DISCLAIMER } from "@/lib/mail";
import { NavLinks } from "./NavLinks";
import { Sun } from "./Sun";
import "./globals.css";

export const metadata: Metadata = { title: "DayBreak", description: "A calm morning note on your watchlist. Information only." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/" className="logo"><Sun /> DayBreak</Link>
          {user && (
            <nav>
              <NavLinks />
              <form action={logout}><button className="link" style={{ marginLeft: 8 }}>Log out</button></form>
            </nav>
          )}
        </header>
        <main>{children}</main>
        <footer>{DISCLAIMER}</footer>
      </body>
    </html>
  );
}
