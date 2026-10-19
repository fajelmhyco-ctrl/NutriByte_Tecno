"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DailyPoint } from "@/lib/api";

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

export function SodiumChart({ data, target }: { data: DailyPoint[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => [`${Math.round(value)} mg`, "Sodium"]} />
        <ReferenceLine y={target} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Limit", fontSize: 10 }} />
        <Line type="monotone" dataKey="sodiumMg" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function PotassiumChart({ data, target }: { data: DailyPoint[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => [`${Math.round(value)} mg`, "Potassium"]} />
        <ReferenceLine y={target} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Limit", fontSize: 10 }} />
        <Line type="monotone" dataKey="potassiumMg" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function GlycemicChart({ data, target }: { data: DailyPoint[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => [value.toFixed(1), "Glycemic load"]} />
        <ReferenceLine y={target} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Target", fontSize: 10 }} />
        <Line type="monotone" dataKey="glycemicLoad" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ProteinChart({ data, target }: { data: DailyPoint[]; target: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value: number) => [`${value.toFixed(1)} g`, "Protein"]} />
        <Legend />
        <ReferenceLine y={target} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "Target", fontSize: 10 }} />
        <Line type="monotone" dataKey="proteinG" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} name="Protein (g)" />
      </LineChart>
    </ResponsiveContainer>
  );
}
