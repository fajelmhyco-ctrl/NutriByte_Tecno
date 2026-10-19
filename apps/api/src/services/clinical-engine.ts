/**
 * NutriByte Clinical Safety Engine
 *
 * Deterministic, testable rules that run BEFORE any AI output reaches a patient.
 * The AI Coach is advisory; this engine is the source of truth for clinical limits.
 */

export type CkdStage = 0 | 1 | 2 | 3 | 4 | 5;

export interface ClinicalProfile {
  hasDiabetes: boolean;
  hasHypertension: boolean;
  ckdStage: number;
  isDialysis?: boolean;
  weightKg: number;
  age?: number;
  sex?: "male" | "female" | "other";
  activityLevel?: string;
  targetSodiumMg?: number;
  targetPotassiumMg?: number;
  targetProteinG?: number;
  targetGlycemicLoad?: number;
  targetCalories?: number;
  targetPhosphorusMg?: number;
}

export interface FoodNutrition {
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  glycemicIndex?: number | null;
  glycemicLoad?: number | null;
  commonIngredients?: string[];
  servingUnit?: string;
}

export interface LoggedMealInput {
  food: FoodNutrition;
  portionMultiplier: number;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  loggedAt?: Date;
}

export interface DailyTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  glycemicLoad: number;
}

export type Severity = "info" | "warning" | "critical";

