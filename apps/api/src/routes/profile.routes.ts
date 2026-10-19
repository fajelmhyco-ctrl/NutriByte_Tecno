import { Router } from "express";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { clinicalFlagsSchema, dietitianProfileSchema, profileSchema } from "../validation/schemas";
import { prisma } from "../db/prisma";
import { notFound } from "../utils/errors";
import { calculateBmi, deriveTargets } from "../services/clinical-engine";

const router = Router();

router.use(authenticate);

router.put("/", validate(profileSchema), async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const bmi = calculateBmi(req.body.weightKg, req.body.heightCm);

    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: { ...req.body, bmi },
      create: { userId, ...req.body, bmi },
    });

    await prisma.weightLog.create({ data: { userId, weightKg: req.body.weightKg } });

    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.put("/clinical-flags", validate(clinicalFlagsSchema), async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const profile = await prisma.userProfile.findUnique({ where: { userId } });

    const derived = deriveTargets({
      hasDiabetes: req.body.hasDiabetes,
      hasHypertension: req.body.hasHypertension,
      ckdStage: req.body.ckdStage,
      isDialysis: req.body.isDialysis,
      weightKg: profile?.weightKg ?? 60,
      targetSodiumMg: req.body.targetSodiumMg,
      targetPotassiumMg: req.body.targetPotassiumMg,
      targetProteinG: req.body.targetProteinG,
      targetGlycemicLoad: req.body.targetGlycemicLoad,
      targetCalories: req.body.targetCalories,
      targetPhosphorusMg: req.body.targetPhosphorusMg,
    });

    const flags = await prisma.clinicalFlags.upsert({
      where: { userId },
      update: {
        ...req.body,
        targetSodiumMg: derived.sodiumMg,
        targetPotassiumMg: derived.potassiumMg,
        targetProteinG: derived.proteinG,
        targetGlycemicLoad: derived.glycemicLoad,
        targetCalories: derived.calories,
        targetPhosphorusMg: derived.phosphorusMg,
      },
      create: {
        userId,
        ...req.body,
        targetSodiumMg: derived.sodiumMg,
        targetPotassiumMg: derived.potassiumMg,
        targetProteinG: derived.proteinG,
        targetGlycemicLoad: derived.glycemicLoad,
        targetCalories: derived.calories,
        targetPhosphorusMg: derived.phosphorusMg,
      },
    });

    res.json(flags);
  } catch (err) {
    next(err);
  }
});

router.post(
  "/dietitian",
  requireRole("dietitian"),
  validate(dietitianProfileSchema),
  async (req, res, next) => {
    try {
      const userId = req.auth!.sub;
      const profile = await prisma.dietitianProfile.upsert({
        where: { userId },
        update: req.body,
        create: { userId, ...req.body },
      });
      res.json(profile);
    } catch (err) {
      next(err);
    }
  },
);

router.get("/weight-history", async (req, res, next) => {
  try {
    const logs = await prisma.weightLog.findMany({
      where: { userId: req.auth!.sub },
      orderBy: { loggedAt: "asc" },
      take: 180,
    });
    res.json(logs);
  } catch (err) {
    next(err);
  }
});

router.get("/:userId/summary", requireRole("dietitian", "admin"), async (req, res, next) => {
  try {
    const patientId = req.params.userId;
    const dietitianId = req.auth!.sub;

    if (req.auth!.role === "dietitian") {
      const link = await prisma.patientDietitianLink.findFirst({
        where: { patientId, dietitianId, status: "active" },
      });
      if (!link) throw notFound("No active link with this patient");
    }

    const [profile, flags, weightLogs] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: patientId } }),
      prisma.clinicalFlags.findUnique({ where: { userId: patientId } }),
      prisma.weightLog.findMany({
        where: { userId: patientId },
        orderBy: { loggedAt: "desc" },
        take: 30,
      }),
    ]);

    res.json({ profile, flags, weightLogs });
  } catch (err) {
    next(err);
  }
});

export default router;
