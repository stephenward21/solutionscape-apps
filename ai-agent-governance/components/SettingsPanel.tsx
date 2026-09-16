"use client";

import { useState, useEffect, useCallback } from "react";
import type { ReportSummary, ScheduleConfig } from "@/electron/db";
import VerticalConfigPanel from "./VerticalConfigPanel";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const eAPI = typeof window !== "undefined" ? window.electronAPI : undefined;
const isElectron = !!eAPI;

// Human-readable cron presets
const CRON_PRESETS: { label: string; value: string }[] = [
  { label: "Daily at 9 am",        value: "0 9 * * *"   },
  { label: "Every Monday at 9 am", value: "0 9 * * 1"   },
  { label: "Every day at midnight",value: "0 0 * * *"   },
  { label: "Every 6 hours",        value: "0 */6 * * *" },
  { label: "Custom…",              value: "custom"       },
];

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function SavedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      Saved
    </span>
  );
}

// ─── API Key section ──────────────────────────────────────────────────────────

function ApiKeySection() {
  const [key, setKey]         = useState("");
  const [hasSaved, setHasSaved] = useState(false);
  const [status, setStatus]   = useState<"idle" | "saving" | "saved" | "cleared">("idle");

  useEffect(() => {
    void eAPI?.apiKey.has().then(setHasSaved);
  }, []);

  async function save() {
    if (!key.trim()) return;
    setStatus("saving");
    await eAPI?.apiKey.save(key.trim());
    setKey("");
    setHasSaved(true);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 2000);
  }

  async function clear() {
    await eAPI?.apiKey.clear();
    setHasSaved(false);
    setStatus("cleared");
    setTimeout(() => setStatus("idle"), 2000);
  }

  return (
    <Section title="Anthropic API Key">
      <p className="text-xs text-slate-500">
        Required for AI analysis. Your key is encrypted with the OS keychain and never sent to SolutionScape.
      </p>
      <div className="flex items-center gap-2">
        {hasSaved ? <SavedBadge /> : <span className="text-xs text-slate-400">Not saved</span>}
        {status === "cleared" && <span className="text-xs text-slate-400">Cleared</span>}
      </div>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-…"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
        />
        <button
          onClick={() => void save()}
          disabled={!key.trim() || status === "saving"}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {hasSaved && (
          <button
            onClick={() => void clear()}
            className="px-3 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 text-sm rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </Section>
  );
}

// ─── IdP credentials section ──────────────────────────────────────────────────

const PROVIDERS = [
  { id: "google",    label: "Google Workspace"  },
  { id: "microsoft", label: "Microsoft Entra ID" },
  { id: "okta",      label: "Okta"              },
] as const;

type ProviderId = (typeof PROVIDERS)[number]["id"];

function IdPCredsSection() {
  const [saved, setSaved] = useState<Record<ProviderId, boolean>>({
    google: false, microsoft: false, okta: false,
  });
  const [open, setOpen] = useState<ProviderId | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<ProviderId, string>>({
    google: "", microsoft: "", okta: "",
  });

  useEffect(() => {
    void Promise.all(
      PROVIDERS.map(async (p) => ({ id: p.id, has: await eAPI?.credentials.has(p.id) }))
    ).then((results) =>
      setSaved(Object.fromEntries(results.map((r) => [r.id, r.has ?? false])) as Record<ProviderId, boolean>)
    );
  }, []);

  function toggleOpen(id: ProviderId) {
    setOpen((prev) => (prev === id ? null : id));
    setDraft({});
  }

  async function save(id: ProviderId) {
    await eAPI?.credentials.save(id, draft);
    setSaved((p) => ({ ...p, [id]: true }));
    setStatus((p) => ({ ...p, [id]: "saved" }));
    setOpen(null);
    setTimeout(() => setStatus((p) => ({ ...p, [id]: "" })), 2000);
  }

  async function clear(id: ProviderId) {
    await eAPI?.credentials.clear(id);
    setSaved((p) => ({ ...p, [id]: false }));
    setStatus((p) => ({ ...p, [id]: "cleared" }));
    setTimeout(() => setStatus((p) => ({ ...p, [id]: "" })), 2000);
  }

  return (
    <Section title="Directory Credentials">
      <p className="text-xs text-slate-500">
        Save credentials for automatic scheduled scans. Encrypted with the OS keychain — never stored in plaintext.
      </p>
      <div className="space-y-2">
        {PROVIDERS.map((p) => (
          <div key={p.id} className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleOpen(p.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-slate-700">{p.label}</span>
                {saved[p.id] && <SavedBadge />}
                {status[p.id] === "cleared" && (
                  <span className="text-xs text-slate-400">Cleared</span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-slate-400 transition-transform ${open === p.id ? "rotate-90" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {open === p.id && (
              <div className="border-t border-slate-100 px-4 py-3 space-y-3 bg-slate-50">
                {p.id === "google" && (
                  <>
                    <Field label="Service Account JSON" type="textarea"
                      value={draft.serviceAccountJson ?? ""} onChange={(v) => setDraft((d) => ({ ...d, serviceAccountJson: v }))}
                      placeholder='{"type":"service_account","project_id":"..."}' />
                    <Field label="Admin Email" type="email"
                      value={draft.adminEmail ?? ""} onChange={(v) => setDraft((d) => ({ ...d, adminEmail: v }))}
                      placeholder="admin@yourdomain.com" />
                  </>
                )}
                {p.id === "microsoft" && (
                  <>
                    <Field label="Tenant ID"     value={draft.tenantId     ?? ""} onChange={(v) => setDraft((d) => ({ ...d, tenantId: v }))}     placeholder="xxxxxxxx-xxxx-…" mono />
                    <Field label="Client ID"     value={draft.clientId     ?? ""} onChange={(v) => setDraft((d) => ({ ...d, clientId: v }))}     placeholder="xxxxxxxx-xxxx-…" mono />
                    <Field label="Client Secret" value={draft.clientSecret ?? ""} onChange={(v) => setDraft((d) => ({ ...d, clientSecret: v }))} placeholder="•••" type="password" />
                  </>
                )}
                {p.id === "okta" && (
                  <>
                    <Field label="Okta Domain" value={draft.domain   ?? ""} onChange={(v) => setDraft((d) => ({ ...d, domain: v }))}   placeholder="yourcompany.okta.com" />
                    <Field label="API Token"   value={draft.apiToken ?? ""} onChange={(v) => setDraft((d) => ({ ...d, apiToken: v }))} placeholder="•••" type="password" />
                  </>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => void save(p.id)}
                    className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    Save
                  </button>
                  {saved[p.id] && (
                    <button
                      onClick={() => void clear(p.id)}
                      className="px-3 py-1.5 border border-rose-200 text-rose-600 text-xs rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", mono = false,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: "text" | "email" | "password" | "textarea"; mono?: boolean;
}) {
  const base = `w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 ${mono ? "font-mono" : ""}`;
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea rows={3} className={base} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input type={type} className={base} value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// ─── Schedule section ─────────────────────────────────────────────────────────

function ScheduleSection() {
  const [config, setConfig] = useState<ScheduleConfig | null>(null);
  const [enabled, setEnabled]   = useState(false);
  const [preset, setPreset]     = useState("0 9 * * 1");
  const [custom, setCustom]     = useState("");
  const [saving, setSaving]     = useState(false);
  const [running, setRunning]   = useState(false);

  const load = useCallback(async () => {
    const cfg = await eAPI?.schedule.get();
    if (!cfg) return;
    setConfig(cfg);
    setEnabled(cfg.enabled);
    const isPreset = CRON_PRESETS.some((p) => p.value === cfg.cronExpr && p.value !== "custom");
    setPreset(isPreset ? cfg.cronExpr : "custom");
    if (!isPreset) setCustom(cfg.cronExpr);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handler = () => void load();
    eAPI?.on("schedule:updated", handler);
    return () => eAPI?.off("schedule:updated", handler);
  }, [load]);

  async function save() {
    const cronExpr = preset === "custom" ? custom.trim() : preset;
    if (!cronExpr) return;
    setSaving(true);
    await eAPI?.schedule.set({ enabled, cronExpr });
    await load();
    setSaving(false);
  }

  async function runNow() {
    setRunning(true);
    await eAPI?.schedule.runNow();
    setTimeout(() => setRunning(false), 2000);
  }

  const cronExpr = preset === "custom" ? custom : preset;

  return (
    <Section title="Scheduled Scans">
      <p className="text-xs text-slate-500">
        Automatically run an AI Discovery scan on a recurring schedule. Runs in the background — even when the window is closed.
      </p>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setEnabled((v) => !v)}
          className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${enabled ? "bg-brand-600" : "bg-slate-200"}`}
        >
          <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-0.5 ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
        </button>
        <span className="text-sm text-slate-700">{enabled ? "Enabled" : "Disabled"}</span>
      </div>

      {enabled && (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Frequency</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              {CRON_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {preset === "custom" && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Cron expression</label>
              <input
                type="text"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="0 9 * * 1"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 font-mono placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}
        </div>
      )}

      {config?.lastRunAt && (
        <p className="text-xs text-slate-400">
          Last run: {new Date(config.lastRunAt).toLocaleString()}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {saving ? "Saving…" : "Save Schedule"}
        </button>
        <button
          onClick={() => void runNow()}
          disabled={running}
          className="px-4 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-sm font-semibold rounded-lg transition-colors"
        >
          {running ? "Starting…" : "Run Now"}
        </button>
      </div>

      {cronExpr && enabled && (
        <p className="text-xs font-mono text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg inline-block">
          {cronExpr}
        </p>
      )}
    </Section>
  );
}

// ─── Report history section ───────────────────────────────────────────────────

function ReportHistorySection() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    void eAPI?.reports.list().then(setReports);

    const onComplete = () => void eAPI?.reports.list().then(setReports);
    eAPI?.on("scan:complete", onComplete);
    return () => eAPI?.off("scan:complete", onComplete);
  }, []);

  return (
    <Section title="Scan History">
      {reports.length === 0 ? (
        <p className="text-xs text-slate-400">No scans yet. Run a scan or enable scheduled scans above.</p>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelected(selected === r.id ? null : r.id)}
              className="w-full text-left border border-slate-200 rounded-lg px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {new Date(r.generatedAt).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {r.totalUsers} users · {r.totalTools} AI tools
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.criticalTools > 0 && (
                    <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                      {r.criticalTools} critical
                    </span>
                  )}
                  {r.highRiskTools > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                      {r.highRiskTools} high
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function SettingsPanel() {
  // Organization Profile is available in both web and desktop modes
  const orgProfileSection = (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <VerticalConfigPanel />
    </div>
  );

  if (!isElectron) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Settings</h2>
          <p className="text-sm text-slate-500">
            Configure your organization profile to enable industry-specific risk analysis.
          </p>
        </div>
        {orgProfileSection}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex items-start gap-3">
          <span className="text-2xl shrink-0">🖥️</span>
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Desktop app required for additional features</p>
            <p className="text-xs text-slate-400">
              Encrypted credential storage, scheduled scans, and scan history are only available in the
              SolutionScape desktop app.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Settings</h2>
        <p className="text-sm text-slate-500">
          Credentials are encrypted with your OS keychain and never leave this device.
        </p>
      </div>
      {orgProfileSection}
      <ApiKeySection />
      <IdPCredsSection />
      <ScheduleSection />
      <ReportHistorySection />
    </div>
  );
}
