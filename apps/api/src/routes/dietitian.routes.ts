import { Router } from "express";
import crypto from "node:crypto";
import { authenticate, requireRole } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { linkPatientSchema } from "../validation/schemas";
import { prisma } from "../db/prisma";
import { badRequest, conflict, notFound } from "../utils/errors";
import { deriveTargets, evaluateMeal, sumTotals } from "../services/clinical-engine";
import { startOfDay } from "../services/meal.service";

const router = Router();
router.use(authenticate, requireRole("dietitian", "admin"));

router.get("/me", async (req, res, next) => {
  try {
    const profile = await prisma.dietitianProfile.findUnique({
      where: { userId: req.auth!.sub },
      include: { user: { select: { fullName: true, email: true } } },
    });
    if (!profile) throw notFound("Create your dietitian profile first");
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.get("/patients", async (req, res, next) => {
  try {
    const dietitianId = req.auth!.sub;
    const links = await prisma.patientDietitianLink.findMany({
      where: req.auth!.role === "admin" ? {} : { dietitianId },
      include: {
        patient: {
          select: {
            id: true,
            fullName: true,
            email: true,
            tier: true,
            profile: true,
            clinicalFlags: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(links);
  } catch (err) {
    next(err);
  }
});

router.post("/patients/link", validate(linkPatientSchema), async (req, res, next) => {
  try {
    const dietitianId = req.auth!.sub;
    const patient = await prisma.user.findUnique({ where: { email: req.body.patientEmail.toLowerCase() } });
    if (!patient) throw notFound("No user found with that email");
    if (patient.id === dietitianId) throw badRequest("You cannot link to your own account");

    const existing = await prisma.patientDietitianLink.findUnique({
      where: { patientId_dietitianId: { patientId: patient.id, dietitianId } },
    });
    if (existing?.status === "active") throw conflict("Patient is already linked to you");

    const accessToken = crypto.randomBytes(24).toString("hex");

    const link = await prisma.patientDietitianLink.upsert({
      where: { patientId_dietitianId: { patientId: patient.id, dietitianId } },
      update: { accessToken, status: "pending", revokedAt: null },
      create: { patientId: patient.id, dietitianId, accessToken, status: "pending" },
    });

    res.status(201).json({
      link,
      inviteUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/invite/${accessToken}`,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/patients/:linkId/revoke", async (req, res, next) => {
  try {
    const result = await prisma.patientDietitianLink.updateMany({
      where: {
        id: req.params.linkId,
        ...(req.auth!.role === "admin" ? {} : { dietitianId: req.auth!.sub }),
      },
      data: { status: "revoked", revokedAt: new Date() },
    });
    if (result.count === 0) throw notFound("Link not found");
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.get("/patients/:patientId/overview", async (req, res, next) => {
  try {
    const patientId = req.params.patientId;
    const dietitianId = req.auth!.sub;

    if (req.auth!.role !== "admin") {
      const link = await prisma.patientDietitianLink.findFirst({
        where: { patientId, dietitianId, status: "active" },
      });
      if (!link) throw notFound("No active link with this patient");
    }

    const since = new Date();
    since.setDate(since.getDate() - 14);
    since.setHours(0, 0, 0, 0);

    const [patient, logs, alerts, sessions, weightLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: patientId },
        select: {
          id: true,
          fullName: true,
          email: true,
          tier: true,
          createdAt: true,
          profile: true,
          clinicalFlags: true,
        },
      }),
      prisma.dailyMealLog.findMany({
        where: { userId: patientId, loggedAt: { gte: since } },
        include: { food: { select: { dishName: true, localName: true, category: true } } },
        orderBy: { loggedAt: "asc" },
      }),
      prisma.clinicalAlert.findMany({
        where: { userId: patientId },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.telehealthSession.findMany({
        where: {
          patientId,
          ...(req.auth!.role === "admin" ? {} : { dietitianId }),
        },
        orderBy: { scheduledAt: "desc" },
        take: 10,
      }),
      prisma.weightLog.findMany({
        where: { userId: patientId },
        orderBy: { loggedAt: "asc" },
        take: 60,
      }),
    ]);

    if (!patient) throw notFound("Patient not found");

    const byDay = new Map<string, ReturnType<typeof sumTotals>>();
    for (const log of logs) {
      const key = startOfDay(log.loggedAt).toISOString().slice(0, 10);
      const current = byDay.get(key) ?? {
        calories: 0,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        sodiumMg: 0,
        potassiumMg: 0,
        phosphorusMg: 0,
        glycemicLoad: 0,
      };
      byDay.set(
        key,
        sumTotals([
          current,
          {
            calories: log.totalCalories,
            proteinG: log.totalProteinG,
            carbsG: log.totalCarbsG,
            fatG: log.totalFatG,
            sodiumMg: log.totalSodiumMg,
            potassiumMg: log.totalPotassiumMg,
            phosphorusMg: log.totalPhosphorusMg,
            glycemicLoad: log.totalGlycemicLoad,
          },
        ]),
      );
    }

    const targets = deriveTargets({
      hasDiabetes: patient.clinicalFlags?.hasDiabetes ?? false,
      hasHypertension: patient.clinicalFlags?.hasHypertension ?? false,
      ckdStage: patient.clinicalFlags?.ckdStage ?? 0,
      isDialysis: patient.clinicalFlags?.isDialysis ?? false,
      weightKg: patient.profile?.weightKg ?? 60,
      targetSodiumMg: patient.clinicalFlags?.targetSodiumMg,
      targetPotassiumMg: patient.clinicalFlags?.targetPotassiumMg,
      targetProteinG: patient.clinicalFlags?.targetProteinG,
      targetGlycemicLoad: patient.clinicalFlags?.targetGlycemicLoad,
      targetCalories: patient.clinicalFlags?.targetCalories,
      targetPhosphorusMg: patient.clinicalFlags?.targetPhosphorusMg,
    });

    const dailySeries = [...byDay.entries()]
      .map(([date, totals]) => ({ date, ...totals }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const complianceDays = dailySeries.filter(
      (d) =>
        d.sodiumMg < targets.sodiumMg &&
        (!patient.clinicalFlags?.hasDiabetes || d.glycemicLoad <= targets.glycemicLoad) &&
        (patient.clinicalFlags?.ckdStage === 0 || d.potassiumMg <= targets.potassiumMg),
    ).length;

    res.json({
      patient,
      targets,
      dailySeries,
      alerts,
      sessions,
      weightLogs,
      adherenceRate: dailySeries.length > 0 ? Math.round((complianceDays / dailySeries.length) * 100) : 0,
      recentMeals: logs.slice(-20).reverse().map((l) => ({
        id: l.id,
        loggedAt: l.loggedAt,
        mealType: l.mealType,
        dishName: l.food.dishName,
        localName: l.food.localName,
        category: l.food.category,
        sodiumMg: l.totalSodiumMg,
        potassiumMg: l.totalPotassiumMg,
        glycemicLoad: l.totalGlycemicLoad,
        calories: l.totalCalories,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