export interface ClinicalAlertResult {
  kind:
    | "sodium_exceeded"
    | "sodium_enhancer_detected"
    | "potassium_exceeded"
    | "phosphorus_exceeded"
    | "protein_exceeded"
    | "glycemic_load_exceeded"
    | "calorie_target_exceeded";
  severity: Severity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface SubstitutionSuggestion {
  original: string;
  replacement: string;
  reason: string;
}

export interface ClinicalEvaluation {
  complianceStatus: "SAFE" | "WARNING" | "CRITICAL";
  alerts: ClinicalAlertResult[];
  flaggedIngredients: string[];
  substitutions: SubstitutionSuggestion[];
  mealTotals: DailyTotals;
  dailyTotals: DailyTotals;
  targets: {
    sodiumMg: number;
    potassiumMg: number;
    proteinG: number;
    glycemicLoad: number;
    calories: number;
    phosphorusMg: number;
  };
}

const HIGH_SODIUM_ENHANCERS = [
  "soy sauce",
  "toyo",
  "fish sauce",
  "patis",
  "bagoong",
  "shrimp paste",
  "salt",
  "tuyo",
  "dried fish",
  "bouillon",
  "magic sarap",
  "knorr",
  "oyster sauce",
  "hoisin",
  "ketchup",
  "banana ketchup",
  "salted egg",
  "itlog na maalat",
  "hotdog",
  "longganisa",
  "corned beef",
  "instant noodles",
  "pancit canton",
];

const HIGH_POTASSIUM_INGREDIENTS = [
  "spinach",
  "banana",
  "saba",
  "saging",
  "kangkong",
  "water spinach",
  "kamote",
  "sweet potato",
  "potato",
  "patatas",
  "tomato",
  "mung beans",
  "monggo",
  "coconut water",
  "buko",
  "avocado",
  "malunggay",
  "squash",
  "kalabasa",
  "orange",
  "melon",
  "papaya",
  "beans",
  "lentils",
];

const HIGH_PHOSPHORUS_INGREDIENTS = [
  "cheese",
  "keso",
  "milk",
  "gatas",
  "evaporated milk",
  "condensed milk",
  "processed meat",
  "hotdog",
  "longganisa",
  "bacon",
  "ham",
  "sardines",
  "dilis",
  "tuyo",
  "dried fish",
  "nuts",
  "peanut",
  "peanut butter",
  "cola",
  "soft drink",
  "instant noodles",
];

const SUBSTITUTION_MAP: Record<string, SubstitutionSuggestion> = {
  "fish sauce": {
    original: "Fish sauce (patis)",
    replacement: "Calamansi juice with garlic, pepper, and a pinch of salt-free herb mix",
    reason: "Cuts roughly 1,400 mg sodium per tablespoon while keeping the sour-savory profile.",
  },
  patis: {
    original: "Patis",
    replacement: "Calamansi + crushed garlic + ground pepper",
    reason: "A Filipino sour-salty alternative with negligible sodium.",
  },
  "soy sauce": {
    original: "Soy sauce (toyo)",
    replacement: "Low-sodium soy sauce measured at 1 tsp, or coconut aminos",
    reason: "Reduces sodium by 40-60% per serving without losing the savory taste.",
  },
  toyo: {
    original: "Toyo",
    replacement: "Low-sodium toyo (1 tsp) or coconut aminos",
    reason: "Portion control and lower-sodium variants protect blood pressure.",
  },
  bagoong: {
    original: "Bagoong / shrimp paste",
    replacement: "Calamansi, garlic, and chili dip; or 1/2 tsp bagoong max",
    reason: "Bagoong is one of the highest-sodium Filipino condiments.",
  },
  "shrimp paste": {
    original: "Shrimp paste",
    replacement: "Calamansi with fresh herbs",
    reason: "Avoids a large sodium spike.",
  },
  salt: {
    original: "Added salt",
    replacement: "Calamansi, herbs (tanglad, dahon ng laurel), and black pepper",
    reason: "Adds flavor with minimal sodium.",
  },
  spinach: {
    original: "Spinach",
    replacement: "Sayote or pechay (blanched)",
    reason: "Lower potassium per serving, suitable for CKD stages 3-5.",
  },
  banana: {
    original: "Banana (saba)",
    replacement: "Apple slices or a small portion of pineapple",
    reason: "Lower potassium fruit option for CKD.",
  },
  saba: {
    original: "Saba banana",
    replacement: "Apple or pineapple (small portion)",
    reason: "Reduces potassium load.",
  },
  "water spinach": {
    original: "Kangkong",
    replacement: "Sayote or pechay",
    reason: "Lower potassium green for renal diets.",
  },
  kangkong: {
    original: "Kangkong",
    replacement: "Sayote or pechay",
    reason: "Lower potassium green for renal diets.",
  },
  "sweet potato": {
    original: "Kamote",
    replacement: "Small serving of white rice or sayote",
    reason: "Lower potassium and adjusted carbohydrate load.",
  },
  kamote: {
    original: "Kamote",
    replacement: "Small serving of white rice or sayote",
    reason: "Lower potassium alternative.",
  },
  "peanut butter": {
    original: "Peanut butter",
    replacement: "Unsalted cashew or sunflower seed butter in small amounts",
    reason: "Lowers phosphorus and sodium additives.",
  },
  "instant noodles": {
    original: "Instant noodles / pancit canton",
    replacement: "Fresh miki or bihon cooked with low-sodium broth",
    reason: "Instant noodles are high in sodium and phosphate additives.",
  },
  tuyo: {
    original: "Tuyo (dried fish)",
    replacement: "Grilled galunggong or bangus with calamansi",
    reason: "Dried fish is extremely high in sodium and phosphorus.",
  },
  "dried fish": {
    original: "Dried fish",
    replacement: "Fresh grilled fish with calamansi",
    reason: "Fresh fish is far lower in sodium and phosphate.",
  },
};

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function calculateGlycemicLoad(glycemicIndex: number, carbsG: number): number {
  return round((glycemicIndex * carbsG) / 100, 1);
}

export function calculateBmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const heightM = heightCm / 100;
  return round(weightKg / (heightM * heightM), 1);
}

export function calculateMealTotals(meal: LoggedMealInput): DailyTotals {
  const multiplier = meal.portionMultiplier > 0 ? meal.portionMultiplier : 1;
  const food = meal.food;
  const gl =
    food.glycemicLoad != null
      ? food.glycemicLoad * multiplier
      : food.glycemicIndex != null
        ? calculateGlycemicLoad(food.glycemicIndex, food.carbsG * multiplier)
        : 0;

  return {
    calories: round(food.calories * multiplier),
    proteinG: round(food.proteinG * multiplier),
    carbsG: round(food.carbsG * multiplier),
    fatG: round(food.fatG * multiplier),
    sodiumMg: round(food.sodiumMg * multiplier),
    potassiumMg: round(food.potassiumMg * multiplier),
    phosphorusMg: round(food.phosphorusMg * multiplier),
    glycemicLoad: round(gl),
  };
}

