"use client";

import type { FrameworkHealth } from "@/lib/types";

interface Props {
  framework: FrameworkHealth;
}

export default function FrameworkBar({ framework }: Props) {
  const { name, passingCount, failingCount, needsAttentionCount, totalCount, score } =
    framework;

  const passingPct = totalCount > 0 ? (passingCount / totalCount) * 100 : 0;
  const needsAttentionPct =
    totalCount > 0 ? (needsAttentionCount / totalCount) * 100 : 0;
  const failingPct = totalCount > 0 ? (failingCount / totalCount) * 100 : 0;

  // Shorten common framework names
  const shortName = name
    .replace("Service Organization Control", "SOC")
    .replace("International Organization for Standardization", "ISO")
    .replace("Health Insurance Portability and Accountability Act", "HIPAA")
    .replace("Payment Card Industry Data Security Standard", "PCI DSS")
    .replace("General Data Protection Regulation", "GDPR");

  return (
    <div className="flex items-center gap-2 w-full">
      <span
        className="text-xs text-slate-600 w-24 flex-shrink-0 truncate"
        title={name}
      >
        {shortName}
      </span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="flex h-full">
          <div
            className="bg-green-500 h-full transition-all"
            style={{ width: `${passingPct}%` }}
          />
          <div
            className="bg-amber-400 h-full transition-all"
            style={{ width: `${needsAttentionPct}%` }}
          />
          <div
            className="bg-red-500 h-full transition-all"
            style={{ width: `${failingPct}%` }}
          />
        </div>
      </div>
      <span className="text-xs font-medium text-slate-700 w-9 text-right flex-shrink-0">
        {score}%
      </span>
    </div>
  );
}
