"use client";

import React, { useState, useEffect } from "react";
import type { IdPProvider, UserActivity } from "@/lib/types";
import type { IndustryVertical } from "@/lib/verticals";
import { VERTICAL_DEFINITIONS } from "@/lib/verticals";
import { loadOrgConfig } from "@/components/VerticalConfigPanel";
import { getDemoUsers, getDemoMeta } from "@/lib/demo-data";
import IdPSetupDrawer from "@/components/IdPSetupDrawer";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg viewBox="0 0 21 21" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="9" height="9" fill="#F35325"/>
    <rect x="11" y="1" width="9" height="9" fill="#81BC06"/>
    <rect x="1" y="11" width="9" height="9" fill="#05A6F0"/>
    <rect x="11" y="11" width="9" height="9" fill="#FFBA08"/>
  </svg>
);

const OktaIcon = () => (
  <svg viewBox="0 0 64 64" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="32" fill="#007DC1"/>
    <circle cx="32" cy="32" r="14" fill="white"/>
    <circle cx="32" cy="32" r="7" fill="#007DC1"/>
  </svg>
);

const CSVIcon = () => (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#64748B" opacity="0.12"/>
    <path d="M3 9h18M3 15h18M9 3v18" stroke="#64748B" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const PROVIDERS: { id: IdPProvider; name: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "google",
    name: "Google Workspace",
    icon: <GoogleIcon />,
    description: "Read OAuth app authorizations and Admin SDK audit logs to detect AI tool sign-ins.",
  },
  {
    id: "microsoft",
    name: "Microsoft Entra ID",
    icon: <MicrosoftIcon />,
    description: "Read enterprise app assignments and sign-in logs via Microsoft Graph API.",
  },
  {
    id: "okta",
    name: "Okta",
    icon: <OktaIcon />,
    description: "Read application assignments and system log events for AI tool activity.",
  },
  {
    id: "manual",
    name: "Manual CSV Upload",
    icon: <CSVIcon />,
    description: "Upload a CSV export of user/app data from your IdP or SSO provider.",
  },
];

// ─── Credential state shapes ──────────────────────────────────────────────────

interface GoogleCreds  { serviceAccountJson: string; adminEmail: string }
interface MicrosoftCreds { tenantId: string; clientId: string; clientSecret: string }
interface OktaCreds    { domain: string; apiToken: string }
type Creds = GoogleCreds | MicrosoftCreds | OktaCreds | null;

// ─── Panel ────────────────────────────────────────────────────────────────────

type SelectedProvider = IdPProvider | "demo" | null;

interface IdPPanelProps {
  onConnected?: (users: UserActivity[], provider: IdPProvider, credentials: Record<string, string>) => void;
}

