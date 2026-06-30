import { describe, expect, it } from "vitest";
import { componentClass, evaluateCompatibility } from "../src/lib/bloodCompatibility.js";

const ALL = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"] as const;

describe("componentClass", () => {
  it("maps each component to its transfusion class", () => {
    expect(componentClass("PRBC")).toBe("RED_CELL");
    expect(componentClass("WHOLE_BLOOD")).toBe("RED_CELL");
    expect(componentClass("FFP")).toBe("PLASMA");
    expect(componentClass("CRYO")).toBe("PLASMA");
    expect(componentClass("PLATELETS")).toBe("PLATELET");
  });
});

describe("red-cell ABO/Rh compatibility", () => {
  it("O-negative is the universal red-cell donor", () => {
    for (const r of ALL) expect(evaluateCompatibility("O_NEG", r, "PRBC").compatible).toBe(true);
  });

  it("AB-positive is the universal red-cell recipient", () => {
    for (const d of ALL) expect(evaluateCompatibility(d, "AB_POS", "PRBC").compatible).toBe(true);
  });

  it("blocks ABO-incompatible red cells", () => {
    expect(evaluateCompatibility("A_POS", "O_POS", "PRBC").compatible).toBe(false);
    expect(evaluateCompatibility("B_POS", "A_POS", "PRBC").compatible).toBe(false);
    expect(evaluateCompatibility("AB_POS", "A_POS", "PRBC").compatible).toBe(false);
  });

  it("blocks Rh-positive cells into an Rh-negative recipient (and allows the reverse)", () => {
    expect(evaluateCompatibility("O_POS", "O_NEG", "PRBC").compatible).toBe(false);
    expect(evaluateCompatibility("O_NEG", "O_POS", "PRBC").compatible).toBe(true);
  });

  it("flags identical pairings", () => {
    expect(evaluateCompatibility("A_POS", "A_POS", "PRBC")).toMatchObject({ compatible: true, identical: true });
  });
});

describe("plasma compatibility (reversed direction, Rh-agnostic)", () => {
  it("AB is the universal plasma donor", () => {
    for (const r of ALL) expect(evaluateCompatibility("AB_POS", r, "FFP").compatible).toBe(true);
  });

  it("O recipient can receive any plasma", () => {
    for (const d of ALL) expect(evaluateCompatibility(d, "O_NEG", "FFP").compatible).toBe(true);
  });

  it("blocks plasma carrying antibodies against the recipient", () => {
    expect(evaluateCompatibility("B_POS", "A_POS", "FFP").compatible).toBe(false);
    expect(evaluateCompatibility("O_POS", "AB_POS", "FFP").compatible).toBe(false);
  });

  it("ignores Rh for acellular plasma", () => {
    expect(evaluateCompatibility("O_POS", "O_NEG", "FFP").compatible).toBe(true);
  });
});

describe("platelets follow the cellular (red-cell) rules", () => {
  it("blocks Rh-positive platelets into an Rh-negative recipient", () => {
    expect(evaluateCompatibility("A_POS", "A_NEG", "PLATELETS").compatible).toBe(false);
  });
});
