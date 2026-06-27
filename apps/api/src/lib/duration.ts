/**
 * Parses a short duration string like "15m", "7d", "30s", "12h" into milliseconds.
 * Used for cookie max-age and refresh-token expiry computation.
 */
const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function durationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unitMs = UNIT_MS[match[2] ?? ""];
  if (unitMs === undefined) throw new Error(`Invalid duration unit: ${value}`);
  return amount * unitMs;
}
