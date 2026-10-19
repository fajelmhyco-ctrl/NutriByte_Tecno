import { describe, expect, it } from "vitest";
import {
  calculateBmi,
  calculateGlycemicLoad,
  deriveTargets,
  detectHighSodiumEnhancers,
  evaluateMeal,
  ClinicalProfile,
  FoodNutrition,
} from "../src/services/clinical-engine";

const baseFood: FoodNutrition = {
  dishName: "Chicken Adobo",
  calories: 420,
  proteinG: 31,
  carbsG: 8,
  fatG: 29,
  sodiumMg: 1180,
  potassiumMg: 430,
  phosphorusMg: 240,
  glycemicIndex: 15,
  glycemicLoad: 1.2,
  commonIngredients: ["chicken", "soy sauce", "vinegar", "garlic"],
};

const healthyProfile: ClinicalProfile = {
  hasDiabetes: false,
  hasHypertension: false,
  ckdStage: 0,
  weightKg: 70,
};

const ckdProfile: ClinicalProfile = {
  hasDiabetes: true,
  hasHypertension: true,
  ckdStage: 3,
  weightKg: 70,
};

describe("calculateBmi", () => {
  it("computes BMI correctly", () => {
    expect(calculateBmi(70, 170)).toBeCloseTo(24.2, 1);
  });
  it("guards against zero height", () => {
    expect(calculateBmi(70, 0)).toBe(0);
  });
});

describe("calculateGlycemicLoad", () => {
  it("uses GI x carbs / 100", () => {
    expect(calculateGlycemicLoad(73, 53)).toBe(38.7);
  });
});

describe("deriveTargets", () => {
  it("applies a 2000mg sodium ceiling for hypertension", () => {
    const t = deriveTargets({ ...healthyProfile, hasHypertension: true, targetSodiumMg: 3000 });
    expect(t.sodiumMg).toBe(2000);
  });

  it("applies a 2000mg sodium ceiling for CKD", () => {
    const t = deriveTargets({ ...healthyProfile, ckdStage: 2 });
    expect(t.sodiumMg).toBe(2000);
  });

  it("restricts protein to 0.8 g/kg for CKD 3-5 non-dialysis", () => {
    const t = deriveTargets({ ...healthyProfile, ckdStage: 4, weightKg: 60 });
    expect(t.proteinG).toBe(48);
  });

  it("allows higher protein for dialysis patients", () => {
    const t = deriveTargets({ ...healthyProfile, ckdStage: 5, isDialysis: true, weightKg: 60 });
    expect(t.proteinG).toBe(72);
  });

  it("keeps default sodium at 2300mg for healthy users", () => {
    expect(deriveTargets(healthyProfile).sodiumMg).toBe(2300);
  });
});

describe("detectHighSodiumEnhancers", () => {
  it("detects soy sauce, patis, and bagoong", () => {
    const found = detectHighSodiumEnhancers(["Soy Sauce", "Patis", "Bagoong", "garlic"]);
    expect(found).toEqual(expect.arrayContaining(["soy sauce", "patis", "bagoong"]));
  });

  it("ignores benign ingredients", () => {
    expect(detectHighSodiumEnhancers(["chicken", "sayote", "garlic"])).toEqual([]);
  });
});

