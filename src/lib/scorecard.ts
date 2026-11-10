export type IdeaRow = {
  direction: "long" | "short";
  entry_price: number;
  close_price: number | null;
  current_price: number | null;
  has_alert: boolean;
};

export type AlertRow = {
  kind: "jump" | "drop" | "earnings_soon" | "target_low" | "target_high";
  price: number;
  current_price: number | null;
  age_days: number;
};

export const ideaReturn = (r: Pick<IdeaRow, "direction" | "entry_price" | "close_price" | "current_price">) => {
  const exit = r.close_price ?? r.current_price;
  if (exit === null) return null;
  const sign = r.direction === "long" ? 1 : -1;
  return (sign * (exit - r.entry_price) * 100) / r.entry_price;
};

const summarize = (returns: number[]) => ({
  count: returns.length,
  winRate: returns.length ? (returns.filter((x) => x > 0).length / returns.length) * 100 : null,
  avgReturn: returns.length ? returns.reduce((a, b) => a + b, 0) / returns.length : null,
});

export function ideaScorecard(rows: IdeaRow[]) {
  const withRet = rows.map((r) => ({ r, ret: ideaReturn(r) })).filter((x): x is { r: IdeaRow; ret: number } => x.ret !== null);
  return {
    all: summarize(withRet.map((x) => x.ret)),
    fromAlerts: summarize(withRet.filter((x) => x.r.has_alert).map((x) => x.ret)),
    own: summarize(withRet.filter((x) => !x.r.has_alert).map((x) => x.ret)),
  };
}

/**
 * Did the market keep moving the way an alert said it moved?
 * Only jump/drop alerts at least `minAgeDays` old are judged.
 */
export function alertScorecard(rows: AlertRow[], minAgeDays = 3) {
  const rets = rows
    .filter((a) => (a.kind === "jump" || a.kind === "drop") && a.age_days >= minAgeDays && a.current_price !== null)
    .map((a) => (a.kind === "jump" ? 1 : -1) * ((a.current_price! - a.price) * 100) / a.price);
  return {
    count: rets.length,
    continuedPct: rets.length ? (rets.filter((x) => x > 0).length / rets.length) * 100 : null,
    avgFollowThrough: rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : null,
  };
}
