import { COMPONENT_SHELF_LIFE_DAYS } from "@bloodline/types";
import type { ComponentType } from "@bloodline/db";
import { randomBytes } from "node:crypto";

const DAY_MS = 86_400_000;

/** Storage temperature per component type (label only; cold-chain logging is later). */
export const STORAGE_TEMP: Record<ComponentType, string> = {
  WHOLE_BLOOD: "2–6°C",
  PRBC: "2–6°C",
  PLATELETS: "20–24°C",
  FFP: "≤ -30°C",
  CRYO: "≤ -30°C",
};

/** Expiry = preparation time + the component's shelf life. */
export function computeComponentExpiry(type: ComponentType, preparedAt: Date): Date {
  const days = COMPONENT_SHELF_LIFE_DAYS[type];
  return new Date(preparedAt.getTime() + days * DAY_MS);
}

export function generateBarcode(): string {
  return `BC-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}
