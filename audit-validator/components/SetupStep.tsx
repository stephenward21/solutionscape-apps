"use client";

import { useState } from "react";
import type { DrataWorkspace, DrataControl } from "@/lib/types";

export default function SetupStep({
  apiKey,
  onApiKeyChange,
  workspace,
  onWorkspaceChange,
  onNext,
}: {
  apiKey: string;
  onApiKeyChange: (k: string) => void;
  workspace: DrataWorkspace | null;
  onWorkspaceChange: (ws: DrataWorkspace, controls: DrataControl[]) => void;
  onNext: () => void;
}) {
  const [workspaces, setWorkspaces] = useState<DrataWorkspace[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingControls, setLoadingControls] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchWorkspaces() {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces?apiKey=${encodeURIComponent(apiKey)}`);
      const data = (await res.json()) as { workspaces?: DrataWorkspace[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch workspaces");
      setWorkspaces(data.workspaces ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function selectWorkspace(ws: DrataWorkspace) {
    setLoadingControls(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/controls?apiKey=${encodeURIComponent(apiKey)}&workspaceId=${ws.id}`
      );
      const data = (await res.json()) as { controls?: DrataControl[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch controls");
      onWorkspaceChange(ws, data.controls ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingControls(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Connect to Drata</h2>
        <p className="text-sm text-slate-500 mb-6">
          Enter your Drata API key to load controls for validation. The key is used only for this
          session and never stored.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Drata API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="drata_..."
                className="flex-1 border border-slate-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
              <button
                onClick={() => { void fetchWorkspaces(); }}
                disabled={!apiKey || loading}
                className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors shrink-0"
              >
                {loading ? "Loading…" : "Connect"}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {workspaces.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Select Workspace
              </label>
              <div className="space-y-2">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => { void selectWorkspace(ws); }}
                    disabled={loadingControls}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-colors ${
                      workspace?.id === ws.id
                        ? "border-brand-400 bg-brand-50 text-brand-700"
                        : "border-slate-200 hover:border-brand-300 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-medium">{ws.name}</div>
                      <div className="text-xs text-slate-400">ID: {ws.id}</div>
                    </div>
                    {workspace?.id === ws.id && (
                      <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
              {loadingControls && (
                <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin inline-block" />
                  Loading controls…
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={onNext}
          disabled={!workspace}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}
