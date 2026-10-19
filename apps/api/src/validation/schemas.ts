import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  fullName: z.string().min(2).max(120),
  role: z.enum(["consumer", "patient", "dietitian"]).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10),
});

export const profileSchema = z.object({
  age: z.number().int().min(13).max(120),
  sex: z.enum(["male", "female", "other"]),
  heightCm: z.number().min(80).max(250),
  weightKg: z.number().min(20).max(400),
  targetWeightKg: z.number().min(20).max(400).optional(),
  activityLevel: z.enum(["sedentary", "light", "moderate", "active", "very_active"]),
  allergies: z.array(z.string()).default([]),
  preferences: z.array(z.string()).default([]),
});

export const clinicalFlagsSchema = z.object({
  hasDiabetes: z.boolean(),
  hasHypertension: z.boolean(),
  ckdStage: z.number().int().min(0).max(5),
  isDialysis: z.boolean().default(false),
  targetSodiumMg: z.number().int().min(500).max(4000).optional(),
  targetPotassiumMg: z.number().int().min(500).max(6000).optional(),
  targetProteinG: z.number().min(20).max(300).optional(),
  targetGlycemicLoad: z.number().min(0).max(500).optional(),
  targetCalories: z.number().int().min(800).max(6000).optional(),
  targetPhosphorusMg: z.number().int().min(300).max(2500).optional(),
});

export const mealLogSchema = z.object({
  foodId: z.string().uuid(),
  portionMultiplier: z.number().positive().max(10).default(1),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  loggedAt: z.coerce.date().optional(),
  notes: z.string().max(500).optional(),
  clientUuid: z.string().max(80).optional(),
});

export const dietitianProfileSchema = z.object({
  prcLicenseNumber: z.string().min(4).max(40),
  specialization: z.string().min(3).max(160),
  bio: z.string().max(2000).optional(),
  consultationFeePhp: z.number().min(0).max(50000),
});

export const linkPatientSchema = z.object({
  patientEmail: z.string().email(),
});

export const bookSessionSchema = z.object({
  dietitianId: z.string().uuid(),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(15).max(120).default(30),
});

export const coachSchema = z.object({
  mealLogId: z.string().uuid().optional(),
  prompt: z.string().max(1000).optional(),
});

export const foodQuerySchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(60).optional(),
  verifiedOnly: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
