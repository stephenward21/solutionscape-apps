"use client";

import { useState } from "react";
import type { IdPProvider, UserActivity } from "@/lib/types";

const PROVIDERS: { id: IdPProvider; name: string; icon: string; description: string; comingSoon?: boolean }[] = [
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

export default function IdPPanel() {
  const [selected, setSelected] = useState<IdPProvider | null>(null);
  const [activity, setActivity] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  async function connect(provider: IdPProvider) {
    setSelected(provider);
    setError(null);
  }

  async function fetchActivity() {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/idp?provider=${selected}`);
      const data = await res.json() as { users?: UserActivity[]; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Failed to fetch activity");
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
            onClick={() => connect(p.id)}
            className={`text-left border rounded-xl p-4 transition-all ${
              selected === p.id
                ? "border-brand-500 bg-brand-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50"
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{p.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">{p.name}</p>
              </div>
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

      {/* Config / connect form */}
      {selected && !connected && (
        <ConnectForm
          provider={selected}
          loading={loading}
          error={error}
          onConnect={fetchActivity}
        />
      )}

      {/* User activity results */}
      {connected && activity.length > 0 && (
        <UserActivityTable
          users={activity}
          onDisconnect={() => { setConnected(false); setActivity([]); setSelected(null); }}
        />
      )}
    </div>
  );
}

function ConnectForm({
  provider,
  loading,
  error,
  onConnect,
}: {
  provider: IdPProvider;
  loading: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  const isManual = provider === "manual";

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">
        {isManual ? "Upload User Activity CSV" : "Configure Connection"}
      </h3>

      {provider === "google" && (
        <div className="space-y-3">
          <Field label="Service Account JSON" type="textarea" placeholder='{"type": "service_account", ...}' />
          <Field label="Admin Email" type="email" placeholder="admin@yourcompany.com" />
        </div>
      )}

      {provider === "microsoft" && (
        <div className="space-y-3">
          <Field label="Tenant ID" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Field label="Client ID" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          <Field label="Client Secret" type="password" placeholder="•••••••••••••••" />
        </div>
      )}

      {provider === "okta" && (
        <div className="space-y-3">
          <Field label="Okta Domain" type="text" placeholder="yourcompany.okta.com" />
          <Field label="API Token" type="password" placeholder="•••••••••••••••" />
        </div>
      )}

      {isManual && (
        <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center">
          <p className="text-sm text-slate-500">Drop a CSV file here</p>
          <p className="text-xs text-slate-400 mt-1">
            Columns: email, display_name, department, ai_tool, first_seen, last_seen
          </p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <button
        onClick={onConnect}
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
        ) : (
          isManual ? "Upload & Process" : "Connect & Sync"
        )}
      </button>

      <p className="text-xs text-slate-400 text-center">
        Credentials are used only for this session and are never stored
      </p>
    </div>
  );
}

function Field({
  label, type, placeholder,
}: {
  label: string;
  type: string;
  placeholder?: string;
}) {
  if (type === "textarea") {
    return (
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <textarea
          rows={3}
          placeholder={placeholder}
          className="w-full text-xs border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono resize-none"
        />
      </div>
    );
  }
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  );
}

function UserActivityTable({
  users,
  onDisconnect,
}: {
  users: UserActivity[];
  onDisconnect: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">
          {users.length} users with AI tool activity detected
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
                <p className="text-xs text-slate-400">{u.email}{u.department && ` · ${u.department}`}</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                {u.aiToolsDetected.length} tool{u.aiToolsDetected.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-1 mt-2">
              {u.aiToolsDetected.map((t, i) => (
                <span key={i} className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                  {t.tool}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
