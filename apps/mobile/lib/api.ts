import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

export const API_URL =
  (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl ??
  "http://localhost:4000";

const TOKEN_KEY = "nutribyte.accessToken";
const REFRESH_KEY = "nutribyte.refreshToken";

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function setSession(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, accessToken],
    [REFRESH_KEY, refreshToken],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
}

async function refreshSession(): Promise<boolean> {
  const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return false;
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  await setSession(data.accessToken, data.refreshToken);
  return true;
}

export async function api<T>(
  path: string,
  options: RequestInit & { skipAuth?: boolean } = {},
  retry = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (!options.skipAuth) {
    const token = await getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !options.skipAuth) {
    const ok = await refreshSession();
    if (ok) return api<T>(path, options, false);
    await clearSession();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Request failed");
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface Food {
  id: string;
  dishName: string;
  localName: string | null;
  category: string;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  glycemicIndex: number | null;
  glycemicLoad: number | null;
  commonIngredients: string[];
  isVerified: boolean;
}

export interface MealTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  glycemicLoad: number;
}

export interface DailySummary {
  date: string;
  totals: MealTotals;
  targets: {
    sodiumMg: number;
    potassiumMg: number;
    proteinG: number;
    glycemicLoad: number;
    calories: number;
    phosphorusMg: number;
  };
  remaining: {
    calories: number;
    sodiumMg: number;
    potassiumMg: number;
    proteinG: number;
    glycemicLoad: number;
  };
  logs: Array<{
    id: string;
    mealType: string;
    loggedAt: string;
    portionMultiplier: number;
    dishName: string;
    localName: string | null;
    servingUnit: string;
    totals: MealTotals;
  }>;
}

export interface CoachResult {
  compliance_status: "SAFE" | "WARNING" | "CRITICAL";
  feedback_message: string;
  flagged_ingredients: string[];
  suggested_substitutions: Array<{ original: string; replacement: string }>;
  macro_adjustment_next_meal: string;
  engine: {
    compliance_status: string;
    alerts: Array<{ kind: string; severity: string; title: string; message: string }>;
    daily_totals: MealTotals;
    targets: DailySummary["targets"];
  };
  source: "ai" | "fallback";
}
