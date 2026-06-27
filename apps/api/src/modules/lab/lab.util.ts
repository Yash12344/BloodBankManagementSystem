/** Transfusion-transmitted-infection markers screened on every unit. */
export const TTI_MARKERS = ["hiv", "hbsag", "hcv", "malaria", "syphilis"] as const;
export type TtiMarker = (typeof TTI_MARKERS)[number];
export type MarkerValue = "PENDING" | "REACTIVE" | "NON_REACTIVE";

export interface TtiSummary {
  anyReactive: boolean;
  anyPending: boolean;
  allNonReactive: boolean;
}

/**
 * Summarizes the TTI panel. `anyReactive` ⇒ the unit must be quarantined/discarded;
 * `allNonReactive` is a precondition for lab approval.
 */
export function summarizeTti(values: Record<TtiMarker, MarkerValue>): TtiSummary {
  const list = TTI_MARKERS.map((m) => values[m]);
  return {
    anyReactive: list.some((v) => v === "REACTIVE"),
    anyPending: list.some((v) => v === "PENDING"),
    allNonReactive: list.every((v) => v === "NON_REACTIVE"),
  };
}
