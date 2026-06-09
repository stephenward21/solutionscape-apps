"use client";
import { useState } from "react";
import type { DrataControl, ControlStatus } from "@/lib/types";
import { getControlStatus } from "@/lib/types";

const STATUS_CONFIG: Record<ControlStatus, { label: string; dot: string; badge: string }> = {
  PASSING: { label: "Passing", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700" },
  FAILING: { label: "Failing", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700" },
  NEEDS_ATTENTION: { label: "Needs Attention", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700" },
  NOT_APPLICABLE: { label: "N/A", dot: "bg-slate-300", badge: "bg-slate-50 text-slate-500" },
};

type Filter = ControlStatus | "ALL";

export default function ControlsPanel({
  controls,
  loading,
}: {
  controls: DrataControl[];
  loading: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("FAILING");
  const [search, setSearch] = useState("");

  if (loading) return <Loading text="Loading controls…" />;

  const statusCounts: Record<ControlStatus, number> = {
    PASSING: 0, FAILING: 0, NEEDS_ATTENTION: 0, NOT_APPLICABLE: 0,
  };
  controls.forEach((c) => { statusCounts[getControlStatus(c)]++; });

  const filtered = controls
    .filter((c) => filter === "ALL" || getControlStatus(c) === filter)
    .filter(
      (c) =>
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.code ?? "").toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(["ALL", "FAILING", "NEEDS_ATTENTION", "PASSING"] as Filter[]).map((f) => {
          const count = f === "ALL" ? controls.length : statusCounts[f as ControlStatus];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                active
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f === "ALL" ? "All" : STATUS_CONFIG[f as ControlStatus].label} ({count})
            </button>
          );
        })}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-slate-50"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">No controls match this filter.</p>
      ) : (
        <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
          {filtered.map((c) => {
            const status = getControlStatus(c);
            const cfg = STATUS_CONFIG[status];
            const owner = c.owners?.[0];
            const ownerName = owner
              ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || owner.email
              : null;
            return (
              <div key={c.id} className="flex items-start gap-3 border border-slate-100 rounded-xl p-3.5 hover:border-slate-200 transition-colors">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    {c.code && (
                      <span className="text-xs text-slate-400 font-mono">{c.code}</span>
                    )}
                    {c.frameworkTags?.map((tag) => (
                      <span key={tag} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-slate-800">{c.name}</p>
                  {ownerName && (
                    <p className="text-xs text-slate-400 mt-0.5">Owner: {ownerName}</p>
                  )}
                  {!c.flags?.hasEvidence && status !== "PASSING" && (
                    <p className="text-xs text-amber-600 mt-0.5">⚠ No evidence attached</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Loading({ text }: { text: string }) {
  return (
    <div className="py-12 text-center">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}