export default function IdPPanel({ onConnected }: IdPPanelProps) {
  const [selected, setSelected]         = useState<SelectedProvider>(null);
  const [creds, setCreds]               = useState<Creds>(null);
  const [activity, setActivity]         = useState<UserActivity[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [connected, setConnected]       = useState(false);
  const [demoVertical, setDemoVertical] = useState<IndustryVertical | null>(null);
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [drawerProvider, setDrawerProvider] = useState<"google" | "microsoft" | "okta">("google");

  useEffect(() => {
    const cfg = loadOrgConfig();
    if (cfg && cfg.vertical !== "general") setDemoVertical(cfg.vertical);
  }, []);

  function selectProvider(provider: SelectedProvider) {
    if (selected === provider) return;
    setSelected(provider);
    setCreds(null);
    setError(null);
    setConnected(false);
    setActivity([]);
    if (provider && provider !== "demo" && provider !== "manual") {
      setDrawerProvider(provider);
    }
  }

  function openGuide(provider?: "google" | "microsoft" | "okta") {
    if (provider) setDrawerProvider(provider);
    setDrawerOpen(true);
  }

  function loadDemo() {
    if (!demoVertical) return;
    const users = getDemoUsers(demoVertical);
    setActivity(users);
    setConnected(true);
    onConnected?.(users, "google", {});
  }

  async function connect(credentials: Creds) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/idp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selected, credentials }),
      });
      const data = await res.json() as { users?: UserActivity[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Connection failed");
      const users = data.users ?? [];
      setActivity(users);
      setConnected(true);
      onConnected?.(users, selected as IdPProvider, credentials as unknown as Record<string, string>);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
    <IdPSetupDrawer
      open={drawerOpen}
      initialProvider={drawerProvider}
      onClose={() => setDrawerOpen(false)}
    />
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Directory Connection</h2>
          <p className="text-sm text-slate-500">
            Connect your identity provider to detect which AI tools your users have authorized
            and what systems those tools can access.
          </p>
        </div>
        <button
          onClick={() => openGuide(
            selected && selected !== "demo" && selected !== "manual" ? selected : "google"
          )}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-lg px-3 py-1.5 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Setup guide
        </button>
      </div>

      {/* Provider grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            onClick={() => selectProvider(p.id)}
            className={`text-left border rounded-xl p-4 transition-all ${
              selected === p.id
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="shrink-0 w-7 h-7 flex items-center justify-center">{p.icon}</div>
              <p className="text-sm font-semibold text-slate-800">{p.name}</p>
              {selected === p.id && (
                <span className="ml-auto text-xs font-medium text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                  Selected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">{p.description}</p>
          </button>
        ))}

        {/* Demo Mode card — only visible when a non-general vertical is configured */}
        {demoVertical && (
          <button
            onClick={() => selectProvider("demo")}
            className={`text-left border-2 border-dashed rounded-xl p-4 transition-all sm:col-span-2 ${
              selected === "demo"
                ? "border-teal-400 bg-teal-50 shadow-sm"
                : "border-teal-200 bg-white hover:border-teal-400 hover:bg-teal-50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl shrink-0">{VERTICAL_DEFINITIONS[demoVertical].icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-semibold ${selected === "demo" ? "text-teal-800" : "text-slate-800"}`}>
                    Demo Mode — {VERTICAL_DEFINITIONS[demoVertical].label}
                  </p>
                  <span className="text-xs font-medium bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">
                    No credentials needed
                  </span>
                  {selected === "demo" && (
                    <span className="ml-auto text-xs font-medium text-teal-700 bg-teal-200 px-2 py-0.5 rounded-full">
                      Selected
                    </span>
                  )}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Load pre-built synthetic data for{" "}
              <span className="font-medium text-teal-700">{getDemoMeta(demoVertical).company}</span>
              {" "}— {getDemoMeta(demoVertical).users} employees, {getDemoMeta(demoVertical).tools} AI tools
              spanning LOW to CRITICAL risk, scoped to {VERTICAL_DEFINITIONS[demoVertical].label} compliance frameworks.
            </p>
          </button>
        )}
      </div>

      {/* Credential form */}
      {selected && !connected && (
        <>
          {selected === "google"    && <GoogleForm    loading={loading} error={error} onConnect={connect} onGuide={() => openGuide("google")} />}
          {selected === "microsoft" && <MicrosoftForm loading={loading} error={error} onConnect={connect} onGuide={() => openGuide("microsoft")} />}
          {selected === "okta"      && <OktaForm      loading={loading} error={error} onConnect={connect} onGuide={() => openGuide("okta")} />}
          {selected === "manual"    && <ManualForm    loading={loading} error={error} onConnect={connect} />}
          {selected === "demo" && demoVertical && (
            <DemoForm vertical={demoVertical} onLoad={loadDemo} />
          )}
        </>
      )}

      {/* Results */}
      {connected && (
        <UserActivityTable
          users={activity}
          onDisconnect={() => { setConnected(false); setActivity([]); setSelected(null); setCreds(null); }}
        />
      )}
    </div>
    </>
  );
}

// ─── Google Workspace form ────────────────────────────────────────────────────

function GoogleForm({ loading, error, onConnect, onGuide }: FormProps) {
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!serviceAccountJson.trim()) return;
    if (!adminEmail.trim()) return;
    onConnect({ serviceAccountJson, adminEmail });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Google Workspace — Service Account</h3>
        {onGuide && <GuideLink onClick={onGuide} />}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Paste the contents of your service account JSON key file. The setup guide walks through
        creating one with domain-wide delegation and the required Admin SDK scopes.
      </p>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Service Account JSON <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={5}
          required
          value={serviceAccountJson}
          onChange={(e) => setServiceAccountJson(e.target.value)}
          placeholder={'{"type": "service_account", "project_id": "...", "private_key": "...", ...}'}
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Admin Email (for impersonation) <span className="text-rose-500">*</span>
        </label>
        <input
          type="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          placeholder="admin@yourdomain.com"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-slate-400 mt-1">
          Must be a Super Admin account in your Workspace org
        </p>
      </div>

      <FormFooter loading={loading} error={error} label="Connect Google Workspace" />
    </form>
  );
}

// ─── Microsoft Entra form ─────────────────────────────────────────────────────

function MicrosoftForm({ loading, error, onConnect, onGuide }: FormProps) {
  const [tenantId, setTenantId]         = useState("");
  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConnect({ tenantId, clientId, clientSecret });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Microsoft Entra ID — App Registration</h3>
        {onGuide && <GuideLink onClick={onGuide} />}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Create an app registration in the Azure portal with <code className="bg-slate-100 px-1 rounded">AuditLog.Read.All</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">Directory.Read.All</code>, and{" "}
        <code className="bg-slate-100 px-1 rounded">Application.Read.All</code> permissions. The setup guide has full steps.
      </p>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Tenant ID <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          required
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Client ID <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Client Secret <span className="text-rose-500">*</span>
        </label>
        <input
          type="password"
          required
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="•••••••••••••••••••••"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <FormFooter loading={loading} error={error} label="Connect Microsoft Entra ID" />
    </form>
  );
}

// ─── Okta form ────────────────────────────────────────────────────────────────

