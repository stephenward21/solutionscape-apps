"use client";

import { useState } from "react";

interface GeneratedLink {
  token: string;
  url: string;
  label: string;
  workspaceName: string;
  expiresAt: string;
}

export default function AdminPanel() {
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [showRisks, setShowRisks] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedLink | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminKey) headers["x-admin-key"] = adminKey;

      const res = await fetch("/api/generate-link", {
        method: "POST",
        headers,
        body: JSON.stringify({
          apiKey,
          label,
          workspaceName: workspaceName || undefined,
          expiresInDays: expiresInDays ? parseInt(expiresInDays) : undefined,
          showRisks,
          showControls,
        }),
      });
      const data = await res.json() as GeneratedLink & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to generate link");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function copyUrl() {
    if (!result) return;
    void navigator.clipboard.writeText(result.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur">
      <h2 className="text-white font-semibold text-lg mb-6">Generate Client Portal Link</h2>

      <form onSubmit={(e) => { void handleGenerate(e); }} className="space-y-5">
        {/* API Key */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Drata API Key <span className="text-rose-400">*</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="drata_..."
            required
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50"
          />
          <p className="text-xs text-slate-500 mt-1">
            Used only for this session — never stored in git
          </p>
        </div>

        {/* Client Label */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Client Label <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Acme Corp"
            required
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>

        {/* Workspace Name (optional) */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Workspace Name{" "}
            <span className="text-slate-500 font-normal">(optional — auto-detected)</span>
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder="Leave blank to use primary workspace"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>

        {/* Options row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Expires In (days)
            </label>
            <input
              type="number"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              placeholder="Never"
              min="1"
              className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
            />
          </div>
          <div className="flex flex-col justify-end gap-2 pb-0.5">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRisks}
                onChange={(e) => setShowRisks(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500"
              />
              <span className="text-sm text-slate-300">Show risk register</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showControls}
                onChange={(e) => setShowControls(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500"
              />
              <span className="text-sm text-slate-300">Show control details</span>
            </label>
          </div>
        </div>

        {/* Optional admin key */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Admin Key{" "}
            <span className="text-slate-500 font-normal">(if ADMIN_API_KEY is set)</span>
          </label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Optional"
            className="w-full bg-white/5 border border-white/15 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50"
          />
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg px-4 py-3 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-3 transition-colors"
        >
          {loading ? "Generating…" : "Generate Portal Link"}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="mt-6 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5">
          <div className="flex items-center gap-2 text-emerald-400 font-medium mb-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Portal created for {result.label}
          </div>
          <div className="text-xs text-slate-400 mb-1">Workspace: {result.workspaceName}</div>
          <div className="text-xs text-slate-400 mb-3">
            Expires: {result.expiresAt === "never" ? "Never" : new Date(result.expiresAt).toLocaleDateString()}
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={result.url}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-slate-300 text-sm"
            />
            <button
              onClick={copyUrl}
              className="bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-brand-400 hover:text-brand-300 text-sm transition-colors"
          >
            Open portal →
          </a>
        </div>
      )}
    </div>
  );
}