export function sumTotals(items: DailyTotals[]): DailyTotals {
  return items.reduce<DailyTotals>(
    (acc, item) => ({
      calories: round(acc.calories + item.calories),
      proteinG: round(acc.proteinG + item.proteinG),
      carbsG: round(acc.carbsG + item.carbsG),
      fatG: round(acc.fatG + item.fatG),
      sodiumMg: round(acc.sodiumMg + item.sodiumMg),
      potassiumMg: round(acc.potassiumMg + item.potassiumMg),
      phosphorusMg: round(acc.phosphorusMg + item.phosphorusMg),
      glycemicLoad: round(acc.glycemicLoad + item.glycemicLoad),
    }),
    {
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      sodiumMg: 0,
      potassiumMg: 0,
      phosphorusMg: 0,
      glycemicLoad: 0,
    },
  );
}

/**
 * Derives safe daily targets. Explicit clinician-set targets always win, but are
 * clamped to the safety ceilings for hypertension / CKD.
 */
export function deriveTargets(profile: ClinicalProfile) {
  const renal = profile.ckdStage > 0;
  const stage = Math.min(Math.max(profile.ckdStage, 0), 5);

  const sodiumCeiling = profile.hasHypertension || renal ? 2000 : 2300;
  const sodiumMg = Math.min(profile.targetSodiumMg ?? sodiumCeiling, sodiumCeiling);

  const potassiumMg =
    profile.targetPotassiumMg ?? (stage >= 3 ? 2000 : stage > 0 ? 3000 : 3500);

  const phosphorusMg =
    profile.targetPhosphorusMg ?? (stage >= 3 ? 800 : 1000);

  const proteinG =
    profile.targetProteinG ??
    (() => {
      const w = profile.weightKg > 0 ? profile.weightKg : 60;
      if (stage >= 3 && stage <= 5 && !profile.isDialysis) {
        return round(w * 0.8, 1);
      }
      if (profile.isDialysis) return round(w * 1.2, 1);
      return round(w * 1.0, 1);
    })();

  const glycemicLoad = profile.targetGlycemicLoad ?? 100;
  const calories = profile.targetCalories ?? 2000;

  return {
    sodiumMg: round(sodiumMg, 0),
    potassiumMg: round(potassiumMg, 0),
    proteinG,
    glycemicLoad,
    calories,
    phosphorusMg: round(phosphorusMg, 0),
  };
}

export function detectHighSodiumEnhancers(ingredients: string[]): string[] {
  const found = new Set<string>();
  for (const raw of ingredients) {
    const ing = normalize(raw);
    for (const enhancer of HIGH_SODIUM_ENHANCERS) {
      if (ing === enhancer || ing.includes(enhancer)) found.add(enhancer);
    }
  }
  return [...found];
}

export function detectHighPotassiumIngredients(ingredients: string[]): string[] {
  const found = new Set<string>();
  for (const raw of ingredients) {
    const ing = normalize(raw);
    for (const item of HIGH_POTASSIUM_INGREDIENTS) {
      if (ing === item || ing.includes(item)) found.add(item);
    }
  }
  return [...found];
}

export function detectHighPhosphorusIngredients(ingredients: string[]): string[] {
  const found = new Set<string>();
  for (const raw of ingredients) {
    const ing = normalize(raw);
    for (const item of HIGH_PHOSPHORUS_INGREDIENTS) {
      if (ing === item || ing.includes(item)) found.add(item);
    }
  }
  return [...found];
}

function buildSubstitutions(flagged: string[], profile: ClinicalProfile): SubstitutionSuggestion[] {
  const results = new Map<string, SubstitutionSuggestion>();

  for (const item of flagged) {
    const mapped = SUBSTITUTION_MAP[item];
    if (mapped) results.set(mapped.original, mapped);
  }

  const renal = profile.ckdStage >= 3;
  if (renal && flagged.some((f) => HIGH_POTASSIUM_INGREDIENTS.includes(f))) {
    results.set("High-potassium produce", {
      original: "Spinach / banana / kangkong",
      replacement: "Sayote, pechay, or talong (blanched and water discarded)",
      reason: "CKD stages 3-5 require potassium restriction; these local vegetables are lower in potassium.",
    });
  }

  return [...results.values()];
}

