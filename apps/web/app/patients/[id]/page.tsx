"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Shell from "@/components/Shell";
import StatCard from "@/components/StatCard";
import {
  GlycemicChart,
  PotassiumChart,
  ProteinChart,
  SodiumChart,
} from "@/components/NutrientCharts";
import { api, PatientOverview } from "@/lib/api";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PatientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<PatientOverview>(`/api/dietitian/patients/${params.id}/overview`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load patient"));
  }, [params.id]);

  if (error) {
    return (
      <Shell>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </Shell>
    );
  }

  if (!data) {
    return (
      <Shell>
        <p className="text-sm text-slate-500">Loading patient overview...</p>
      </Shell>
    );
  }

  const { patient, targets, dailySeries, alerts, recentMeals, adherenceRate } = data;
  const flags = patient.clinicalFlags;
  const latestSodium = dailySeries.at(-1)?.sodiumMg ?? 0;
  const latestPotassium = dailySeries.at(-1)?.potassiumMg ?? 0;

  return (
    <Shell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/dashboard" className="text-xs font-medium text-brand-700 hover:underline">
            ← Back to patients
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">{patient.fullName}</h1>
          <p className="text-sm text-slate-500">{patient.email}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {flags?.hasDiabetes && <span className="badge bg-blue-50 text-blue-700">Type 2 Diabetes</span>}
            {flags?.hasHypertension && <span className="badge bg-amber-50 text-amber-700">Hypertension</span>}
            {flags && flags.ckdStage > 0 && (
              <span className="badge bg-purple-50 text-purple-700">
                CKD Stage {flags.ckdStage}
                {flags.isDialysis ? " · Dialysis" : ""}
              </span>
            )}
            <span className="badge bg-slate-100 capitalize text-slate-600">{patient.tier}</span>
          </div>
        </div>
        <div className="card max-w-xs">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Clinical targets</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Sodium</dt><dd className="font-semibold">{targets.sodiumMg} mg</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Potassium</dt><dd className="font-semibold">{targets.potassiumMg} mg</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Phosphorus</dt><dd className="font-semibold">{targets.phosphorusMg} mg</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Protein</dt><dd className="font-semibold">{targets.proteinG} g</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Glycemic load</dt><dd className="font-semibold">{targets.glycemicLoad}</dd></div>
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Adherence (14d)"
          value={`${adherenceRate}%`}
          tone={adherenceRate >= 70 ? "good" : adherenceRate >= 40 ? "warn" : "danger"}
          hint="Days within all clinical limits"
        />
        <StatCard
          label="Latest sodium"
          value={`${Math.round(latestSodium)} mg`}
          tone={latestSodium > targets.sodiumMg ? "danger" : "good"}
          hint={`Limit ${targets.sodiumMg} mg`}
        />
        <StatCard
          label="Latest potassium"
          value={`${Math.round(latestPotassium)} mg`}
          tone={latestPotassium > targets.potassiumMg ? "danger" : "good"}
          hint={`Limit ${targets.potassiumMg} mg`}
        />
        <StatCard label="Alerts" value={alerts.length} tone={alerts.length > 0 ? "warn" : "neutral"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">Sodium trend</h2>
          <SodiumChart data={dailySeries} target={targets.sodiumMg} />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">Potassium trend</h2>
          <PotassiumChart data={dailySeries} target={targets.potassiumMg} />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">Glycemic load</h2>
          <GlycemicChart data={dailySeries} target={targets.glycemicLoad} />
        </div>
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">Protein intake</h2>
          <ProteinChart data={dailySeries} target={targets.proteinG} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">Recent therapeutic alerts</h2>
          {alerts.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No alerts recorded.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {alerts.slice(0, 8).map((alert) => (
                <li key={alert.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`badge ${
                        alert.severity === "critical"
                          ? "bg-red-50 text-red-700"
                          : alert.severity === "warning"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {alert.severity}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(alert.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-900">{alert.title}</p>
                  <p className="text-xs text-slate-600">{alert.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-slate-900">Recent meals</h2>
          {recentMeals.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No meals logged yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2">Dish</th>
                    <th className="py-2">Meal</th>
                    <th className="py-2 text-right">Na</th>
                    <th className="py-2 text-right">K</th>
                    <th className="py-2 text-right">GL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentMeals.map((meal) => (
                    <tr key={meal.id}>
                      <td className="py-2">
                        <p className="font-medium text-slate-900">{meal.dishName}</p>
                        <p className="text-xs text-slate-500">{formatDateTime(meal.loggedAt)}</p>
                      </td>
                      <td className="py-2 capitalize text-slate-600">{meal.mealType}</td>
                      <td className={`py-2 text-right ${meal.sodiumMg > targets.sodiumMg / 3 ? "font-semibold text-red-600" : "text-slate-600"}`}>
                        {Math.round(meal.sodiumMg)}
                      </td>
                      <td className="py-2 text-right text-slate-600">{Math.round(meal.potassiumMg)}</td>
                      <td className={`py-2 text-right ${meal.glycemicLoad > 20 ? "font-semibold text-red-600" : "text-slate-600"}`}>
                        {meal.glycemicLoad.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
