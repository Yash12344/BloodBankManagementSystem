import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

export const healthRouter = Router();

/** Liveness — process is up. Cheap, no dependencies. */
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/** Readiness — dependencies (DB, Redis) are reachable. Used by orchestrators. */
healthRouter.get("/ready", async (_req, res) => {
  const checks: Record<string, "ok" | "down"> = { database: "down", redis: "down" };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    /* leave as down */
  }
  try {
    const pong = await redis.ping();
    if (pong === "PONG") checks.redis = "ok";
  } catch {
    /* leave as down */
  }

  const ready = Object.values(checks).every((c) => c === "ok");
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", checks });
});
