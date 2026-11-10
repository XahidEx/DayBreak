import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadBars, syncHistory } from "@/lib/history";
import { readings, snapshot, sma, type Bar } from "@/lib/indicators";
import { PriceChart } from "../../charts";

export const dynamic = "force-dynamic";

const RANGES = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "5Y": 1260 } as const;
type Range = keyof typeof RANGES;

const pct = (n: number | null) => (n === null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);
const tone = (n: number | null) => (n === null ? "" : n >= 0 ? "up" : "down");

function rollingSma(bars: Bar[], n: number): (number | null)[] {
  const close = bars.map((b) => b.close);
  return close.map((_, i) => (i + 1 < n ? null : sma(close.slice(0, i + 1), n)));
}

export default async function Stock({ params, searchParams }: { params: Promise<{ symbol: string }>; searchParams: Promise<{ range?: string }> }) {
  await requireUser();
  const symbol = decodeURIComponent((await params).symbol).toUpperCase();
  if (!/^[A-Z.\-]{1,10}$/.test(symbol)) notFound();
  const sp = await searchParams;
  const range: Range = sp.range && sp.range in RANGES ? (sp.range as Range) : "1Y";

  let error: string | null = null;
  try {
    await syncHistory(symbol);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const bars = await loadBars(symbol);
  if (bars.length < 2) {
    return (
      <>
        <h1>{symbol}</h1>
        <div className="card"><p>No price history could be loaded.</p>{error && <p className="mute">{error}</p>}</div>
      </>
    );
  }

  const snap = snapshot(bars)!;
  const slice = bars.slice(-RANGES[range]);
  const s50 = rollingSma(bars, 50).slice(-slice.length);
  const s200 = rollingSma(bars, 200).slice(-slice.length);
  const read = readings(snap);
  const periodRet = ((slice[slice.length - 1].close - slice[0].close) / slice[0].close) * 100;
  const hi = Math.max(...slice.map((b) => b.high)), lo = Math.min(...slice.map((b) => b.low));

  return (
    <>
      <h1>{symbol} <span className={`pill ${tone(snap.ret.d1)}`}>{pct(snap.ret.d1)}</span></h1>
      <p className="mute">${snap.price.toFixed(2)} as of {snap.asOf} · {snap.bars} days of history stored{error ? ` · refresh failed: ${error}` : ""}</p>

      <div className="row">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <Link key={r} href={`/stock/${symbol}?range=${r}`} className={r === range ? "pill" : "mute"} style={{ padding: "4px 12px" }}>{r}</Link>
        ))}
      </div>
      <div className="card">
        <PriceChart days={slice.map((b) => b.day)} close={slice.map((b) => b.close)} sma50={s50} sma200={s200} />
        <p className="mute" style={{ marginBottom: 0 }}>{range}: <b className={tone(periodRet)}>{pct(periodRet)}</b> · high ${hi.toFixed(2)} · low ${lo.toFixed(2)}</p>
      </div>

      <h2>Performance</h2>
      <div className="kpis">
        {([["1 week", snap.ret.w1], ["1 month", snap.ret.m1], ["3 months", snap.ret.m3], ["6 months", snap.ret.m6], ["1 year", snap.ret.y1]] as const).map(([k, v]) => (
          <div key={k} className="kpi"><div className="k">{k}</div><div className={`v ${tone(v)}`}>{pct(v)}</div></div>
        ))}
      </div>

      <h2>What the indicators say</h2>
      <p className="mute">Descriptions of the past price pattern. They do not predict what happens next.</p>
      {read.map((r) => (
        <div key={r.label} className="card" style={{ margin: "8px 0", padding: "12px 18px" }}>
          <div className="row" style={{ marginTop: 0, justifyContent: "space-between" }}>
            <b>{r.label}</b><span className={`pill ${r.tone === "flat" ? "" : r.tone}`}>{r.value}</span>
          </div>
          <div className="mute">{r.note}</div>
        </div>
      ))}
    </>
  );
}
