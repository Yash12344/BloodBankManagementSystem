import { pino } from "pino";
import { env, isProd } from "../config/env.js";

export const logger = pino({
  level: isProd ? "info" : "debug",
  base: { service: "bloodline-api", env: env.NODE_ENV },
  // Pretty transport only in dev; structured JSON in prod for log aggregation.
  transport: isProd
    ? undefined
    : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
});
