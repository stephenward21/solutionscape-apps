"use client";

import type { AISummaryResult, ActionItem, ActionPriority } from "@/lib/types";

const PRIORITY_CONFIG: Record<ActionPriority, { label: string; badge: string; dot: string }> = {
  CRITICAL: { label: "Critical", badge: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500" },
  HIGH:     { label: "High",     badge: "bg-orange-100 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  MEDIUM:   { label: "Medium",   badge: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  LOW:      { label: "Low",      badge: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
};

const CATEGORY_ICON: Record<ActionItem["category"], string> = {
  CONTROL: "🛡️",
  TASK:    "📋",
  RISK:    "⚠️",
  TEST:    "🔬",
};

interface Props {
  workspaceId: number;
}

export default function AISummaryPanel({ workspaceId }: Props) {
  const [result, setResult] = React.useState<AISummaryResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(
    (refresh = false) => {
      setLoading(true);
      setError(null);
      const url = `/api/client/${workspaceId}/ai-summary${refresh ? "?refresh=true" : ""}`;
      fetch(url)
        .then((r) => r.json())
        .then((data: AISummaryResult & { error?: string }) => {
          if (data.error) throw new Error(data.error);
          setResult(data);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setLoading(false));
    },
    [workspaceId]
  );

  React.useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col items-center py-16 gap-3">
        <svg className="animate-spin w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm text-slate-500">Claude is analysing your compliance posture…</p>
        <p className="text-xs text-slate-400">15–30 seconds on first load · cached 6 h</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        <p className="font-medium mb-1">AI summary unavailable</p>
        <p className="text-xs">{error}</p>
        <p className="text-xs mt-2 text-red-500">Make sure ANTHROPIC_API_KEY is set in .env.local</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-blue-900">AI Analysis</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">
                {new Date(result.generatedAt).toLocaleString()} · 6 h cache
              </span>
              <button
                onClick={() => load(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Refresh
              </button>
            </div>
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
        </div>
      </div>

      {/* Action items */}
      {result.items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No action items — great compliance posture! 🎉</p>
      ) : (
        <div className="space-y-3">
          {result.items.map((item, idx) => (
            <ActionItemCard key={item.id} item={item} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

// Lazily import React to allow the "use client" pattern without top-level import
import * as React from "react";

function PriorityBadge({ priority }: { priority: ActionPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ActionItemCard({ item, index }: { item: ActionItem; index: number }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-white hover:border-slate-300 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICON[item.category]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-xs text-slate-400">#{index + 1}</span>
            <PriorityBadge priority={item.priority} />
            <span className="text-xs text-slate-400 capitalize">{item.category.toLowerCase()}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">{item.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-2">{item.description}</p>

          <details className="group">
            <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-700 font-medium list-none flex items-center gap-1">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              Why this priority?
            </summary>
            <p className="text-xs text-slate-500 mt-1 pl-4 leading-relaxed">{item.reasoning}</p>
          </details>

          <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Suggested Action</span>
            <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{item.suggestedAction}</p>
          </div>

          {item.relatedIds && item.relatedIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.relatedIds.map((id) => (
                <span key={id} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-mono">{id}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
