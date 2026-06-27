import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/rbac.js";
import * as c from "./billing.controller.js";

export const billingRouter = Router();

billingRouter.use(requireAuth);

// Invoices & payments
billingRouter.get("/invoices", requirePermission("billing", "view"), asyncHandler(c.listInvoices));
billingRouter.get("/invoices/:id", requirePermission("billing", "view"), asyncHandler(c.getInvoice));
billingRouter.post("/invoices/:id/payments", requirePermission("billing", "create"), asyncHandler(c.recordPayment));
billingRouter.post("/invoices/:id/void", requirePermission("billing", "edit"), asyncHandler(c.voidInvoice));

// Expenses
billingRouter.get("/expenses", requirePermission("billing", "view"), asyncHandler(c.listExpenses));
billingRouter.post("/expenses", requirePermission("billing", "create"), asyncHandler(c.createExpense));

// Finance reports
billingRouter.get("/daily-cash", requirePermission("billing", "view"), asyncHandler(c.dailyCash));
billingRouter.get("/aging", requirePermission("billing", "view"), asyncHandler(c.aging));

// Price list
billingRouter.get("/price-list", requirePermission("billing", "view"), asyncHandler(c.getPriceList));
billingRouter.put("/price-list", requirePermission("billing", "edit"), asyncHandler(c.updatePriceList));
