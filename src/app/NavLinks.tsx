"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["/", "Today"],
  ["/briefs", "History"],
  ["/paper", "Paper ideas"],
] as const;

export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {links.map(([href, label]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? "active" : ""}>
            {label}
          </Link>
        );
      })}
    </>
  );
}
