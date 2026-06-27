import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { randomUUID } from "node:crypto";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { requireAuth } from "./middleware/auth.js";
import { requirePermission } from "./middleware/rbac.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./modules/auth/auth.routes.js";

/**
 * Builds the Express application with the baseline production middleware stack.
 * Feature module routers are mounted under /api/v1 as they are implemented.
 */
export function createApp(): Express {
  const app = express();

  // Security & infra middleware.
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.APP_BASE_URL,
      credentials: true,
    }),
  );
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Request id + structured request logging.
  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const id = (req.headers["x-request-id"] as string) ?? randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
    }),
  );

  // Global rate limit (auth routes will get a stricter limiter when added).
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: "draft-7",
      legacyHeaders: false,
    }),
  );

  // Health/readiness probes (unversioned).
  app.use(healthRouter);

  // Versioned API surface. Feature routers mount here as modules are built.
  const v1 = express.Router();
  v1.get("/", (_req, res) => res.json({ name: "BloodLine API", version: "v1", status: "ok" }));
  v1.use("/auth", authRouter);

  // Example of a permission-guarded route; every feature module follows this pattern.
  v1.get("/me/permissions", requireAuth, requirePermission("dashboard", "view"), (req, res) => {
    res.json({ permissions: [...(req.user?.permissions ?? [])] });
  });

  app.use("/api/v1", v1);

  // Fallbacks.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
