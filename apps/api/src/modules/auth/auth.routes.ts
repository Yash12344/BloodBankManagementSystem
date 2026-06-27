import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import * as authController from "./auth.controller.js";

// Stricter limiter for credential endpoints to blunt brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export const authRouter = Router();

authRouter.post("/login", authLimiter, asyncHandler(authController.login));
authRouter.post("/otp/verify", authLimiter, asyncHandler(authController.verifyOtp));
authRouter.post("/refresh", asyncHandler(authController.refresh));
authRouter.post("/logout", asyncHandler(authController.logout));
authRouter.post("/forgot-password", authLimiter, asyncHandler(authController.forgotPassword));
authRouter.post("/reset-password", authLimiter, asyncHandler(authController.resetPassword));
authRouter.get("/me", requireAuth, asyncHandler(authController.me));
