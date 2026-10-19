import { env } from "../config/env";
import {
  ClinicalEvaluation,
  ClinicalProfile,
  DailyTotals,
  FoodNutrition,
  weeklyTrend,
} from "./clinical-engine";

export interface CoachContext {
  user: {
    fullName: string;
    age?: number;
    sex?: string;
    bmi?: number;
    weightKg: number;
    activityLevel?: string;
    tier: string;
  };
  clinical: ClinicalProfile;
  meal: {
    dishName: string;
    localName?: string;
    servingUnit: string;
    portionMultiplier: number;
    mealType: string;
    loggedAt: string;
    ingredients: string[];
    nutrition: FoodNutrition;
  };
  evaluation: ClinicalEvaluation;
  last7Days: DailyTotals[];
}

export interface CoachResponse {
  compliance_status: "SAFE" | "WARNING" | "CRITICAL";
  feedback_message: string;
  flagged_ingredients: string[];
  suggested_substitutions: Array<{ original: string; replacement: string }>;
  macro_adjustment_next_meal: string;
}

const SAFETY_RULES = `
ABSOLUTE CLINICAL RULES (never violate, never negotiate):
1. Hypertension or CKD (any stage) => daily sodium must stay below 2000 mg.
2. CKD stages 3-5, non-dialysis => protein 0.6-0.8 g/kg body weight per day.
3. CKD => potassium and phosphorus are restricted; flag high-potassium local foods
   (kangkong, saba, kamote, buko juice, monggo) and high-phosphorus foods
   (processed meat, cheese, evaporated milk, dried fish, cola).
4. Diabetes => meal glycemic load above 20 is a WARNING; above 30 is CRITICAL.
   GL = (GI x carbohydrate grams) / 100.
5. Never diagnose, never prescribe medication, never tell a patient to stop a
   prescribed drug. Always defer medication questions to their physician.
6. If the deterministic evaluation returns CRITICAL, your compliance_status must
   be CRITICAL, even if you think the meal looks fine.
`.trim();

const PERSONA = `
You are "THE COACH", the clinical nutrition assistant of NutriByte Philippines.
Persona: warm, encouraging, and culturally fluent Filipino nutritionist-dietitian.
Language: clear English with natural Filipino food terms (adobo, sinigang, patis,
toyo, bagoong, sayote, pechay, kangkong, saba, kamote). You may use light Taglish
phrases like "Kaya natin ito!" or "Konting adjust lang" but never sacrifice clarity.
You know that Filipino dishes are often shared and that rice is central; give
realistic, incremental swaps rather than demanding an unrealistic diet.
Keep feedback to 2-4 sentences. Be specific with numbers (mg, g, GL).
`.trim();

export function buildSystemPrompt(): string {
  return [PERSONA, SAFETY_RULES].join("\n\n");
}

export function buildUserPrompt(context: CoachContext): string {
  const trend = weeklyTrend(context.last7Days);
  const { evaluation, clinical, meal, user } = context;

  const payload = {
    patient: {
      name: user.fullName,
      age: user.age,
      sex: user.sex,
      bmi: user.bmi,
      weight_kg: user.weightKg,
      activity_level: user.activityLevel,
      tier: user.tier,
    },
    clinical_flags: {
      has_diabetes: clinical.hasDiabetes,
      has_hypertension: clinical.hasHypertension,
      ckd_stage: clinical.ckdStage,
      is_dialysis: clinical.isDialysis ?? false,
    },
    daily_targets: evaluation.targets,
    meal_logged: {
      dish_name: meal.dishName,
      local_name: meal.localName,
      serving_unit: meal.servingUnit,
      portion_multiplier: meal.portionMultiplier,
      meal_type: meal.mealType,
      logged_at: meal.loggedAt,
      ingredients: meal.ingredients,
      nutrition: {
        calories: evaluation.mealTotals.calories,
        protein_g: evaluation.mealTotals.proteinG,
        carbs_g: evaluation.mealTotals.carbsG,
        fat_g: evaluation.mealTotals.fatG,
        sodium_mg: evaluation.mealTotals.sodiumMg,
        potassium_mg: evaluation.mealTotals.potassiumMg,
        phosphorus_mg: evaluation.mealTotals.phosphorusMg,
        glycemic_load: evaluation.mealTotals.glycemicLoad,
      },
    },
    daily_totals_after_meal: evaluation.dailyTotals,
    deterministic_alerts: evaluation.alerts,
    seven_day_average: trend,
    suggested_substitutions_from_engine: evaluation.substitutions,
  };

  return [
    "Analyze the meal below using the clinical rules.",
    "Return ONLY valid JSON matching this exact schema:",
    `{
  "compliance_status": "SAFE" | "WARNING" | "CRITICAL",
  "feedback_message": "string",
  "flagged_ingredients": ["string"],
  "suggested_substitutions": [{ "original": "string", "replacement": "string" }],
  "macro_adjustment_next_meal": "string"
}`,
    "Do not include markdown fences or commentary outside the JSON.",
    "",
    "PATIENT AND MEAL CONTEXT:",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new Error("AI response did not contain valid JSON");
  }
}