function OktaForm({ loading, error, onConnect, onGuide }: FormProps) {
  const [domain, setDomain]     = useState("");
  const [apiToken, setApiToken] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConnect({ domain, apiToken });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-700">Okta — API Token</h3>
        {onGuide && <GuideLink onClick={onGuide} />}
      </div>
      <p className="text-xs text-slate-400 leading-relaxed">
        Generate an API token in <strong>Security → API → Tokens</strong>. A Read-Only Administrator
        token is sufficient. The setup guide covers the recommended service account setup.
      </p>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          Okta Domain <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          required
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="yourcompany.okta.com"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <p className="text-xs text-slate-400 mt-1">Do not include https://</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">
          API Token <span className="text-rose-500">*</span>
        </label>
        <input
          type="password"
          required
          value={apiToken}
          onChange={(e) => setApiToken(e.target.value)}
          placeholder="•••••••••••••••••••••"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <FormFooter loading={loading} error={error} label="Connect Okta" />
    </form>
  );
}

// ─── Manual CSV form ──────────────────────────────────────────────────────────

function ManualForm({ loading, error, onConnect }: FormProps) {
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConnect(null);
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Manual CSV Upload</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Upload a CSV with columns: <code className="bg-slate-100 px-1 rounded">email</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">display_name</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">department</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">ai_tool</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">vendor</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">first_seen</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">last_seen</code>
      </p>
      <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
        <p className="text-sm text-slate-500">Drop a CSV file here or click to upload</p>
      </div>
      <FormFooter loading={loading} error={error} label="Upload & Process" />
    </form>
  );
}

// ─── Demo Mode form ───────────────────────────────────────────────────────────

function DemoForm({ vertical, onLoad }: { vertical: IndustryVertical; onLoad: () => void }) {
  const meta = getDemoMeta(vertical);
  const def  = VERTICAL_DEFINITIONS[vertical];
  return (
    <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl shrink-0 mt-0.5">{def.icon}</span>
        <div>
          <h3 className="text-sm font-semibold text-teal-800">Demo Dataset — {def.label}</h3>
          <p className="text-xs text-teal-700 mt-0.5">{meta.company}</p>
        </div>
      </div>
      <p className="text-xs text-teal-700 leading-relaxed">
        This demo loads {meta.users} synthetic employees and {meta.tools} AI tools — ranging from LOW to
        CRITICAL risk — calibrated to trigger{" "}
        <span className="font-semibold">{def.defaultFrameworks.join(", ")}</span> compliance findings
        when scanned. No real credentials are used or stored.
      </p>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white rounded-lg border border-teal-200 py-2 px-1">
          <p className="text-lg font-bold text-teal-700">{meta.users}</p>
          <p className="text-xs text-teal-500">employees</p>
        </div>
        <div className="bg-white rounded-lg border border-teal-200 py-2 px-1">
          <p className="text-lg font-bold text-teal-700">{meta.tools}</p>
          <p className="text-xs text-teal-500">AI tools</p>
        </div>
        <div className="bg-white rounded-lg border border-teal-200 py-2 px-1">
          <p className="text-lg font-bold text-teal-700">{def.defaultFrameworks.length}</p>
          <p className="text-xs text-teal-500">frameworks</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLoad}
        className="w-full bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors"
      >
        Load {def.label} Demo Data
      </button>
      <p className="text-xs text-teal-500 text-center">
        Synthetic data only — safe to share in any demo or sales context
      </p>
    </div>
  );
}

// ─── Guide link button ────────────────────────────────────────────────────────

function GuideLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium whitespace-nowrap"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Setup guide
    </button>
  );
}

// ─── Shared form footer ───────────────────────────────────────────────────────

interface FormProps {
  loading: boolean;
  error: string | null;
  onConnect: (creds: Creds) => void;
  onGuide?: () => void;
}

function FormFooter({ loading, error, label }: { loading: boolean; error: string | null; label: string }) {
  return (
    <>
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700 break-words">
          {error}
        </div>
      )}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Connecting…
          </>
        ) : label}
      </button>
      <p className="text-xs text-slate-400 text-center">
        Credentials are used only for this session and are never stored
      </p>
    </>
  );
}

// ─── User activity table ──────────────────────────────────────────────────────

function UserActivityTable({ users, onDisconnect }: { users: UserActivity[]; onDisconnect: () => void }) {
  if (users.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
        <p className="text-sm font-semibold text-emerald-700">Connected — no AI tool activity detected</p>
        <p className="text-xs text-emerald-600 mt-1">No users have authorized third-party AI tools via OAuth in this directory.</p>
        <button onClick={onDisconnect} className="mt-3 text-xs text-slate-400 hover:text-slate-600 underline">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          {users.length} user{users.length !== 1 ? "s" : ""} with AI tool activity detected
        </h3>
        <button onClick={onDisconnect} className="text-xs text-slate-400 hover:text-slate-600 underline">
          Disconnect
        </button>
      </div>
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.userId} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">{u.displayName ?? u.email}</p>
                <p className="text-xs text-slate-400">
                  {u.email}{u.department && ` · ${u.department}`}
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0">
                {u.aiToolsDetected.length} tool{u.aiToolsDetected.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {u.aiToolsDetected.map((t, i) => (
                <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                  {t.tool}
                  {t.systemsAccessed && t.systemsAccessed.length > 0 && (
                    <span className="ml-1 opacity-60">· {t.systemsAccessed.join(", ")}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
