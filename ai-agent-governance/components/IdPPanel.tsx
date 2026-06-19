"use client";

import { useState } from "react";
import type { IdPProvider, UserActivity } from "@/lib/types";

const PROVIDERS: { id: IdPProvider; name: string; icon: string; description: string }[] = [
  {
    id: "google",
    name: "Google Workspace",
    icon: "🔵",
    description: "Read OAuth app authorizations and Admin SDK audit logs to detect AI tool sign-ins.",
  },
  {
    id: "microsoft",
    name: "Microsoft Entra ID",
    icon: "🟦",
    description: "Read enterprise app assignments and sign-in logs via Microsoft Graph API.",
  },
  {
    id: "okta",
    name: "Okta",
    icon: "🔷",
    description: "Read application assignments and system log events for AI tool activity.",
  },
  {
    id: "manual",
    name: "Manual CSV Upload",
    icon: "📋",
    description: "Upload a CSV export of user/app data from your IdP or SSO provider.",
  },
];

// ─── Credential state shapes ──────────────────────────────────────────────────

interface GoogleCreds  { serviceAccountJson: string; adminEmail: string }
interface MicrosoftCreds { tenantId: string; clientId: string; clientSecret: string }
interface OktaCreds    { domain: string; apiToken: string }
type Creds = GoogleCreds | MicrosoftCreds | OktaCreds | null;

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function IdPPanel() {
  const [selected, setSelected]   = useState<IdPProvider | null>(null);
  const [creds, setCreds]         = useState<Creds>(null);
  const [activity, setActivity]   = useState<UserActivity[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  function selectProvider(provider: IdPProvider) {
    if (selected === provider) return;
    setSelected(provider);
    setCreds(null);
    setError(null);
    setConnected(false);
    setActivity([]);
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
      setActivity(data.users ?? []);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Directory Connection</h2>
        <p className="text-sm text-slate-500">
          Connect your identity provider to detect which AI tools your users have authorized
          and what systems those tools can access.
        </p>
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
              <span className="text-2xl">{p.icon}</span>
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
      </div>

      {/* Credential form */}
      {selected && !connected && (
        <>
          {selected === "google"    && <GoogleForm    loading={loading} error={error} onConnect={connect} />}
          {selected === "microsoft" && <MicrosoftForm loading={loading} error={error} onConnect={connect} />}
          {selected === "okta"      && <OktaForm      loading={loading} error={error} onConnect={connect} />}
          {selected === "manual"    && <ManualForm    loading={loading} error={error} onConnect={connect} />}
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
  );
}

// ─── Google Workspace form ────────────────────────────────────────────────────

function GoogleForm({ loading, error, onConnect }: FormProps) {
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
      <h3 className="text-sm font-semibold text-slate-700">Google Workspace — Service Account</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Paste the contents of your service account JSON key file. See the README for how to create
        one with domain-wide delegation and the required Admin SDK scopes.
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

function MicrosoftForm({ loading, error, onConnect }: FormProps) {
  const [tenantId, setTenantId]         = useState("");
  const [clientId, setClientId]         = useState("");
  const [clientSecret, setClientSecret] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConnect({ tenantId, clientId, clientSecret });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Microsoft Entra ID — App Registration</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Create an app registration in the Azure portal with <code className="bg-slate-100 px-1 rounded">AuditLog.Read.All</code>,{" "}
        <code className="bg-slate-100 px-1 rounded">Directory.Read.All</code>, and{" "}
        <code className="bg-slate-100 px-1 rounded">Application.Read.All</code> permissions. See the README for full steps.
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

function OktaForm({ loading, error, onConnect }: FormProps) {
  const [domain, setDomain]     = useState("");
  const [apiToken, setApiToken] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConnect({ domain, apiToken });
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Okta — API Token</h3>
      <p className="text-xs text-slate-400 leading-relaxed">
        Generate an API token in <strong>Security → API → Tokens</strong>. A Read-Only Administrator
        token is sufficient. See the README for the recommended setup using a service account.
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

// ─── Shared form footer ───────────────────────────────────────────────────────

interface FormProps {
  loading: boolean;
  error: string | null;
  onConnect: (creds: Creds) => void;
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