function coerceResponse(raw: unknown): CoachResponse {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const status = String(obj.compliance_status ?? "WARNING").toUpperCase();
  const compliance = ["SAFE", "WARNING", "CRITICAL"].includes(status)
    ? (status as CoachResponse["compliance_status"])
    : "WARNING";

  const flagged = Array.isArray(obj.flagged_ingredients)
    ? obj.flagged_ingredients.map(String)
    : [];
  const subs = Array.isArray(obj.suggested_substitutions)
    ? obj.suggested_substitutions
        .map((s) => s as Record<string, unknown>)
        .filter((s) => s && s.original && s.replacement)
        .map((s) => ({ original: String(s.original), replacement: String(s.replacement) }))
    : [];

  return {
    compliance_status: compliance,
    feedback_message: String(obj.feedback_message ?? "Keep logging your meals so I can guide you better."),
    flagged_ingredients: flagged,
    suggested_substitutions: subs,
    macro_adjustment_next_meal: String(
      obj.macro_adjustment_next_meal ?? "Choose a low-sodium, vegetable-rich meal next.",
    ),
  };
}

function deterministicFallback(context: CoachContext): CoachResponse {
  const { evaluation } = context;
  const alerts = evaluation.alerts;
  const status = evaluation.complianceStatus;

  const feedback =
    status === "SAFE"
      ? `Great job! Your ${context.meal.dishName} fits your current targets. Keep portions steady and stay hydrated.`
      : status === "WARNING"
        ? `Salamat for logging your ${context.meal.dishName}. ${alerts[0]?.message ?? "A small adjustment will help."}`
        : `Let's adjust gently. ${alerts[0]?.message ?? "This meal is over a clinical limit."} We can fix this in the next meal.`;

  const adjustment =
    alerts.find((a) => a.kind === "sodium_exceeded" || a.kind === "sodium_enhancer_detected")
      ? "Keep sodium under 500 mg for your next meal: no patis, toyo, or bagoong."
      : alerts.find((a) => a.kind === "glycemic_load_exceeded")
        ? "Halve your rice portion next meal and add protein and vegetables."
        : alerts.find((a) => a.kind === "potassium_exceeded")
          ? "Choose sayote or pechay next meal and avoid buko juice today."
          : "Maintain your portions and add a serving of low-potassium vegetables.";

  return {
    compliance_status: status,
    feedback_message: feedback,
    flagged_ingredients: evaluation.flaggedIngredients,
    suggested_substitutions: evaluation.substitutions.map((s) => ({
      original: s.original,
      replacement: s.replacement,
    })),
    macro_adjustment_next_meal: adjustment,
  };
}

async function callOpenAi(userPrompt: string): Promise<CoachResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI provider returned an empty response");
    return coerceResponse(extractJson(content));
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(userPrompt: string): Promise<CoachResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.AI_TIMEOUT_MS);

  try {
    const res = await fetch(`${env.AI_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.AI_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        max_tokens: 800,
        temperature: 0.3,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`AI provider error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as { content?: Array<{ text?: string }> };
    const content = data.content?.map((c) => c.text ?? "").join("") ?? "";
    if (!content) throw new Error("AI provider returned an empty response");
    return coerceResponse(extractJson(content));
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * The deterministic clinical engine ALWAYS overrides unsafe AI output.
 * AI can escalate severity but never downgrade a CRITICAL or WARNING.
 */
export function reconcileWithEngine(ai: CoachResponse, evaluation: ClinicalEvaluation): CoachResponse {
  const rank = { SAFE: 0, WARNING: 1, CRITICAL: 2 } as const;
  const engineStatus = evaluation.complianceStatus;
  const finalStatus =
    rank[ai.compliance_status] >= rank[engineStatus] ? ai.compliance_status : engineStatus;

  const mergedFlagged = [...new Set([...evaluation.flaggedIngredients, ...ai.flagged_ingredients])];
  const mergedSubs = [...ai.suggested_substitutions];
  for (const s of evaluation.substitutions) {
    if (!mergedSubs.some((m) => m.original.toLowerCase() === s.original.toLowerCase())) {
      mergedSubs.push({ original: s.original, replacement: s.replacement });
    }
  }

  return {
    ...ai,
    compliance_status: finalStatus,
    flagged_ingredients: mergedFlagged,
    suggested_substitutions: mergedSubs,
  };
}

export async function analyzeMeal(context: CoachContext): Promise<{
  response: CoachResponse;
  source: "ai" | "fallback";
  error?: string;
}> {
  if (!env.AI_API_KEY) {
    return { response: deterministicFallback(context), source: "fallback", error: "AI_API_KEY not configured" };
  }

  const userPrompt = buildUserPrompt(context);

  try {
    const raw = env.AI_PROVIDER === "anthropic" ? await callAnthropic(userPrompt) : await callOpenAi(userPrompt);
    return { response: reconcileWithEngine(raw, context.evaluation), source: "ai" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI error";
    console.warn("[ai-coach] falling back to deterministic engine:", message);
    return { response: deterministicFallback(context), source: "fallback", error: message };
  }
}
