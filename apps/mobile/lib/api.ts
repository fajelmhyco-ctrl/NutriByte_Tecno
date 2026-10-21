import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const DEV_API_PORT = 4000;
const REQUEST_TIMEOUT_MS = 12_000;

function devServerHost(): string | null {
  const candidates = [Constants.expoConfig?.hostUri, Constants.expoGoConfig?.debuggerHost];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const host = candidate
      .replace(/^[a-z]+:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .trim();
    if (host) return host;
  }
  return null;
}

function isPrivateLanHost(host: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
}

function isLoopbackUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function resolveApiUrl(): string {
  // Expo Go on a physical device cannot reach the PC through "localhost".
  // Set EXPO_PUBLIC_API_URL to your computer's LAN address to override detection.
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");

  const configured = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl?.trim();
  if (configured && !isLoopbackUrl(configured)) return configured.replace(/\/+$/, "");

  // In Expo Go, hostUri is the Metro address the phone used to load the app.
  // Reuse that LAN IP so API requests go to the development machine, not the phone.
  const host = devServerHost();
  if (host && isPrivateLanHost(host)) {
    return `http://${host}:${DEV_API_PORT}`;
  }

  return configured || `http://localhost:${DEV_API_PORT}`;
}

export const API_URL = resolveApiUrl();

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  if (init.signal) return fetch(input, init);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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
  const res = await fetchWithTimeout(`${API_URL}/api/auth/refresh`, {
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

  const res = await fetchWithTimeout(`${API_URL}${path}`, { ...options, headers });

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
