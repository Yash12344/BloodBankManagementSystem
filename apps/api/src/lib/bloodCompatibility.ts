/**
 * ABO/Rh transfusion compatibility — the core patient-safety rule of a blood bank.
 *
 * Pure and deterministic so it is unit-testable and can be enforced identically at every
 * decision point (request, cross-match, issue). The rules follow standard transfusion
 * medicine and are intentionally conservative for an inspected facility:
 *
 *  - Red cells (Whole blood, PRBC) and platelets: the donor's A/B antigens must be tolerated
 *    by the recipient, AND an Rh-positive cellular unit must never be given to an Rh-negative
 *    recipient (prevents alloimmunisation — this also subsumes the rule protecting
 *    Rh-negative women of child-bearing age).
 *  - Plasma (FFP, Cryo): reversed — the donor plasma must not carry antibodies against the
 *    recipient's antigens. Rh is not considered for acellular plasma.
 *
 * Universal references: O-negative is the universal red-cell donor; AB the universal red-cell
 * recipient; AB the universal plasma donor; O the universal plasma recipient.
 */
import type { BloodGroup, ComponentType } from "@bloodline/db";

export type Abo = "A" | "B" | "AB" | "O";
export type ComponentClass = "RED_CELL" | "PLASMA" | "PLATELET";

export function componentClass(type: ComponentType): ComponentClass {
  if (type === "FFP" || type === "CRYO") return "PLASMA";
  if (type === "PLATELETS") return "PLATELET";
  return "RED_CELL"; // WHOLE_BLOOD, PRBC
}

export function parseGroup(group: BloodGroup | string): { abo: Abo; rhPos: boolean } {
  const s = String(group);
  return { abo: s.replace(/_(POS|NEG)$/, "") as Abo, rhPos: s.endsWith("_POS") };
}

// Which donor ABO groups a recipient ABO group may receive as RED CELLS.
const RBC_ABO: Record<Abo, ReadonlySet<Abo>> = {
  O: new Set<Abo>(["O"]),
  A: new Set<Abo>(["A", "O"]),
  B: new Set<Abo>(["B", "O"]),
  AB: new Set<Abo>(["A", "B", "AB", "O"]),
};

// Which donor ABO groups a recipient may receive as PLASMA (reversed direction).
const PLASMA_ABO: Record<Abo, ReadonlySet<Abo>> = {
  O: new Set<Abo>(["O", "A", "B", "AB"]),
  A: new Set<Abo>(["A", "AB"]),
  B: new Set<Abo>(["B", "AB"]),
  AB: new Set<Abo>(["AB"]),
};

export interface CompatibilityResult {
  compatible: boolean;
  identical: boolean;
  reason: string;
}

/**
 * Decides whether a unit of `donorGroup`/`componentType` may be transfused into a recipient
 * of `recipientGroup`. Returns the reason either way so it can be surfaced and audited.
 */
export function evaluateCompatibility(
  donorGroup: BloodGroup | string,
  recipientGroup: BloodGroup | string,
  componentType: ComponentType,
): CompatibilityResult {
  const donor = parseGroup(donorGroup);
  const recipient = parseGroup(recipientGroup);
  const identical = String(donorGroup) === String(recipientGroup);
  const klass = componentClass(componentType);

  if (klass === "PLASMA") {
    const ok = PLASMA_ABO[recipient.abo].has(donor.abo);
    return {
      compatible: ok,
      identical,
      reason: ok
        ? `Plasma ABO compatible (${donor.abo} → ${recipient.abo})`
        : `Plasma ABO INCOMPATIBLE: ${donor.abo} plasma into ${recipient.abo} recipient`,
    };
  }

  // RED_CELL and PLATELET share the cellular rules.
  if (!RBC_ABO[recipient.abo].has(donor.abo)) {
    return { compatible: false, identical, reason: `ABO INCOMPATIBLE: ${donor.abo} cells into ${recipient.abo} recipient` };
  }
  if (donor.rhPos && !recipient.rhPos) {
    return { compatible: false, identical, reason: "Rh INCOMPATIBLE: Rh-positive unit into Rh-negative recipient" };
  }
  return {
    compatible: true,
    identical,
    reason: identical ? "ABO/Rh identical" : `ABO/Rh compatible (${String(donorGroup)} → ${String(recipientGroup)})`,
  };
}
