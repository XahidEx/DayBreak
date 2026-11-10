import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { compareWithMarket, notableDays, type MoveDriver } from "@/lib/explain";
import { loadBars, syncHistory } from "@/lib/history";
import { readings, snapshot, sma, type Bar } from "@/lib/indicators";
import { getHeadlines } from "@/lib/market";
import { backtest, scoreSnapshot, stability, type Label } from "@/lib/signal";
import { InteractiveChart } from "../../InteractiveChart";

export const dynamic = "force-dynamic";

const RANGES = { "1M": 21, "3M": 63, "6M": 126, "1Y": 252, "5Y": 1260 } as const;
type Range = keyof typeof RANGES;

const pct = (n: number | null) => (n === null ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`);
const tone = (n: number | null) => (n === null ? "" : n >= 0 ? "up" : "down");
const labelTone = (l: Label) => (l === "Strong Buy" || l === "Buy" ? "up" : l === "Neutral" ? "" : "down");
const driverLabel: Record<MoveDriver, string> = {
  "company-specific": "Company-specific move",
  "market-wide": "Market-wide move",
  "in-line": "Moved with market",
  quiet: "Quiet session",
};

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
  await Promise.all([
    syncHistory(symbol).catch((e) => {
      error = e instanceof Error ? e.message : String(e);
    }),
    symbol !== "SPY" ? syncHistory("SPY").catch(() => null) : Promise.resolve(),
  ]);

  const [bars, spyBars, headlines] = await Promise.all([
    loadBars(symbol),
    symbol !== "SPY" ? loadBars("SPY").catch(() => [] as Bar[]) : Promise.resolve([] as Bar[]),
    getHeadlines(symbol, 5),
  ]);

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
  const signal = scoreSnapshot(snap);
  const stab = stability(bars, snap);
  const bt = backtest(bars);
  const cmp = compareWithMarket(snap, spyBars);
  const bigDays = notableDays(bars, 30, 3);
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
        <InteractiveChart days={slice.map((b) => b.day)} close={slice.map((b) => b.close)} volume={slice.map((b) => b.volume)} sma50={s50} sma200={s200} />
        <p className="mute" style={{ marginBottom: 0 }}>{range}: <b className={tone(periodRet)}>{pct(periodRet)}</b> · high ${hi.toFixed(2)} · low ${lo.toFixed(2)}</p>
      </div>

      <h2>Why did it move? (What happened)</h2>
      <div className="card">
        <div className="row" style={{ marginTop: 0, justifyContent: "space-between" }}>
          <span className="pill">{driverLabel[cmp.driver]}</span>
          {cmp.excess1d !== null && (
            <span className={`mute ${tone(cmp.excess1d)}`}>{pct(cmp.excess1d)} vs US market (SPY)</span>
          )}
        </div>
        <p>{cmp.summary}</p>
        {cmp.volumeNote && <p className="mute">{cmp.volumeNote}</p>}
        {cmp.spy1d !== null && (
          <div className="row" style={{ gap: 16 }}>
            <span className="mute">1D: <b>{pct(cmp.stock1d)}</b> vs SPY {pct(cmp.spy1d)}</span>
            {cmp.stock1w !== null && cmp.spy1w !== null && (
              <span className="mute">1W: <b>{pct(cmp.stock1w)}</b> vs SPY {pct(cmp.spy1w)}</span>
            )}
            {cmp.stock1m !== null && cmp.spy1m !== null && (
              <span className="mute">1M: <b>{pct(cmp.stock1m)}</b> vs SPY {pct(cmp.spy1m)}</span>
            )}
          </div>
        )}

        {bigDays.length > 0 && (
          <>
            <h3 style={{ marginBottom: 4 }}>Biggest single-day moves (last 30 trading days)</h3>
            {bigDays.map((d) => (
              <div key={d.day} className="row" style={{ justifyContent: "space-between", margin: "4px 0" }}>
                <span><b>{d.day}</b> <span className="mute">· closed ${d.close.toFixed(2)}{d.volumeRatio !== null ? ` · ${d.volumeRatio.toFixed(1)}x avg volume` : ""}</span></span>
                <span className={`pill ${tone(d.changePct)}`} style={{ fontSize: 13, padding: "2px 10px" }}>{pct(d.changePct)}</span>
              </div>
            ))}
          </>
        )}

        <h3 style={{ marginBottom: 4 }}>Recent headlines</h3>
        {headlines.length === 0 ? (
          <p className="mute" style={{ marginTop: 0 }}>No recent headlines returned by the data provider.</p>
        ) : (
          headlines.map((h, i) => (
            <div key={i} style={{ margin: "6px 0" }}>
              <div>{h.title}</div>
              <div className="mute">{h.publisher} · {h.date}</div>
            </div>
          ))
        )}
      </div>

      <h2>Signal hint</h2>
      <div className="card">
        <div className="row" style={{ marginTop: 0, justifyContent: "space-between" }}>
          <span className={`pill ${labelTone(signal.label)}`} style={{ fontSize: 20, padding: "8px 18px" }}>{signal.label}</span>
          <span className="mute">score {signal.score > 0 ? "+" : ""}{signal.score} of ±100</span>
        </div>
        <p className="mute">A hint from the past price pattern, not a prediction and not financial advice. Every factor is below.</p>
        {signal.factors.map((f) => (
          <div key={f.name} className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap", margin: "6px 0" }}>
            <div><b>{f.name}</b><div className="mute">{f.why}</div></div>
            <span className={`pill ${f.points > 0 ? "up" : f.points < 0 ? "down" : ""}`}>{f.points > 0 ? "+" : ""}{f.points} / {f.max}</span>
          </div>
        ))}
        {signal.missing.length > 0 && <p className="mute">Not enough history for: {signal.missing.join(", ")}.</p>}
        {bt ? (
          <>
            <h3 style={{ marginBottom: 4 }}>How this signal did on {symbol}&apos;s own history</h3>
            <p className="mute" style={{ marginTop: 0 }}>What happened over the next {bt.horizon} trading days after each label ({bt.samples} samples, overlapping, so rough). Past results do not promise future ones.</p>
            {bt.buckets.map((b) => (
              <div key={b.label} className="row" style={{ justifyContent: "space-between", margin: "4px 0" }}>
                <span><b>{b.label}</b> <span className="mute">· {b.count} times</span></span>
                <span className={b.avgReturn === null ? "mute" : b.avgReturn >= 0 ? "up" : "down"}>
                  {b.avgReturn === null ? "no data" : `avg ${pct(b.avgReturn)} · up ${b.winRate!.toFixed(0)}% of the time`}
                </span>
              </div>
            ))}
            <p className="mute">For comparison, any random day: avg {pct(bt.baseline.avgReturn)}, up {bt.baseline.winRate?.toFixed(0)}% of the time. A label only helps if it beats this.</p>
          </>
        ) : (
          <p className="mute">Not enough history to test this signal on {symbol} yet.</p>
        )}
      </div>

      {stab && (
        <>
          <h2>Stability</h2>
          <div className="card">
            <div className="row" style={{ marginTop: 0, justifyContent: "space-between" }}>
              <span className={`pill ${stab.tone === "flat" ? "" : stab.tone}`} style={{ fontSize: 18 }}>{stab.label}</span>
              <span className="mute">{stab.annualVol.toFixed(0)}% yearly swing</span>
            </div>
            <p>{stab.summary}</p>
            <div className="mute">
              Usually moves about {stab.typicalDailyMove.toFixed(1)}% a day. {stab.bigMoveDays} day{stab.bigMoveDays === 1 ? "" : "s"} in the past year moved 3% or more.
              Worst day {stab.worstDay.toFixed(1)}%. Now {stab.drawdown1y.toFixed(1)}% below its 1-year high.
            </div>
          </div>
        </>
      )}

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
