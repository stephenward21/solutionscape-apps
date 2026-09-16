"use client";

import { useState } from "react";
import type { UserActivity, IdPProvider } from "@/lib/types";

interface Props {
  idpUsers: UserActivity[];
  provider: IdPProvider;
  credentials: Record<string, string>;
}

type RevokeStatus = "idle" | "confirming" | "revoking" | "revoked" | "failed";

interface ToolRevoke {
  key: string; // `${userId}:${tool}`
  userId: string;
  userEmail: string;
  displayName?: string;
  toolName: string;
  vendor: string;
  clientId: string;
  idpItemId?: string;
  status: RevokeStatus;
  error?: string;
}

const PROVIDER_LABEL: Record<IdPProvider, string> = {
  google:    "Google Workspace (OAuth token revocation)",
  microsoft: "Microsoft Entra ID (app role removal)",
  okta:      "Okta (app user removal)",
  manual:    "Manual CSV",
};

export default function RevokePanel({ idpUsers, provider, credentials }: Props) {
  const [open, setOpen] = useState(false);

  // Build revocable tool list: only users whose tools have a clientId
  const initialItems = (): ToolRevoke[] => {
    const items: ToolRevoke[] = [];
    for (const user of idpUsers) {
      for (const tool of user.aiToolsDetected) {
        if (!tool.clientId) continue;
        items.push({
          key: `${user.userId}:${tool.tool}`,
          userId: user.userId,
          userEmail: user.email,
          displayName: user.displayName,
          toolName: tool.tool,
          vendor: tool.vendor,
          clientId: tool.clientId,
          idpItemId: tool.idpItemId,
          status: "idle",
        });
      }
    }
    return items;
  };

  const [items, setItems] = useState<ToolRevoke[]>(initialItems);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  function updateItem(key: string, patch: Partial<ToolRevoke>) {
    setItems((prev) => prev.map((item) => item.key === key ? { ...item, ...patch } : item));
  }

  async function revoke(item: ToolRevoke) {
    updateItem(item.key, { status: "revoking", error: undefined });
    setConfirmKey(null);
    try {
      const res = await fetch("/api/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          credentials,
          userId: item.userId,
          userEmail: item.userEmail,
          toolName: item.toolName,
          clientId: item.clientId,
          idpItemId: item.idpItemId,
        }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Revocation failed");
      }
      updateItem(item.key, { status: "revoked" });
    } catch (e) {
      updateItem(item.key, { status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }

  const revokedCount = items.filter((i) => i.status === "revoked").length;
  const totalCount   = items.length;

  if (provider === "manual") return null;
  if (totalCount === 0) return null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className="text-lg">🔒</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Revoke Access</p>
          <p className="text-xs text-slate-500">
            Remove app access for specific users via {PROVIDER_LABEL[provider]}
          </p>
        </div>
        {revokedCount > 0 && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full shrink-0 font-medium">
            {revokedCount} revoked
          </span>
        )}
        <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full shrink-0">
          {totalCount - revokedCount} active
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-white">
          {/* Warning banner */}
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
            <div className="flex gap-2.5">
              <span className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="text-xs font-semibold text-amber-800">This action is immediate and may disrupt active users</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Revoking access removes the {
                    provider === "google" ? "OAuth token" :
                    provider === "microsoft" ? "app role assignment" :
                    "user's app assignment"
                  } via the IdP API. Users will be signed out of the tool and will not be able to re-authenticate
                  {provider === "google" ? " until they re-authorize the app." : "."}
                </p>
              </div>
            </div>
          </div>

          {/* Tool list */}
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div key={item.key} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">
                      {item.displayName ?? item.userEmail}
                    </span>
                    <span className="text-xs text-slate-400">{item.userEmail !== item.displayName && item.displayName ? `· ${item.userEmail}` : ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-slate-500">{item.toolName}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-400">{item.vendor}</span>
                  </div>
                  {item.status === "failed" && item.error && (
                    <p className="text-xs text-rose-600 mt-1">{item.error}</p>
                  )}
                </div>

                {/* Status / action */}
                {item.status === "revoked" ? (
                  <span className="text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg shrink-0">
                    ✓ Revoked
                  </span>
                ) : item.status === "revoking" ? (
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Revoking…
                  </span>
                ) : confirmKey === item.key ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => { void revoke(item); }}
                      className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmKey(null)}
                      className="text-xs border border-slate-200 text-slate-600 hover:bg-slate-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmKey(item.key)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors shrink-0 ${
                      item.status === "failed"
                        ? "border-rose-300 text-rose-700 hover:bg-rose-50"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-rose-200 hover:text-rose-700"
                    }`}
                  >
                    {item.status === "failed" ? "Retry" : "Revoke Access"}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Bulk action */}
          {items.filter((i) => i.status === "idle" || i.status === "failed").length > 1 && (
            <div className="border-t border-slate-100 px-4 py-3 bg-slate-50 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {items.filter((i) => i.status === "idle" || i.status === "failed").length} access grants remain active
              </p>
              {confirmKey === "bulk" ? (
                <div className="flex gap-1.5">
                  <button
                    onClick={async () => {
                      setConfirmKey(null);
                      const pending = items.filter((i) => i.status === "idle" || i.status === "failed");
                      for (const item of pending) {
                        await revoke(item);
                      }
                    }}
                    className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Revoke All
                  </button>
                  <button
                    onClick={() => setConfirmKey(null)}
                    className="text-xs border border-slate-200 text-slate-600 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmKey("bulk")}
                  className="text-xs border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Revoke All Active
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
