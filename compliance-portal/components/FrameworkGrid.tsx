"use client";
import type { FrameworkHealth } from "@/lib/types";

function scoreColor(score: number) {
  if (score >= 80) return { bar: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" };
  if (score >= 60) return { bar: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50" };
  return { bar: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-50" };
}

export default function FrameworkGrid({ frameworks }: { frameworks: FrameworkHealth[] }) {
  if (!frameworks.length) {
    return <p className="text-sm text-slate-400">No frameworks found.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {frameworks.map((fw) => {
        const c = scoreColor(fw.score);
        return (
          <div key={fw.id} className={`rounded-xl border border-slate-100 p-4 ${c.bg}`}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-sm font-medium text-slate-700 leading-tight">{fw.name}</span>
              <span className={`text-lg font-bold ${c.text}`}>{fw.score}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
              <div
                className={`${c.bar} h-1.5 rounded-full transition-all duration-500`}
                style={{ width: `${fw.score}%` }}
              />
            </div>
            <div className="text-xs text-slate-500">
              {fw.passingCount} / {fw.totalCount} requirements met
            </div>
          </div>
        );
      })}
    </div>
  );
}
