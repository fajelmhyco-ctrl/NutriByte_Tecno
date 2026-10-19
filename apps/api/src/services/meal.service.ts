import { MealType, Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { notFound } from "../utils/errors";
import {
  ClinicalProfile,
  DailyTotals,
  calculateMealTotals,
  evaluateMeal,
  sumTotals,
} from "./clinical-engine";

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = startOfDay(date);
  d.setDate(d.getDate() + 1);
  return d;
}

export async function loadClinicalProfile(userId: string): Promise<{
  profile: ClinicalProfile;
  flagsRecord: Awaited<ReturnType<typeof prisma.clinicalFlags.findUnique>>;
}> {
  const [flags, userProfile] = await Promise.all([
    prisma.clinicalFlags.findUnique({ where: { userId } }),
    prisma.userProfile.findUnique({ where: { userId } }),
  ]);

  const weightKg = userProfile?.weightKg ?? 60;

  const profile: ClinicalProfile = {
    hasDiabetes: flags?.hasDiabetes ?? false,
    hasHypertension: flags?.hasHypertension ?? false,
    ckdStage: flags?.ckdStage ?? 0,
    isDialysis: flags?.isDialysis ?? false,
    weightKg,
    age: userProfile?.age,
    sex: userProfile?.sex,
    activityLevel: userProfile?.activityLevel,
    targetSodiumMg: flags?.targetSodiumMg,
    targetPotassiumMg: flags?.targetPotassiumMg,
    targetProteinG: flags?.targetProteinG,
    targetGlycemicLoad: flags?.targetGlycemicLoad,
    targetCalories: flags?.targetCalories,
    targetPhosphorusMg: flags?.targetPhosphorusMg,
  };

  return { profile, flagsRecord: flags };
}

function mealToTotals(meal: {
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  totalSodiumMg: number;
  totalPotassiumMg: number;
  totalPhosphorusMg: number;
  totalGlycemicLoad: number;
}): DailyTotals {
  return {
    calories: meal.totalCalories,
    proteinG: meal.totalProteinG,
    carbsG: meal.totalCarbsG,
    fatG: meal.totalFatG,
    sodiumMg: meal.totalSodiumMg,
    potassiumMg: meal.totalPotassiumMg,
    phosphorusMg: meal.totalPhosphorusMg,
    glycemicLoad: meal.totalGlycemicLoad,
  };
}