describe("evaluateMeal", () => {
  it("returns SAFE for a healthy user eating adobo", () => {
    const result = evaluateMeal({
      profile: healthyProfile,
      meal: { food: baseFood, portionMultiplier: 1, mealType: "lunch" },
    });
    expect(result.complianceStatus).toBe("SAFE");
    expect(result.alerts).toHaveLength(0);
  });

  it("flags high-sodium enhancers for a hypertensive patient", () => {
    const result = evaluateMeal({
      profile: { ...healthyProfile, hasHypertension: true },
      meal: { food: baseFood, portionMultiplier: 1, mealType: "lunch" },
    });
    expect(result.complianceStatus).toBe("WARNING");
    expect(result.flaggedIngredients).toContain("soy sauce");
    expect(result.alerts.some((a) => a.kind === "sodium_enhancer_detected")).toBe(true);
    expect(result.substitutions.length).toBeGreaterThan(0);
  });

  it("escalates to CRITICAL when sodium is far above target", () => {
    const salty: FoodNutrition = { ...baseFood, sodiumMg: 2600 };
    const result = evaluateMeal({
      profile: { ...healthyProfile, hasHypertension: true },
      meal: { food: salty, portionMultiplier: 1, mealType: "dinner" },
    });
    expect(result.complianceStatus).toBe("CRITICAL");
    expect(result.alerts.some((a) => a.kind === "sodium_exceeded" && a.severity === "critical")).toBe(true);
  });

  it("flags a high glycemic load meal for a diabetic patient", () => {
    const rice: FoodNutrition = {
      dishName: "White Rice",
      calories: 240,
      proteinG: 4.5,
      carbsG: 53,
      fatG: 0.4,
      sodiumMg: 2,
      potassiumMg: 55,
      phosphorusMg: 68,
      glycemicIndex: 73,
      glycemicLoad: 38.7,
      commonIngredients: ["rice", "water"],
    };
    const result = evaluateMeal({
      profile: { ...healthyProfile, hasDiabetes: true },
      meal: { food: rice, portionMultiplier: 1, mealType: "lunch" },
    });
    expect(result.complianceStatus).toBe("CRITICAL");
    expect(result.alerts.some((a) => a.kind === "glycemic_load_exceeded")).toBe(true);
  });

  it("flags high-potassium local foods for CKD and suggests sayote/pechay", () => {
    const kangkong: FoodNutrition = {
      dishName: "Kangkong",
      calories: 25,
      proteinG: 3,
      carbsG: 4,
      fatG: 0.3,
      sodiumMg: 45,
      potassiumMg: 380,
      phosphorusMg: 50,
      glycemicIndex: 15,
      glycemicLoad: 0.6,
      commonIngredients: ["kangkong", "garlic"],
    };
    const result = evaluateMeal({
      profile: { ...ckdProfile, ckdStage: 3 },
      meal: { food: kangkong, portionMultiplier: 1, mealType: "lunch" },
    });
    expect(result.flaggedIngredients).toContain("kangkong");
    expect(result.substitutions.some((s) => s.replacement.includes("Sayote") || s.replacement.includes("pechay"))).toBe(true);
  });

  it("restricts protein for CKD stage 4 when daily intake exceeds target", () => {
    const steak: FoodNutrition = {
      dishName: "Grilled Beef",
      calories: 400,
      proteinG: 45,
      carbsG: 0,
      fatG: 22,
      sodiumMg: 300,
      potassiumMg: 350,
      phosphorusMg: 250,
      commonIngredients: ["beef"],
    };
    const result = evaluateMeal({
      profile: { ...ckdProfile, ckdStage: 4, weightKg: 60 },
      meal: { food: steak, portionMultiplier: 1.5, mealType: "dinner" },
    });
    expect(result.alerts.some((a) => a.kind === "protein_exceeded")).toBe(true);
  });

  it("accumulates prior meals into daily totals", () => {
    const result = evaluateMeal({
      profile: { ...healthyProfile, hasHypertension: true },
      meal: { food: baseFood, portionMultiplier: 1, mealType: "dinner" },
      priorMealsToday: [
        {
          calories: 600,
          proteinG: 30,
          carbsG: 60,
          fatG: 20,
          sodiumMg: 1200,
          potassiumMg: 500,
          phosphorusMg: 200,
          glycemicLoad: 20,
        },
      ],
    });
    expect(result.dailyTotals.sodiumMg).toBe(2380);
    expect(result.alerts.some((a) => a.kind === "sodium_exceeded")).toBe(true);
  });
});
