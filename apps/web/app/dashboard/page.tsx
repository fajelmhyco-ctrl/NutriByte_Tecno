"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Shell from "@/components/Shell";
import StatCard from "@/components/StatCard";
import { api, PatientLink } from "@/lib/api";

export default function DashboardPage() {
  const [links, setLinks] = useState<PatientLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [invite, setInvite] = useState<string | null>(null);

  async function load() {
    try {
      const data = await api<PatientLink[]>("/api/dietitian/patients");
      setLinks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function linkPatient(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const result = await api<{ inviteUrl: string }>("/api/dietitian/patients/link", {
        method: "POST",
        body: JSON.stringify({ patientEmail: email }),
      });
      setInvite(result.inviteUrl);
      setEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link patient");
    }
  }

  const active = links.filter((l) => l.status === "active");
  const pending = links.filter((l) => l.status === "pending");

  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Patient panel</h1>
          <p className="mt-1 text-sm text-slate-500">
            Remote monitoring across sodium, potassium, phosphorus, protein, and glycemic load.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active patients" value={active.length} tone="good" />
        <StatCard label="Pending invites" value={pending.length} tone="warn" />
        <StatCard label="Total linked" value={links.length} />
        <StatCard
          label="Premium patients"
          value={links.filter((l) => l.patient.tier === "premium").length}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card">
            <h2 className="text-sm font-semibold text-slate-900">Linked patients</h2>
            {loading ? (
              <p className="mt-4 text-sm text-slate-500">Loading...</p>
            ) : links.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No patients yet. Send an invite using the form on the right.
              </p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {links.map((link) => (
                  <div key={link.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link
                        href={`/patients/${link.patient.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {link.patient.fullName}
                      </Link>
                      <p className="text-xs text-slate-500">{link.patient.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {link.patient.clinicalFlags?.hasDiabetes && (
                          <span className="badge bg-blue-50 text-blue-700">Diabetes</span>
                        )}
                        {link.patient.clinicalFlags?.hasHypertension && (
                          <span className="badge bg-amber-50 text-amber-700">Hypertension</span>
                        )}
                        {link.patient.clinicalFlags && link.patient.clinicalFlags.ckdStage > 0 && (
                          <span className="badge bg-purple-50 text-purple-700">
                            CKD {link.patient.clinicalFlags.ckdStage}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`badge ${
                          link.status === "active"
                            ? "bg-brand-50 text-brand-700"
                            : link.status === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {link.status}
                      </span>
                      {link.patient.profile && (
                        <p className="mt-1 text-xs text-slate-500">
                          BMI {link.patient.profile.bmi} · {link.patient.profile.weightKg} kg
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card h-fit">
          <h2 className="text-sm font-semibold text-slate-900">Link a patient</h2>
          <p className="mt-1 text-xs text-slate-500">
            The patient must already have a NutriByte account.
          </p>
          <form onSubmit={linkPatient} className="mt-4 space-y-3">
            <div>
              <label className="label" htmlFor="patient-email">Patient email</label>
              <input
                id="patient-email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@example.com"
                required
              />
            </div>
            <button type="submit" className="btn-primary w-full">Send link invite</button>
          </form>
          {invite && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Invite link</p>
              <p className="mt-1 break-all text-xs text-slate-500">{invite}</p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}
