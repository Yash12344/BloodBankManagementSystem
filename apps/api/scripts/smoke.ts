/**
 * End-to-end smoke test. Walks the full clinical+financial pipeline against a running API:
 *   login → register donor → collect → lab approve → separate → request → approve →
 *   cross-match → issue → pay
 * and asserts each step. Requires a running API + seeded admin.
 *
 * Usage:
 *   SMOKE_BASE_URL=http://localhost:4000 SMOKE_EMAIL=admin@bloodline.local \
 *     SMOKE_PASSWORD=ChangeMe!123 pnpm --filter @bloodline/api exec tsx scripts/smoke.ts
 */
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";
const EMAIL = process.env.SMOKE_EMAIL ?? "admin@bloodline.local";
const PASSWORD = process.env.SMOKE_PASSWORD ?? "ChangeMe!123";

let cookies = "";

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookies ? { Cookie: cookies } : {}),
      ...(method === "POST" && path.endsWith("/payments") ? { "Idempotency-Key": crypto.randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookies = setCookie.map((c) => c.split(";")[0]).join("; ");
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return json as T;
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`Assertion failed: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log(`Smoke test against ${BASE}`);

  await req("POST", "/auth/login", { email: EMAIL, password: PASSWORD });
  assert(cookies.includes("bl_access"), "logged in");

  const stamp = Date.now();
  const { donor } = await req<{ donor: { id: string } }>("POST", "/donors", {
    name: `Smoke Donor ${stamp}`, dob: "1990-01-01", gender: "MALE", bloodGroup: "O_POS",
    weightKg: 75, mobile: `9${String(stamp).slice(-9)}`,
  });
  assert(donor.id, "donor registered");

  const collected = await req<{ unit: { id: string; bagNumber: string } }>("POST", "/collections", { donorId: donor.id });
  assert(collected.unit.id, "collection created unit");

  await req("PUT", `/lab/${collected.unit.id}/tests`, {
    hb: 14, hiv: "NON_REACTIVE", hbsag: "NON_REACTIVE", hcv: "NON_REACTIVE", malaria: "NON_REACTIVE", syphilis: "NON_REACTIVE",
  });
  await req("POST", `/lab/${collected.unit.id}/approve`);
  assert(true, "lab approved");

  const { components } = await req<{ components: { barcode: string }[] }>("POST", `/components/separate/${collected.unit.id}`, { types: ["PRBC"] });
  const barcode = components[0]!.barcode;
  assert(barcode, "separated into PRBC");

  const { request } = await req<{ request: { id: string } }>("POST", "/requests", {
    bloodGroup: "O_POS", componentType: "PRBC", unitsRequested: 1, priority: "NORMAL",
  });
  const approve = await req<{ reserved: number }>("POST", `/requests/${request.id}/approve`);
  assert(approve.reserved === 1, "request approved and 1 unit reserved");

  const detail = await req<{ request: { reservations: { component: { id: string } }[] } }>("GET", `/requests/${request.id}`);
  const componentId = detail.request.reservations[0]!.component.id;
  await req("POST", "/crossmatch", { requestId: request.id, componentId, result: "COMPATIBLE" });
  assert(true, "cross-match recorded");

  const issued = await req<{ issue: { id: string }; invoice: { number: string; id: string; totalMinor: number } }>("POST", "/issues", {
    requestId: request.id, componentBarcodes: [barcode],
  });
  assert(issued.invoice.number, `issued; invoice ${issued.invoice.number}`);

  if (issued.invoice.totalMinor > 0) {
    const pay = await req<{ invoice: { status: string } }>("POST", `/billing/invoices/${issued.invoice.id}/payments`, {
      method: "CASH", amountMinor: issued.invoice.totalMinor,
    });
    assert(pay.invoice.status === "PAID", "invoice paid in full");
  }

  console.log("\nSmoke test passed ✅");
}

main().catch((err) => {
  console.error("\nSmoke test FAILED ❌\n", err);
  process.exit(1);
});
