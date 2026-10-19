"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setSession, User } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("dietitian@nutribyte.ph");
  const [password, setPassword] = useState("NutriByte123!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ user: User; accessToken: string; refreshToken: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password }),
          skipAuth: true,
        },
      );
      if (result.user.role !== "dietitian" && result.user.role !== "admin") {
        setError("This portal is for licensed dietitians and administrators.");
        return;
      }
      setSession(result.accessToken, result.refreshToken);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-brand-700 p-12 text-white lg:flex">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-200">NutriByte Philippines</p>
          <h1 className="mt-6 max-w-md text-4xl font-bold leading-tight">
            Clinical nutrition that finally understands Filipino food.
          </h1>
          <p className="mt-4 max-w-md text-brand-100">
            Monitor sodium, potassium, phosphorus, protein, and glycemic load across adobo, sinigang,
            kare-kare, and 30+ verified local dishes.
          </p>
        </div>
        <ul className="space-y-2 text-sm text-brand-100">
          <li>• CKD stage-aware nutrient ceilings</li>
          <li>• Hypertension sodium alerts under 2,000 mg</li>
          <li>• Glycemic load flagging above 20 per meal</li>
          <li>• Secure telehealth with GCash / Maya payments</li>
        </ul>
      </section>

      <section className="flex items-center justify-center p-6">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Dietitian sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Access your patient panel and consultations.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-xs text-slate-400">
            Demo: dietitian@nutribyte.ph / NutriByte123!
          </p>
        </form>
      </section>
    </main>
  );
}
