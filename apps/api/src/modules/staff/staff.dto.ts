import { z } from "zod";

export const profileSchema = z.object({
  department: z.string().trim().max(80).optional(),
  designation: z.string().trim().max(80).optional(),
  joinDate: z.coerce.date().optional(),
});

export const attendanceSchema = z.object({
  date: z.coerce.date(),
  status: z.enum(["PRESENT", "ABSENT", "HALF_DAY", "LEAVE"]).default("PRESENT"),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
});

export const leaveSchema = z.object({
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  type: z.string().trim().min(2).max(40),
  reason: z.string().trim().max(500).optional(),
});

export const leaveStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type AttendanceInput = z.infer<typeof attendanceSchema>;
export type LeaveInput = z.infer<typeof leaveSchema>;
