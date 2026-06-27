import { describe, expect, it } from "vitest";
import { durationToMs } from "../src/lib/duration.js";
import { signAccessToken, verifyAccessToken } from "../src/lib/jwt.js";
import { hashPassword, verifyPassword } from "../src/lib/password.js";
import { generateOtpCode, sha256 } from "../src/lib/tokens.js";
import { hasPermission, permKey } from "../src/modules/auth/permissions.js";

describe("durationToMs", () => {
  it("parses units", () => {
    expect(durationToMs("30s")).toBe(30_000);
    expect(durationToMs("15m")).toBe(900_000);
    expect(durationToMs("12h")).toBe(43_200_000);
    expect(durationToMs("7d")).toBe(604_800_000);
  });
  it("rejects garbage", () => {
    expect(() => durationToMs("soon")).toThrow();
  });
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Sup3rSecret");
    expect(hash).not.toBe("Sup3rSecret");
    expect(await verifyPassword("Sup3rSecret", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });
});

describe("access tokens", () => {
  it("round-trips claims", () => {
    const token = signAccessToken({ sub: "u1", branchId: "b1", roleId: "r1", roleName: "Admin" });
    const claims = verifyAccessToken(token);
    expect(claims).toMatchObject({ sub: "u1", branchId: "b1", roleId: "r1", roleName: "Admin" });
  });
  it("rejects a tampered token", () => {
    const token = signAccessToken({ sub: "u1", branchId: "b1", roleId: "r1", roleName: "Admin" });
    expect(() => verifyAccessToken(token + "x")).toThrow();
  });
});

describe("rbac hasPermission", () => {
  it("matches exact permission", () => {
    const set = new Set([permKey("donors", "create")]);
    expect(hasPermission(set, "donors", "create")).toBe(true);
    expect(hasPermission(set, "donors", "delete")).toBe(false);
  });
  it("honours module wildcard", () => {
    const set = new Set(["donors.*"]);
    expect(hasPermission(set, "donors", "delete")).toBe(true);
    expect(hasPermission(set, "lab", "delete")).toBe(false);
  });
  it("honours god-mode wildcard", () => {
    const set = new Set(["*.*"]);
    expect(hasPermission(set, "anything", "everything")).toBe(true);
  });
});

describe("token helpers", () => {
  it("otp is six digits", () => {
    expect(generateOtpCode()).toMatch(/^\d{6}$/);
  });
  it("sha256 is deterministic", () => {
    expect(sha256("abc")).toBe(sha256("abc"));
    expect(sha256("abc")).not.toBe(sha256("abd"));
  });
});
