import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./inventory.controller.js";

export const inventoryRouter = Router();

inventoryRouter.use(requireAuth);

inventoryRouter.get("/", requirePermission("inventory", "view"), asyncHandler(c.matrix));
inventoryRouter.get("/expiring", requirePermission("inventory", "view"), asyncHandler(c.expiring));
inventoryRouter.get("/movements", requirePermission("inventory", "view"), asyncHandler(c.movements));
inventoryRouter.get("/fefo", requirePermission("inventory", "view"), asyncHandler(c.fefo));
inventoryRouter.get("/:bloodGroup/:componentType/units", requirePermission("inventory", "view"), asyncHandler(c.cellUnits));
