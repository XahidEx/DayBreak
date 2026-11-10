"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { addSymbol, generateNow, logout } from "./actions";
import { Sun } from "./Sun";

const I = {
  today: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  paper: <><path d="M4 19V5M4 19h16" /><path d="M8 15l4-5 3 3 5-7" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  sunny: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" /></>,
  fold: <path d="M15 5l-7 7 7 7" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  out: <><path d="M9 4H5v16h4" /><path d="M16 8l4 4-4 4M20 12H9" /></>,
};
const Ico = ({ n }: { n: keyof typeof I }) => <svg viewBox="0 0 24 24" aria-hidden="true">{I[n]}</svg>;

const links = [
  ["/", "Today", "today"],
  ["/briefs", "History", "history"],
  ["/paper", "Paper ideas", "paper"],
] as const;

type Theme = "system" | "light" | "dark";
const applyTheme = (t: Theme) => {
  document.documentElement.dataset.theme = t === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : t;
};

export function Shell({ user, disclaimer, children }: { user: boolean; disclaimer: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [rail, setRail] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => { setIsDark(document.documentElement.dataset.theme === "dark"); }, [theme]);
  useEffect(() => {
    setRail(document.documentElement.classList.contains("rail"));
    setTheme((localStorage.getItem("daybreak:theme") as Theme) || "system");
  }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => theme === "system" && applyTheme("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, []);

  const toggleRail = () => {
    const next = !rail;
    setRail(next);
    document.documentElement.classList.toggle("rail", next);
    localStorage.setItem("daybreak:rail", next ? "1" : "0");
  };
  const cycleTheme = useCallback(() => {
    const dark = document.documentElement.dataset.theme === "dark";
    const next: Theme = dark ? "light" : "dark";
    const go = () => { setTheme(next); localStorage.setItem("daybreak:theme", next); applyTheme(next); };
    // soft cross-fade where the browser supports view transitions
    (document as any).startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches ? (document as any).startViewTransition(go) : go();
  }, []);

  if (!user)
    return (
      <div className="page solo">
        <main>{children}</main>
        <footer>{disclaimer}</footer>
      </div>
    );

  return (
    <>
      <aside className="side">
        <div className="side__head">
          <Link href="/" className="logo"><Sun /> <b>DayBreak</b></Link>
          <button className="icon-btn" onClick={toggleRail} aria-label={rail ? "Expand sidebar" : "Collapse sidebar"} style={{ transform: rail ? "scaleX(-1)" : undefined }}><Ico n="fold" /></button>
        </div>
        <nav className="nav">
          {links.map(([href, label, icon]) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={active ? "active" : ""} title={label} aria-current={active ? "page" : undefined}>
                <Ico n={icon} /><span className="label-t">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="side__foot">
          <button className="side-btn" onClick={() => setOpen(true)} title="Search and commands"><Ico n="search" /><span className="label-t">Search</span><kbd className="kbd">Ctrl K</kbd></button>
          <button className="side-btn" onClick={cycleTheme} title="Switch light or dark"><Ico n={isDark ? "sunny" : "moon"} /><span className="label-t">Theme</span></button>
          <form action={logout}><button className="side-btn" style={{ width: "100%" }} title="Log out"><Ico n="out" /><span className="label-t">Log out</span></button></form>
        </div>
      </aside>
      <div className="page">
        <main key={path}>{children}</main>
        <footer>{disclaimer}</footer>
      </div>
      {open && <Palette onClose={() => setOpen(false)} go={(h) => { setOpen(false); router.push(h); }} toggleTheme={cycleTheme} />}
    </>
  );
}

type Cmd = { id: string; label: string; hint?: string; icon: keyof typeof I; run: () => void | Promise<void> };

function Palette({ onClose, go, toggleTheme }: { onClose: () => void; go: (href: string) => void; toggleTheme: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);

  const symbol = q.trim().toUpperCase();
  const looksLikeSymbol = /^[A-Z][A-Z.\-]{0,9}$/.test(symbol);

  const cmds = useMemo<Cmd[]>(() => {
    const base: Cmd[] = [
      { id: "today", label: "Go to Today", icon: "today", run: () => go("/") },
      { id: "history", label: "Go to History", icon: "history", run: () => go("/briefs") },
      { id: "paper", label: "Go to Paper ideas", icon: "paper", run: () => go("/paper") },
      { id: "gen", label: "Generate a brief now", hint: "runs the morning job", icon: "bolt", run: async () => { setBusy(true); await generateNow(new FormData()); } },
      { id: "theme", label: "Switch light / dark", icon: "moon", run: () => { toggleTheme(); onClose(); } },
    ];
    const add: Cmd[] = looksLikeSymbol
      ? [
          {
            id: "view",
            label: `Open ${symbol} analysis →`,
            hint: "chart, indicators & why it moved",
            icon: "search",
            run: () => go(`/stock/${symbol}`),
          },
          {
            id: "add", label: `Add ${symbol} to watchlist`, hint: "checks the ticker first", icon: "plus",
            run: async () => {
              setBusy(true); setMsg(null);
              const fd = new FormData(); fd.set("symbol", symbol);
              const err = await addSymbol(null, fd);
              setBusy(false);
              if (err) return setMsg({ t: err, bad: true });
              router.refresh(); onClose();
            },
          },
        ]
      : [];
    const f = q.trim().toLowerCase();
    return [...add, ...base.filter((c) => !f || c.label.toLowerCase().includes(f))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => setSel(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => (s + 1) % Math.max(cmds.length, 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => (s - 1 + cmds.length) % Math.max(cmds.length, 1)); }
    else if (e.key === "Enter" && cmds[sel] && !busy) { e.preventDefault(); void cmds[sel].run(); }
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pal" role="dialog" aria-label="Command palette" onKeyDown={onKey}>
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setMsg(null); }} placeholder="Type a symbol to add it, or search commands" aria-label="Command" />
        <ul>
          {cmds.map((c, i) => (
            <li key={c.id} className={i === sel ? "on" : ""} onMouseEnter={() => setSel(i)} onClick={() => !busy && void c.run()}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{I[c.icon]}</svg>{c.label}{c.hint && <small>{c.hint}</small>}
            </li>
          ))}
          {cmds.length === 0 && <li style={{ cursor: "default" }}>No matches</li>}
        </ul>
        {(busy || msg) && <div className={`msg ${msg?.bad ? "bad" : ""}`} role="status">{busy ? "Working..." : msg?.t}</div>}
      </div>
    </div>
  );
}
