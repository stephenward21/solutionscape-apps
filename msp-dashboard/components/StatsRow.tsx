"use client";

import type { WorkspaceSnapshot } from "@/lib/types";

interface Props {
  snapshot: WorkspaceSnapshot;
}

export default function StatsRow({ snapshot }: Props) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      <div className="flex items-center gap-1">
        <span className="text-red-500 font-bold">✗</span>
        <span className="text-slate-600">
          <span className="font-semibold text-slate-800">
            {snapshot.failingControls}
          </span>{" "}
          failing
        </span>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-amber-500">⏰</span>
        <span className="text-slate-600">
          <span className="font-semibold text-slate-800">
            {snapshot.overdueTasksCount}
          </span>{" "}
          overdue
        </span>
      </div>
      {snapshot.openHighRisks > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-orange-500">⚠</span>
          <span className="text-slate-600">
            <span className="font-semibold text-slate-800">
              {snapshot.openHighRisks}
            </span>{" "}
            high
          </span>
        </div>
      )}
      {snapshot.openCriticalRisks > 0 && (
        <div className="flex items-center gap-1">
          <span className="text-red-600">🔴</span>
          <span className="text-slate-600">
            <span className="font-semibold text-slate-800">
              {snapshot.openCriticalRisks}
            </span>{" "}
            critical
          </span>
        </div>
      )}
    </div>
  );
}
