"use client";

import { useEffect, useState } from "react";
import Shell from "@/components/Shell";
import StatCard from "@/components/StatCard";
import { api } from "@/lib/api";

interface Session {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  paymentStatus: string;
  amountPhp: number;
  platformCommissionPhp: number;
  dietitianPayoutPhp: number;
  roomId: string;
  patient: { id: string; fullName: string; email: string };
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConsultationsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<{
    channelName: string;
    token: string;
    uid: number;
    appId: string;
  } | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    api<Session[]>("/api/sessions")
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load sessions"));
  }, []);

  async function join(session: Session) {
    setJoinError(null);
    try {
      const token = await api<{ channelName: string; token: string; uid: number; appId: string }>(
        `/api/sessions/${session.id}/token`,
      );
      setActiveRoom(token);
      await api(`/api/sessions/${session.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "in_progress" }),
      });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Unable to join session");
    }
  }

  async function complete(session: Session) {
    await api(`/api/sessions/${session.id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    setSessions((prev) =>
      prev.map((s) => (s.id === session.id ? { ...s, status: "completed" } : s)),
    );
  }

  const upcoming = sessions.filter((s) => s.status === "scheduled");
  const paid = sessions.filter((s) => s.paymentStatus === "paid");
  const earnings = paid.reduce((sum, s) => sum + s.dietitianPayoutPhp, 0);

  return (
    <Shell>
      <h1 className="text-2xl font-bold text-slate-900">Consultations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Tele-nutrition sessions with GCash / Maya payments and 15% platform commission.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {joinError && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {joinError}
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Upcoming" value={upcoming.length} />
        <StatCard label="Paid sessions" value={paid.length} tone="good" />
        <StatCard label="Your earnings" value={`₱${earnings.toLocaleString()}`} tone="good" hint="After 15% commission" />
        <StatCard label="All sessions" value={sessions.length} />
      </div>

      {activeRoom && (
        <div className="mt-6 card">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Video room</h2>
            <button className="btn-secondary" onClick={() => setActiveRoom(null)}>Close</button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Channel: {activeRoom.channelName} · UID: {activeRoom.uid}
          </p>
          <div className="mt-4 flex aspect-video items-center justify-center rounded-lg bg-slate-900 text-sm text-slate-300">
            Agora RTC view mounts here with appId {activeRoom.appId}.
            <br />
            Use the Agora React Native / Web SDK with the token returned by the API.
          </div>
        </div>
      )}

      <div className="mt-6 card">
        <h2 className="text-sm font-semibold text-slate-900">Session schedule</h2>
        {sessions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No consultations booked yet.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Patient</th>
                  <th className="py-2">Schedule</th>
                  <th className="py-2">Payment</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Fee</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="py-3">
                      <p className="font-medium text-slate-900">{session.patient.fullName}</p>
                      <p className="text-xs text-slate-500">{session.patient.email}</p>
                    </td>
                    <td className="py-3 text-slate-600">{formatDateTime(session.scheduledAt)}</td>
                    <td className="py-3">
                      <span
                        className={`badge ${
                          session.paymentStatus === "paid"
                            ? "bg-brand-50 text-brand-700"
                            : session.paymentStatus === "pending"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {session.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 capitalize text-slate-600">{session.status.replace("_", " ")}</td>
                    <td className="py-3 text-right font-medium">₱{session.amountPhp.toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          className="btn-secondary"
                          disabled={session.paymentStatus !== "paid" || session.status === "completed"}
                          onClick={() => join(session)}
                        >
                          Join
                        </button>
                        <button
                          className="btn-primary"
                          disabled={session.status === "completed" || session.status === "cancelled"}
                          onClick={() => complete(session)}
                        >
                          Complete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
