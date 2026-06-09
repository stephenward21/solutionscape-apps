"use client";

import type { FrameworkHealth } from "@/lib/types";

interface Props {
  framework: FrameworkHealth;
  compact?: boolean;
}

// Shorten common framework names
function shortName(name: string): string {
  return name
    .replace(/Service Organization Controls?/i, "SOC")
    .replace(/International Organization for Standardization/i, "ISO")
    .replace(/Health Insurance Portability and Accountability Act/i, "HIPAA")
    .replace(/Payment Card Industry Data Security Standard/i, "PCI DSS")
    .replace(/General Data Protection Regulation/i, "GDPR");
}

export default function FrameworkBar({ framework, compact = false }: Props) {
  const { name, passingCount, totalCount, score } = framework;
  const passingPct = totalCount > 0 ? (passingCount / totalCount) * 100 : 0;

  const displayName = shortName(name);

  if (compact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <span className="text-xs text-slate-500 w-20 flex-shrink-0 truncate" title={name}>
          {displayName}
        </span>
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-700 rounded-full transition-all"
            style={{ width: `${passingPct}%` }}
          />
        </div>
        <span className="text-xs font-semibold text-slate-700 w-8 text-right flex-shrink-0">
          {score}%
        </span>
        <span className="text-xs text-slate-400 w-14 flex-shrink-0 text-right">
          {passingCount}/{totalCount}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-full">
      <span className="text-sm text-slate-600 w-28 flex-shrink-0 truncate" title={name}>
        {displayName}
      </span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-slate-700 rounded-full transition-all"
          style={{ width: `${passingPct}%` }}
        />
      </div>
      <span className="text-sm font-semibold text-slate-800 w-10 text-right flex-shrink-0">
        {score}%
      </span>
      <span className="text-xs text-slate-400 w-16 flex-shrink-0 text-right">
        {passingCount}/{totalCount} ready
      </span>
    </div>
  );
}
