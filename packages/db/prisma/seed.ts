/**
 * BloodLine — database seed.
 * Idempotent: safe to run repeatedly. Seeds the permission catalogue, the default
 * role→permission matrix, a demo organization + branch, and a Super Admin user.
 *
 * Usage: DATABASE_URL=... pnpm --filter @bloodline/db seed
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

const prisma = new PrismaClient();

// Modules and the actions each supports. The permission catalogue is the cartesian
// product, plus a few module-specific actions (approve/export).
const MODULES = [
  "dashboard",
  "donors",
  "collection",
  "lab",
  "components",
  "inventory",
  "patients",
  "requests",
  "issue",
  "hospitals",
  "camps",
  "staff",
  "billing",
  "reports",
  "notifications",
  "analytics",
  "settings",
] as const;

const BASE_ACTIONS = ["view", "create", "edit", "delete"] as const;
const EXTRA_ACTIONS: Record<string, string[]> = {
  lab: ["approve"],
  requests: ["approve"],
  issue: ["approve"],
  billing: ["export"],
  reports: ["export"],
  donors: ["export", "import"],
  settings: ["manage"],
};

// Default permission grants per role, expressed as `module.action` or `module.*`.
const ROLE_MATRIX: Record<string, string[]> = {
  "Super Admin": ["*.*"],
  Admin: [
    "dashboard.*",
    "donors.*",
    "collection.*",
    "lab.*",
    "components.*",
    "inventory.*",
    "patients.*",
    "requests.*",
    "issue.*",
    "hospitals.*",
    "camps.*",
    "staff.*",
    "billing.*",
    "reports.*",
    "notifications.*",
    "analytics.*",
    "settings.view",
  ],
  Doctor: [
    "dashboard.view",
    "donors.view",
    "lab.view",
    "lab.approve",
    "patients.*",
    "requests.view",
    "requests.approve",
    "requests.edit",
    "issue.view",
    "issue.approve",
    "reports.view",
    "analytics.view",
  ],
  "Lab Technician": [
    "dashboard.view",
    "lab.*",
    "components.*",
    "inventory.view",
    "requests.view",
  ],
  Reception: [
    "dashboard.view",
    "donors.*",
    "collection.create",
    "collection.view",
    "patients.*",
    "requests.create",
    "requests.view",
    "issue.view",
    "hospitals.view",
  ],
  "Data Entry": [
    "dashboard.view",
    "donors.create",
    "donors.edit",
    "donors.import",
    "patients.create",
    "patients.edit",
  ],
  Accountant: [
    "dashboard.view",
    "billing.*",
    "hospitals.view",
    "reports.view",
    "reports.export",
    "analytics.view",
  ],
  "Blood Collection Staff": [
    "dashboard.view",
    "donors.view",
    "collection.*",
    "camps.view",
  ],
  "Store Manager": [
    "dashboard.view",
    "inventory.*",
    "components.*",
    "reports.view",
  ],
};

function expandActions(module: string): string[] {
  return [...BASE_ACTIONS, ...(EXTRA_ACTIONS[module] ?? [])];
}

async function main() {
  // 1. Permission catalogue
  const permissions: { module: string; action: string }[] = [];
  for (const m of MODULES) for (const a of expandActions(m)) permissions.push({ module: m, action: a });

  await prisma.$transaction(
    permissions.map((p) =>
      prisma.permission.upsert({
        where: { module_action: { module: p.module, action: p.action } },
        update: {},
        create: p,
      }),
    ),
  );
  const allPerms = await prisma.permission.findMany();

  // Resolve a grant pattern (e.g. "lab.*", "*.*", "requests.approve") to permission ids.
  const resolve = (patterns: string[]) => {
    const ids = new Set<string>();
    for (const perm of allPerms) {
      for (const pat of patterns) {
        const [mod, act] = pat.split(".");
        const modOk = mod === "*" || mod === perm.module;
        const actOk = act === "*" || act === perm.action;
        if (modOk && actOk) ids.add(perm.id);
      }
    }
    return [...ids];
  };

  // 2. Roles + role_permission
  for (const [roleName, grants] of Object.entries(ROLE_MATRIX)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, isSystem: true },
    });
    const permIds = resolve(grants);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      skipDuplicates: true,
    });
  }

  // 3. Demo organization + branch
  const org = await prisma.organization.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name: "BloodLine Demo Org" },
  });
  const branch = await prisma.branch.upsert({
    where: { orgId_code: { orgId: org.id, code: "MAIN" } },
    update: {},
    create: { orgId: org.id, name: "Main Branch", code: "MAIN", timezone: "Asia/Kolkata" },
  });

  // 4. Super Admin user. Password is hashed at the app layer; seed uses a placeholder
  //    bcrypt hash for "ChangeMe!123" — rotate immediately after first login.
  const superAdmin = await prisma.role.findUniqueOrThrow({ where: { name: "Super Admin" } });
  await prisma.user.upsert({
    where: { email: "admin@bloodline.local" },
    update: {},
    create: {
      branchId: branch.id,
      roleId: superAdmin.id,
      name: "Super Admin",
      email: "admin@bloodline.local",
      // bcrypt hash of "ChangeMe!123" (cost 10). Replace via app on first login.
      passwordHash: "$2b$10$3Q1m2bq7m9bL3l8s0Q1mEeXjJ0m1mF7m3o0nU0Z1l8m1f2q3r4s5",
      mfaEnabled: false,
    },
  });

  // 5. A default price list so issue/billing has something to reference.
  const components = ["WHOLE_BLOOD", "PRBC", "PLATELETS", "FFP", "CRYO"] as const;
  const defaultPrices: Record<string, number> = {
    WHOLE_BLOOD: 110000,
    PRBC: 130000,
    PLATELETS: 90000,
    FFP: 60000,
    CRYO: 50000,
  };
  for (const c of components) {
    await prisma.priceListItem.upsert({
      where: {
        branchId_componentType_bloodGroup: {
          branchId: branch.id,
          componentType: c,
          bloodGroup: null as never, // global price (no group-specific override)
        },
      },
      update: { priceMinor: defaultPrices[c], gstRate: 5 },
      create: { branchId: branch.id, componentType: c, priceMinor: defaultPrices[c], gstRate: 5 },
    }).catch(async () => {
      // bloodGroup null is not part of a composite unique in some engines; fall back to create-if-absent.
      const existing = await prisma.priceListItem.findFirst({
        where: { branchId: branch.id, componentType: c, bloodGroup: null },
      });
      if (!existing) {
        await prisma.priceListItem.create({
          data: { id: randomUUID(), branchId: branch.id, componentType: c, priceMinor: defaultPrices[c], gstRate: 5 },
        });
      }
    });
  }

  console.log("Seed complete:", {
    permissions: allPerms.length,
    roles: Object.keys(ROLE_MATRIX).length,
    branch: branch.code,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