export async function createMealLog(
  userId: string,
  input: {
    foodId: string;
    portionMultiplier: number;
    mealType: MealType;
    loggedAt?: Date;
    notes?: string;
    clientUuid?: string;
  },
) {
  if (input.clientUuid) {
    const duplicate = await prisma.dailyMealLog.findUnique({ where: { clientUuid: input.clientUuid } });
    if (duplicate) return { log: duplicate, evaluation: null, duplicate: true };
  }

  const food = await prisma.filipinoFood.findUnique({ where: { id: input.foodId } });
  if (!food) throw notFound("Food not found in the Filipino food database");

  const { profile } = await loadClinicalProfile(userId);
  const loggedAt = input.loggedAt ?? new Date();

  const mealTotals = calculateMealTotals({
    food: {
      dishName: food.dishName,
      calories: food.calories,
      proteinG: food.proteinG,
      carbsG: food.carbsG,
      fatG: food.fatG,
      sodiumMg: food.sodiumMg,
      potassiumMg: food.potassiumMg,
      phosphorusMg: food.phosphorusMg,
      glycemicIndex: food.glycemicIndex,
      glycemicLoad: food.glycemicLoad,
      commonIngredients: Array.isArray(food.commonIngredients)
        ? (food.commonIngredients as string[])
        : [],
    },
    portionMultiplier: input.portionMultiplier,
    mealType: input.mealType,
    loggedAt,
  });

  const priorLogs = await prisma.dailyMealLog.findMany({
    where: { userId, loggedAt: { gte: startOfDay(loggedAt), lt: endOfDay(loggedAt) } },
  });

  const evaluation = evaluateMeal({
    profile,
    meal: {
      food: {
        dishName: food.dishName,
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        sodiumMg: food.sodiumMg,
        potassiumMg: food.potassiumMg,
        phosphorusMg: food.phosphorusMg,
        glycemicIndex: food.glycemicIndex,
        glycemicLoad: food.glycemicLoad,
        commonIngredients: Array.isArray(food.commonIngredients)
          ? (food.commonIngredients as string[])
          : [],
        servingUnit: food.servingUnit,
      },
      portionMultiplier: input.portionMultiplier,
      mealType: input.mealType,
      loggedAt,
    },
    priorMealsToday: priorLogs.map(mealToTotals),
  });

  const result = await prisma.$transaction(async (tx) => {
    const log = await tx.dailyMealLog.create({
      data: {
        userId,
        foodId: food.id,
        portionMultiplier: input.portionMultiplier,
        mealType: input.mealType,
        loggedAt,
        notes: input.notes,
        clientUuid: input.clientUuid,
        totalCalories: mealTotals.calories,
        totalProteinG: mealTotals.proteinG,
        totalCarbsG: mealTotals.carbsG,
        totalFatG: mealTotals.fatG,
        totalSodiumMg: mealTotals.sodiumMg,
        totalPotassiumMg: mealTotals.potassiumMg,
        totalPhosphorusMg: mealTotals.phosphorusMg,
        totalGlycemicLoad: mealTotals.glycemicLoad,
      },
    });

    if (evaluation.alerts.length > 0) {
      await tx.clinicalAlert.createMany({
        data: evaluation.alerts.map((alert) => ({
          userId,
          mealLogId: log.id,
          kind: alert.kind,
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          metadata: alert.metadata as Prisma.InputJsonValue,
        })),
      });
    }

    return log;
  });

  return { log: result, evaluation, duplicate: false };
}

export async function getDailySummary(userId: string, date: Date) {
  const { profile } = await loadClinicalProfile(userId);
  const logs = await prisma.dailyMealLog.findMany({
    where: { userId, loggedAt: { gte: startOfDay(date), lt: endOfDay(date) } },
    include: { food: true },
    orderBy: { loggedAt: "asc" },
  });

  const totals = sumTotals(logs.map(mealToTotals));
  const { deriveTargets } = await import("./clinical-engine");
  const targets = deriveTargets(profile);

  return {
    date: startOfDay(date).toISOString().slice(0, 10),
    totals,
    targets,
    remaining: {
      calories: Math.max(0, Math.round(targets.calories - totals.calories)),
      sodiumMg: Math.max(0, Math.round(targets.sodiumMg - totals.sodiumMg)),
      potassiumMg: Math.max(0, Math.round(targets.potassiumMg - totals.potassiumMg)),
      proteinG: Math.max(0, Math.round((targets.proteinG - totals.proteinG) * 10) / 10),
      glycemicLoad: Math.max(0, Math.round((targets.glycemicLoad - totals.glycemicLoad) * 10) / 10),
    },
    logs: logs.map((log) => ({
      id: log.id,
      mealType: log.mealType,
      loggedAt: log.loggedAt,
      portionMultiplier: log.portionMultiplier,
      dishName: log.food.dishName,
      localName: log.food.localName,
      servingUnit: log.food.servingUnit,
      totals: mealToTotals(log),
    })),
  };
}

export async function getHistory(userId: string, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.dailyMealLog.findMany({
    where: { userId, loggedAt: { gte: since } },
    include: { food: true },
    orderBy: { loggedAt: "asc" },
  });

  const byDay = new Map<string, DailyTotals>();
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
    byDay.set(key, sumTotals([current, mealToTotals(log)]));
  }

  return [...byDay.entries()]
    .map(([date, totals]) => ({ date, ...totals }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
