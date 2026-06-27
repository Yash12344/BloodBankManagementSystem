/**
 * Deterministic forecasting helpers — no LLM required, always available. Simple, explainable
 * statistics (moving average + linear trend) over historical daily series. Good enough to
 * drive low-stock and demand signals; an LLM is not appropriate for numeric forecasting.
 */

/** Mean of a numeric series (0 for empty). */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Least-squares linear trend over evenly-spaced points. Returns slope (per step) and
 * intercept. Used to project demand forward.
 */
export function linearTrend(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  if (n === 1) return { slope: 0, intercept: values[0]! };
  const xs = values.map((_, i) => i);
  const xMean = mean(xs);
  const yMean = mean(values);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - xMean) * (values[i]! - yMean);
    den += (xs[i]! - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: yMean - slope * xMean };
}

/**
 * Forecasts total demand over the next `horizonDays`, blending the recent average with the
 * linear trend and never returning a negative number.
 */
export function forecastDemand(dailySeries: number[], horizonDays: number): number {
  if (dailySeries.length === 0) return 0;
  const avg = mean(dailySeries);
  const { slope } = linearTrend(dailySeries);
  const n = dailySeries.length;
  let total = 0;
  for (let d = 1; d <= horizonDays; d++) {
    total += Math.max(0, avg + slope * (n + d - (n - 1) / 2 - 1));
  }
  return Math.round(total);
}

export type StockRisk = "critical" | "warning" | "ok";

/**
 * Days until stockout given current available units and an average daily consumption rate,
 * plus a risk band relative to a lead time (how long restocking takes).
 */
export function daysToStockout(available: number, dailyConsumption: number): number | null {
  if (dailyConsumption <= 0) return null; // no consumption ⇒ no predictable stockout
  return available / dailyConsumption;
}

export function stockRisk(daysLeft: number | null, leadTimeDays = 3): StockRisk {
  if (daysLeft === null) return "ok";
  if (daysLeft <= leadTimeDays) return "critical";
  if (daysLeft <= leadTimeDays * 2) return "warning";
  return "ok";
}
