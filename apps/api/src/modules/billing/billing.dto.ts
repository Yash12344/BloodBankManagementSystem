import { bloodGroupSchema, componentTypeSchema, paginationSchema } from "@bloodline/types";
import { z } from "zod";

export const invoiceListSchema = paginationSchema.extend({
  status: z.enum(["DRAFT", "UNPAID", "PARTIAL", "PAID", "VOID"]).optional(),
  hospitalId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "UPI", "CHEQUE", "BANK"]),
  amountMinor: z.coerce.number().int().positive(),
  reference: z.string().trim().max(80).optional(),
});

export const voidSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export const expenseCreateSchema = z.object({
  head: z.string().trim().min(2).max(120),
  amountMinor: z.coerce.number().int().positive(),
  spentAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const expenseListSchema = paginationSchema.extend({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const dailyCashSchema = z.object({
  date: z.coerce.date().optional(),
});

export const priceListSchema = z.object({
  items: z
    .array(
      z.object({
        componentType: componentTypeSchema,
        bloodGroup: bloodGroupSchema.nullish(),
        priceMinor: z.coerce.number().int().min(0),
        gstRate: z.coerce.number().min(0).max(100).default(0),
      }),
    )
    .min(1),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type ExpenseInput = z.infer<typeof expenseCreateSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListSchema>;
export type ExpenseListQuery = z.infer<typeof expenseListSchema>;
export type PriceListInput = z.infer<typeof priceListSchema>;