export interface EvaluateOptions {
  profile: ClinicalProfile;
  meal: LoggedMealInput;
  priorMealsToday?: DailyTotals[];
  historicalDailyTotals?: DailyTotals[];
}

export function evaluateMeal({
  profile,
  meal,
  priorMealsToday = [],
}: EvaluateOptions): ClinicalEvaluation {
  const targets = deriveTargets(profile);
  const mealTotals = calculateMealTotals(meal);
  const dailyTotals = sumTotals([...priorMealsToday, mealTotals]);

  const ingredients = meal.food.commonIngredients ?? [];
  const sodiumEnhancers = detectHighSodiumEnhancers(ingredients);
  const highPotassium = detectHighPotassiumIngredients(ingredients);
  const highPhosphorus = detectHighPhosphorusIngredients(ingredients);

  const alerts: ClinicalAlertResult[] = [];
  const flaggedIngredients = new Set<string>();

  // --- Sodium rules -------------------------------------------------------
  const sodiumRestricted = profile.hasHypertension || profile.ckdStage > 0;

  if (sodiumRestricted && sodiumEnhancers.length > 0) {
    for (const enhancer of sodiumEnhancers) flaggedIngredients.add(enhancer);
    alerts.push({
      kind: "sodium_enhancer_detected",
      severity: "warning",
      title: "High-sodium ingredient detected",
      message:
        `This dish contains ${sodiumEnhancers.join(", ")}, a high-sodium enhancer. ` +
        `Your daily ceiling is ${targets.sodiumMg} mg. Use calamansi, garlic, and herbs instead.`,
      metadata: { enhancers: sodiumEnhancers, mealSodiumMg: mealTotals.sodiumMg },
    });
  }

  if (sodiumRestricted && dailyTotals.sodiumMg >= targets.sodiumMg) {
    alerts.push({
      kind: "sodium_exceeded",
      severity: dailyTotals.sodiumMg >= targets.sodiumMg * 1.25 ? "critical" : "warning",
      title: "Daily sodium ceiling reached",
      message:
        `You are at ${Math.round(dailyTotals.sodiumMg)} mg sodium today, above your ` +
        `${targets.sodiumMg} mg limit. Keep the next meal low-salt and avoid patis, toyo, and bagoong.`,
      metadata: { dailySodiumMg: dailyTotals.sodiumMg, targetSodiumMg: targets.sodiumMg },
    });
  }

  // --- Glycemic rules -----------------------------------------------------
  if (profile.hasDiabetes) {
    if (mealTotals.glycemicLoad > 20) {
      alerts.push({
        kind: "glycemic_load_exceeded",
        severity: mealTotals.glycemicLoad > 30 ? "critical" : "warning",
        title: "High glycemic load meal",
        message:
          `This meal has a glycemic load of ${mealTotals.glycemicLoad} (target: 20 or less per meal). ` +
          `Pair with protein and vegetables, and consider halving the rice portion.`,
        metadata: { mealGlycemicLoad: mealTotals.glycemicLoad },
      });
    }
    if (dailyTotals.glycemicLoad > targets.glycemicLoad) {
      alerts.push({
        kind: "glycemic_load_exceeded",
        severity: "warning",
        title: "Daily glycemic load above target",
        message: `Daily glycemic load is ${dailyTotals.glycemicLoad} against a target of ${targets.glycemicLoad}.`,
        metadata: { dailyGlycemicLoad: dailyTotals.glycemicLoad, target: targets.glycemicLoad },
      });
    }
  }

  // --- CKD rules ----------------------------------------------------------
  if (profile.ckdStage >= 3) {
    if (dailyTotals.proteinG > targets.proteinG) {
      alerts.push({
        kind: "protein_exceeded",
        severity: "warning",
        title: "Protein intake above renal target",
        message:
          `Protein today is ${dailyTotals.proteinG} g, above your ${targets.proteinG} g target ` +
          `(0.6-0.8 g/kg for CKD stages 3-5, non-dialysis). Choose plant proteins and smaller meat portions.`,
        metadata: { dailyProteinG: dailyTotals.proteinG, targetProteinG: targets.proteinG },
      });
    }

    if (highPotassium.length > 0) {
      for (const item of highPotassium) flaggedIngredients.add(item);
      alerts.push({
        kind: "potassium_exceeded",
        severity: "warning",
        title: "High-potassium ingredient flagged",
        message:
          `This dish includes ${highPotassium.join(", ")}. For CKD stage ${profile.ckdStage}, ` +
          `prefer sayote or pechay and discard cooking water.`,
        metadata: { ingredients: highPotassium },
      });
    }

    if (dailyTotals.potassiumMg > targets.potassiumMg) {
      alerts.push({
        kind: "potassium_exceeded",
        severity: dailyTotals.potassiumMg > targets.potassiumMg * 1.2 ? "critical" : "warning",
        title: "Daily potassium above renal target",
        message:
          `Potassium today is ${Math.round(dailyTotals.potassiumMg)} mg, above your ` +
          `${targets.potassiumMg} mg target. Avoid buko juice, banana, and kangkong for the rest of the day.`,
        metadata: { dailyPotassiumMg: dailyTotals.potassiumMg, targetPotassiumMg: targets.potassiumMg },
      });
    }

    if (highPhosphorus.length > 0) {
      for (const item of highPhosphorus) flaggedIngredients.add(item);
      alerts.push({
        kind: "phosphorus_exceeded",
        severity: "warning",
        title: "High-phosphorus ingredient flagged",
        message:
          `This dish includes ${highPhosphorus.join(", ")}. Limit processed meats, cheese, and dark sodas ` +
          `to protect kidney function.`,
        metadata: { ingredients: highPhosphorus },
      });
    }

    if (dailyTotals.phosphorusMg > targets.phosphorusMg) {
      alerts.push({
        kind: "phosphorus_exceeded",
        severity: "warning",
        title: "Daily phosphorus above target",
        message:
          `Phosphorus today is ${Math.round(dailyTotals.phosphorusMg)} mg against a ` +
          `${targets.phosphorusMg} mg target.`,
        metadata: { dailyPhosphorusMg: dailyTotals.phosphorusMg, targetPhosphorusMg: targets.phosphorusMg },
      });
    }
  }

  // --- Calorie rules ------------------------------------------------------
  if (dailyTotals.calories > targets.calories * 1.1) {
    alerts.push({
      kind: "calorie_target_exceeded",
      severity: "info",
      title: "Calorie target exceeded",
      message: `You are ${Math.round(dailyTotals.calories - targets.calories)} kcal above your daily target.`,
      metadata: { dailyCalories: dailyTotals.calories, targetCalories: targets.calories },
    });
  }

  const hasCritical = alerts.some((a) => a.severity === "critical");
  const hasWarning = alerts.some((a) => a.severity === "warning");
  const complianceStatus: ClinicalEvaluation["complianceStatus"] = hasCritical
    ? "CRITICAL"
    : hasWarning
      ? "WARNING"
      : "SAFE";

  return {
    complianceStatus,
    alerts,
    flaggedIngredients: [...flaggedIngredients],
    substitutions: buildSubstitutions([...flaggedIngredients], profile),
    mealTotals,
    dailyTotals,
    targets,
  };
}

export function weeklyTrend(history: DailyTotals[]): {
  avgSodiumMg: number;
  avgPotassiumMg: number;
  avgProteinG: number;
  avgCalories: number;
  avgGlycemicLoad: number;
  daysLogged: number;
} {
  if (history.length === 0) {
    return {
      avgSodiumMg: 0,
      avgPotassiumMg: 0,
      avgProteinG: 0,
      avgCalories: 0,
      avgGlycemicLoad: 0,
      daysLogged: 0,
    };
  }
  const total = sumTotals(history);
  const n = history.length;
  return {
    avgSodiumMg: round(total.sodiumMg / n),
    avgPotassiumMg: round(total.potassiumMg / n),
    avgProteinG: round(total.proteinG / n),
    avgCalories: round(total.calories / n),
    avgGlycemicLoad: round(total.glycemicLoad / n),
    daysLogged: n,
  };
}
