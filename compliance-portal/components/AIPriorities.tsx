"use client";
import type { AIPrioritiesResult, ActionItem, Priority } from "@/lib/types";

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; dot: string }> = {
  CRITICAL: { label: "Critical", color: "bg-rose-100 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  HIGH: { label: "High", color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  MEDIUM: { label: "Medium", color: "bg-sky-100 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  LOW: { label: "Low", color: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const CATEGORY_ICON: Record<ActionItem["category"], string> = {
  CONTROL: "🛡️",
  TASK: "📋",
  RISK: "⚠️",
  TEST: "🔬",
};

function PriorityBadge({ priority }: { priority: Priority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function AIPriorities({
  priorities,
  loading,
  error,
  onRefresh,
}: {
  priorities: AIPrioritiesResult | null;
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
}) {
  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-500 text-sm">Claude is analyzing your compliance posture…</p>
        <p className="text-slate-400 text-xs mt-1">This may take 15-30 seconds on first load</p>
      </div>
    );
  }

  if (error || !priorities) {
    return (
      <div className="py-12 text-center">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-slate-600 text-sm font-medium mb-1">AI analysis unavailable</p>
        {error && (
          <p className="text-rose-500 text-xs max-w-md mx-auto mb-3 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <button onClick={onRefresh} className="mt-1 text-brand-600 hover:text-brand-700 text-sm font-medium">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Summary */}
      <div className="bg-gradient-to-r from-brand-50 to-sky-50 border border-brand-100 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-900 mb-1">AI Analysis Summary</p>
            <p className="text-sm text-slate-600 leading-relaxed">{priorities.summary}</p>
            <p className="text-xs text-slate-400 mt-2">
              Generated {new Date(priorities.generatedAt).toLocaleString()} · Cached 6h
              <button
                onClick={onRefresh}
                className="ml-2 text-brand-600 hover:text-brand-700 font-medium"
              >
                Refresh
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Action items */}
      {priorities.items.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">No action items — great compliance posture!</p>
      ) : (
        <div className="space-y-3">
          {priorities.items.map((item, idx) => (
            <ActionItemCard key={item.id} item={item} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionItemCard({ item, index }: { item: ActionItem; index: number }) {
  return (
    <div className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 hover:shadow-sm transition-all">
      <div className="flex items-start gap-3">
        <div className="text-xl shrink-0 mt-0.5">{CATEGORY_ICON[item.category]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-xs text-slate-400 font-medium">#{index + 1}</span>
            <PriorityBadge priority={item.priority} />
            <span className="text-xs text-slate-500 capitalize">{item.category.toLowerCase()}</span>
          </div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">{item.title}</h3>
          <p className="text-sm text-slate-600 mb-2 leading-relaxed">{item.description}</p>

          {/* Reasoning */}
          <details className="group">
            <summary className="text-xs text-brand-600 cursor-pointer hover:text-brand-700 font-medium list-none flex items-center gap-1">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
              Why this priority?
            </summary>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed pl-4">{item.reasoning}</p>
          </details>

          {/* Suggested action */}
          <div className="mt-3 bg-slate-50 rounded-lg px-3 py-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Suggested Action</span>
            <p className="text-sm text-slate-700 mt-0.5 leading-relaxed">{item.suggestedAction}</p>
          </div>

          {item.relatedIds && item.relatedIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {item.relatedIds.map((id) => (
                <span key={id} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {id}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
