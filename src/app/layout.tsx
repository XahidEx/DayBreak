import type { Metadata } from "next";
import { getUser } from "@/lib/auth";
import { DISCLAIMER } from "@/lib/mail";
import { Shell } from "./Shell";
import { Urbanist } from "next/font/google";
import "./globals.css";

const urbanist = Urbanist({ subsets: ["latin"], variable: "--font-urbanist", display: "swap" });

export const metadata: Metadata = { title: "DayBreak", description: "A calm morning note on your watchlist. Information only." };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  return (
    <html lang="en" className={urbanist.variable} suppressHydrationWarning>
      <head>
        {/* before first paint: saved theme and sidebar state, so a reload never flashes the wrong look */}
        <script dangerouslySetInnerHTML={{ __html: `(function(d){try{var t=localStorage.getItem("daybreak:theme")||"system";d.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;if(localStorage.getItem("daybreak:rail")==="1")d.classList.add("rail")}catch(e){}})(document.documentElement)` }} />
      </head>
      <body>
        <Shell user={!!user} disclaimer={DISCLAIMER}>{children}</Shell>
      </body>
    </html>
  );
}
