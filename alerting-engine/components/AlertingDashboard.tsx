"use client";

import { useState, useEffect, useCallback } from "react";
import type { AlertRule, AlertEvent } from "@/lib/types";
import RuleList from "./RuleList";
import CreateRuleModal from "./CreateRuleModal";
import EventHistory from "./EventHistory";

type Tab = "rules" | "history";

export default function AlertingDashboard() {
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [events, setEvents] = useState<AlertEvent[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);

  const fetchRules = useCallback(() => {
    setLoadingRules(true);
    fetch("/api/alert-rules")
      .then((r) => r.json())
      .then((d: { rules?: AlertRule[] }) => setRules(d.rules ?? []))
      .catch(console.error)
      .finally(() => setLoadingRules(false));
  }, []);

  const fetchEvents = useCallback(() => {
    setLoadingEvents(true);
    fetch("/api/history?limit=100")
      .then((r) => r.json())
      .then((d: { events?: AlertEvent[] }) => setEvents(d.events ?? []))
      .catch(console.error)
      .finally(() => setLoadingEvents(false));
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  useEffect(() => {
    if (tab === "history") fetchEvents();
  }, [tab, fetchEvents]);

  async function runAllChecks() {
    setRunningCheck(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/run-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = (await res.json()) as { ran: number; alertsFired: number; results?: Array<{ ruleName: string; error?: string }> };
      const errors = data.results?.filter((r) => r.error) ?? [];
      setRunResult(
        errors.length
          ? `Ran ${data.ran} rule(s), fired ${data.alertsFired} alert(s). Errors: ${errors.map((e) => e.ruleName).join(", ")}`
          : `Ran ${data.ran} rule(s), fired ${data.alertsFired} alert(s)`
      );
      fetchRules();
      if (tab === "history") fetchEvents();
    } catch (err) {
      setRunResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunningCheck(false);
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    await fetch(`/api/alert-rules?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    fetchRules();
  }

  async function deleteRule(id: string) {
    if (!confirm("Delete this alert rule?")) return;
    await fetch(`/api/alert-rules?id=${id}`, { method: "DELETE" });
    fetchRules();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-slate-800">Alerting Engine</div>
              <div className="text-xs text-slate-400">Real-time compliance alerts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runResult && (
              <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg max-w-xs truncate">
                {runResult}
              </span>
            )}
            <button
              onClick={() => { void runAllChecks(); }}
              disabled={runningCheck || rules.filter((r) => r.enabled).length === 0}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              {runningCheck ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running…
                </>
              ) : (
                <>▶ Run All Checks</>
              )}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
            >
              + New Rule
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Active Rules" value={rules.filter((r) => r.enabled).length} total={rules.length} color="text-brand-600" />
          <StatCard label="Alerts Today" value={events.filter((e) => new Date(e.firedAt).toDateString() === new Date().toDateString()).length} color="text-amber-600" />
          <StatCard label="Total Checks" value={rules.filter((r) => r.lastCheckedAt).length} total={rules.length} label2="rules checked" color="text-emerald-600" />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
          <div className="border-b border-slate-100 px-6 flex gap-1">
            {(["rules", "history"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-3.5 text-sm font-medium border-b-2 capitalize transition-colors ${
                  tab === t ? "border-brand-600 text-brand-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === "rules" ? `Alert Rules (${rules.length})` : "Event History"}
              </button>
            ))}
          </div>
          <div className="p-6">
            {tab === "rules" && (
              <RuleList
                rules={rules}
                loading={loadingRules}
                onToggle={toggleRule}
                onDelete={deleteRule}
                onRunRule={async (id) => {
                  setRunningCheck(true);
                  try {
                    const res = await fetch("/api/run-check", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ruleId: id }),
                    });
                    const d = (await res.json()) as { alertsFired: number };
                    setRunResult(`Fired ${d.alertsFired} alert(s)`);
                    fetchRules();
                  } finally {
                    setRunningCheck(false);
                  }
                }}
              />
            )}
            {tab === "history" && <EventHistory events={events} loading={loadingEvents} />}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateRuleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchRules(); }}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, total, color, label2 }: {
  label: string; value: number; total?: number; color: string; label2?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>
        {value}{total !== undefined && <span className="text-lg font-medium text-slate-300">/{total}</span>}
      </div>
      {label2 && <div className="text-xs text-slate-400 mt-0.5">{label2}</div>}
    </div>
  );
}
