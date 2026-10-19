export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "nutribyte.accessToken";
const REFRESH_KEY = "nutribyte.refreshToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setSession(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function refresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  setSession(data.accessToken, data.refreshToken);
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
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (res.status === 401 && retry && !options.skipAuth) {
    const refreshed = await refresh();
    if (refreshed) return api<T>(path, options, false);
    clearSession();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      body?.error?.message ?? "Request failed",
      body?.error?.code,
    );
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: "consumer" | "patient" | "dietitian" | "admin";
  tier: "free" | "premium";
  isVerified: boolean;
  createdAt: string;
}

export interface PatientLink {
  id: string;
  patientId: string;
  dietitianId: string;
  status: "active" | "pending" | "revoked";
  createdAt: string;
  patient: {
    id: string;
    fullName: string;
    email: string;
    tier: string;
    profile: {
      age: number;
      sex: string;
      heightCm: number;
      weightKg: number;
      bmi: number;
      activityLevel: string;
    } | null;
    clinicalFlags: {
      hasDiabetes: boolean;
      hasHypertension: boolean;
      ckdStage: number;
      targetSodiumMg: number;
      targetPotassiumMg: number;
      targetProteinG: number;
      targetGlycemicLoad: number;
    } | null;
  };
}

export interface DailyPoint {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  potassiumMg: number;
  phosphorusMg: number;
  glycemicLoad: number;
}

export interface PatientOverview {
  patient: {
    id: string;
    fullName: string;
    email: string;
    tier: string;
    createdAt: string;
    profile: PatientLink["patient"]["profile"];
    clinicalFlags: PatientLink["patient"]["clinicalFlags"] & {
      isDialysis: boolean;
      targetCalories: number;
      targetPhosphorusMg: number;
    } | null;
  };
  targets: {
    sodiumMg: number;
    potassiumMg: number;
    proteinG: number;
    glycemicLoad: number;
    calories: number;
    phosphorusMg: number;
  };
  dailySeries: DailyPoint[];
  alerts: Array<{
    id: string;
    kind: string;
    severity: "info" | "warning" | "critical";
    title: string;
    message: string;
    createdAt: string;
    isRead: boolean;
  }>;
  sessions: Array<{
    id: string;
    scheduledAt: string;
    status: string;
    paymentStatus: string;
    amountPhp: number;
  }>;
  weightLogs: Array<{ id: string; weightKg: number; loggedAt: string }>;
  adherenceRate: number;
  recentMeals: Array<{
    id: string;
    loggedAt: string;
    mealType: string;
    dishName: string;
    localName: string | null;
    category: string;
    sodiumMg: number;
    potassiumMg: number;
    glycemicLoad: number;
    calories: number;
  }>;
}
