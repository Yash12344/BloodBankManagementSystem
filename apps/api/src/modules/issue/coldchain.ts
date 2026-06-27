/**
 * Cold-chain rule for returns. A component handed over can only be returned to stock if it
 * comes back within the allowed out-of-storage window; otherwise it must be discarded.
 */
export const COLD_CHAIN_WINDOW_MINUTES = 30;

export function minutesOutOfStorage(issuedAt: Date, now: Date): number {
  return (now.getTime() - issuedAt.getTime()) / 60_000;
}

export function withinColdChainWindow(issuedAt: Date, now: Date, windowMinutes = COLD_CHAIN_WINDOW_MINUTES): boolean {
  const mins = minutesOutOfStorage(issuedAt, now);
  return mins >= 0 && mins <= windowMinutes;
}
