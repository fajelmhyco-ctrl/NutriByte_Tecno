import { Router } from "express";
import { authenticate, requirePremium } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { coachSchema } from "../validation/schemas";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../utils/errors";
import { loadClinicalProfile } from "../services/meal.service";
import { analyzeMeal } from "../services/ai-coach";
import { evaluateMeal, sumTotals } from "../services/clinical-engine";

const router = Router();
router.use(authenticate, requirePremium);

router.post("/analyze", validate(coachSchema), async (req, res, next) => {
  try {
    const userId = req.auth!.sub;
    const { mealLogId } = req.body as { mealLogId?: string; prompt?: string };

    if (!mealLogId) throw badRequest("mealLogId is required");

    const log = await prisma.dailyMealLog.findFirst({
      where: { id: mealLogId, userId },
      include: { food: true },
    });
    if (!log) throw notFound("Meal log not found");

    const { profile } = await loadClinicalProfile(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    const dayStart = new Date(log.loggedAt);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const [priorLogs, last7DaysLogs] = await Promise.all([
      prisma.dailyMealLog.findMany({
        where: { userId, loggedAt: { gte: dayStart, lt: dayEnd }, id: { not: log.id } },
      }),
      prisma.dailyMealLog.findMany({
        where: { userId, loggedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        orderBy: { loggedAt: "asc" },
      }),
    ]);

    const ingredients = Array.isArray(log.food.commonIngredients)
      ? (log.food.commonIngredients as string[])
      : [];

    const evaluation = evaluateMeal({
      profile,
      meal: {
        food: {
          dishName: log.food.dishName,
          calories: log.food.calories,
          proteinG: log.food.proteinG,
          carbsG: log.food.carbsG,
          fatG: log.food.fatG,
          sodiumMg: log.food.sodiumMg,
          potassiumMg: log.food.potassiumMg,
          phosphorusMg: log.food.phosphorusMg,
          glycemicIndex: log.food.glycemicIndex,
          glycemicLoad: log.food.glycemicLoad,
          commonIngredients: ingredients,
          servingUnit: log.food.servingUnit,
        },
        portionMultiplier: log.portionMultiplier,
        mealType: log.mealType,
        loggedAt: log.loggedAt,
      },
      priorMealsToday: priorLogs.map((l) => ({
        calories: l.totalCalories,
        proteinG: l.totalProteinG,
        carbsG: l.totalCarbsG,
        fatG: l.totalFatG,
        sodiumMg: l.totalSodiumMg,
        potassiumMg: l.totalPotassiumMg,
        phosphorusMg: l.totalPhosphorusMg,
        glycemicLoad: l.totalGlycemicLoad,
      })),
    });

    const byDay = new Map<string, ReturnType<typeof sumTotals>>();
    for (const l of last7DaysLogs) {
      const key = l.loggedAt.toISOString().slice(0, 10);
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
            calories: l.totalCalories,
            proteinG: l.totalProteinG,
            carbsG: l.totalCarbsG,
            fatG: l.totalFatG,
            sodiumMg: l.totalSodiumMg,
            potassiumMg: l.totalPotassiumMg,
            phosphorusMg: l.totalPhosphorusMg,
            glycemicLoad: l.totalGlycemicLoad,
          },
        ]),
      );
    }

    const result = await analyzeMeal({
      user: {
        fullName: user?.fullName ?? "Patient",
        age: user?.profile?.age,
        sex: user?.profile?.sex,
        bmi: user?.profile?.bmi,
        weightKg: user?.profile?.weightKg ?? profile.weightKg,
        activityLevel: user?.profile?.activityLevel,
        tier: user?.tier ?? "premium",
      },
      clinical: profile,
      meal: {
        dishName: log.food.dishName,
        localName: log.food.localName ?? undefined,
        servingUnit: log.food.servingUnit,
        portionMultiplier: log.portionMultiplier,
        mealType: log.mealType,
        loggedAt: log.loggedAt.toISOString(),
        ingredients,
        nutrition: {
          dishName: log.food.dishName,
          calories: log.food.calories,
          proteinG: log.food.proteinG,
          carbsG: log.food.carbsG,
          fatG: log.food.fatG,
          sodiumMg: log.food.sodiumMg,
          potassiumMg: log.food.potassiumMg,
          phosphorusMg: log.food.phosphorusMg,
          glycemicIndex: log.food.glycemicIndex,
          glycemicLoad: log.food.glycemicLoad,
          commonIngredients: ingredients,
        },
      },
      evaluation,
      last7Days: [...byDay.values()],
    });

    await prisma.aiCoachConversation.create({
      data: {
        userId,
        mealLogId: log.id,
        prompt: req.body.prompt ?? `Analyze my ${log.food.dishName}`,
        aiResponse: JSON.stringify(result.response),
        flaggedNutrients: evaluation.flaggedIngredients,
        complianceStatus: result.response.compliance_status,
      },
    });

    res.json({
      ...result.response,
      engine: {
        compliance_status: evaluation.complianceStatus,
        alerts: evaluation.alerts,
        daily_totals: evaluation.dailyTotals,
        targets: evaluation.targets,
      },
      source: result.source,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/conversations", async (req, res, next) => {
  try {
    const conversations = await prisma.aiCoachConversation.findMany({
      where: { userId: req.auth!.sub },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    res.json(conversations);
  } catch (err) {
    next(err);
  }
});

export default router;
