"use client";

import * as React from "react";
import type { PortalSnapshot, FrameworkHealth } from "@/lib/types";

// ─── Donut Chart ──────────────────────────────────────────────────────────────

interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

function DonutChart({
  segments,
  size = 120,
  strokeWidth = 18,
  centerLabel,
  centerSub,
}: {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);

  let offset = circumference * 0.25; // start from top
  const arcs = segments.map((seg) => {
    const dashLen = total > 0 ? (seg.value / total) * circumference : 0;
    const arc = { ...seg, dashLen, offset: circumference - offset };
    offset += dashLen;
    return arc;
  });

  return (
    <svg width={size} height={size} className="shrink-0">
      {/* Background */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={strokeWidth}
      />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${arc.dashLen} ${circumference}`}
          strokeDashoffset={arc.offset}
          strokeLinecap="butt"
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
      ))}
      {centerLabel !== undefined && (
        <>
          <text
            x={size / 2}
            y={size / 2 - 4}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-slate-800 font-bold"
            fontSize={size * 0.18}
            fontWeight="700"
            fill="#1e293b"
          >
            {centerLabel}
          </text>
          {centerSub && (
            <text
              x={size / 2}
              y={size / 2 + size * 0.14}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={size * 0.1}
              fill="#94a3b8"
            >
              {centerSub}
            </text>
          )}
        </>
      )}
    </svg>
  );
}

// ─── Horizontal Bar Chart ─────────────────────────────────────────────────────

function HBarRow({
  label,
  value,
  total,
  color,
  showPct = true,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  showPct?: boolean;
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-600 w-28 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`${color} h-full rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showPct ? (
        <span className="text-xs text-slate-500 w-16 text-right shrink-0">{value} ({pct}%)</span>
      ) : (
        <span className="text-xs text-slate-500 w-8 text-right shrink-0">{value}</span>
      )}
    </div>
  );
}

// ─── Legend dot ───────────────────────────────────────────────────────────────

function LegendItem({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${color}`} />
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-semibold text-slate-700 ml-0.5">{value}</span>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function ReportCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 print:border print:break-inside-avoid">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main Report ──────────────────────────────────────────────────────────────

export default function ExecutiveReport({ snapshot }: { snapshot: PortalSnapshot }) {
  const s = snapshot;

  // Control health segments
  const controlSegments: DonutSegment[] = [
    { value: s.passingControls,          color: "#10b981", label: "Passing" },
    { value: s.failingControls,          color: "#f43f5e", label: "Failing" },
    { value: s.needsAttentionControls,   color: "#f59e0b", label: "Needs Attention" },
    { value: s.notApplicableControls,    color: "#e2e8f0", label: "N/A" },
  ];

  // Test health segments
  const testSegments: DonutSegment[] = [
    { value: s.passingTestsCount,                              color: "#10b981", label: "Passing" },
    { value: s.failingTestsCount,                              color: "#f43f5e", label: "Failing/Error" },
    { value: s.inactiveTestsCount,                             color: "#e2e8f0", label: "Inactive" },
    { value: Math.max(0, s.enabledTestsCount - s.passingTestsCount - s.failingTestsCount), color: "#fbbf24", label: "Other" },
  ].filter((seg) => seg.value > 0);

  // Framework sorted by score ascending (worst first for prominence)
  const sortedFw = [...s.frameworks].sort((a, b) => a.score - b.score);

  const ragColor = s.ragStatus === "green" ? "#10b981" : s.ragStatus === "amber" ? "#f59e0b" : "#f43f5e";
  const ragText  = s.ragStatus === "green" ? "On Track"  : s.ragStatus === "amber" ? "Needs Attention" : "At Risk";

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-5">
      {/* Report header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{s.portalLabel}</h2>
          <p className="text-sm text-slate-400">
            Executive Compliance Report · {new Date(s.capturedAt).toLocaleDateString("en-US", {
              year: "numeric", month: "long", day: "numeric",
            })}
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2 rounded-lg transition-colors print:hidden"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
            />
          </svg>
          Print / Export PDF
        </button>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Overall Score"
          value={`${s.overallScore}%`}
          sub={ragText}
          dotColor={ragColor}
        />
        <KpiCard
          label="Controls Passing"
          value={`${s.passingControls}/${s.totalControls}`}
          sub={`${s.failingControls} failing`}
          dotColor={s.failingControls > 0 ? "#f43f5e" : "#10b981"}
        />
        <KpiCard
          label="Overdue Tasks"
          value={String(s.overdueTasksCount)}
          sub={`${s.upcomingTasksCount} due in 14d`}
          dotColor={s.overdueTasksCount > 0 ? "#f43f5e" : "#10b981"}
        />
        <KpiCard
          label="Critical/High Risks"
          value={String(s.openCriticalRisks + s.openHighRisks)}
          sub={`${s.openCriticalRisks} critical`}
          dotColor={s.openCriticalRisks > 0 ? "#f43f5e" : s.openHighRisks > 0 ? "#f59e0b" : "#10b981"}
        />
      </div>

      {/* Two-column row: Controls donut + Test donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Controls */}
        <ReportCard title="Control Health" icon="🛡️">
          <div className="flex items-center gap-6">
            <DonutChart
              segments={controlSegments}
              centerLabel={`${Math.round((s.passingControls / Math.max(s.totalControls, 1)) * 100)}%`}
              centerSub="pass rate"
            />
            <div className="space-y-2 flex-1 min-w-0">
              <LegendItem color="bg-emerald-500" label="Passing"         value={s.passingControls} />
              <LegendItem color="bg-rose-500"    label="Failing"         value={s.failingControls} />
              <LegendItem color="bg-amber-400"   label="Needs attention" value={s.needsAttentionControls} />
              <LegendItem color="bg-slate-200"   label="N/A"             value={s.notApplicableControls} />
            </div>
          </div>
        </ReportCard>

        {/* Monitoring Tests */}
        <ReportCard title="Monitoring Tests" icon="🔬">
          <div className="flex items-center gap-6">
            <DonutChart
              segments={testSegments}
              centerLabel={`${s.testPassRate}%`}
              centerSub="pass rate"
            />
            <div className="space-y-2 flex-1 min-w-0">
              <LegendItem color="bg-emerald-500" label="Passing"      value={s.passingTestsCount} />
              <LegendItem color="bg-rose-500"    label="Failing/Error" value={s.failingTestsCount} />
              <LegendItem color="bg-slate-200"   label="Inactive"     value={s.inactiveTestsCount} />
              <div className="pt-1 text-xs text-slate-400">{s.enabledTestsCount} enabled total</div>
            </div>
          </div>
        </ReportCard>
      </div>

      {/* Framework compliance horizontal bars */}
      {sortedFw.length > 0 && (
        <ReportCard title="Framework Compliance" icon="📋">
          <div className="space-y-3">
            {sortedFw.map((fw) => (
              <FrameworkBar key={fw.id} fw={fw} />
            ))}
          </div>
        </ReportCard>
      )}

      {/* Risk exposure */}
      {(s.openCriticalRisks > 0 || s.openHighRisks > 0) && (
        <ReportCard title="Risk Exposure" icon="⚠️">
          <div className="space-y-3">
            <HBarRow
              label="Critical"
              value={s.openCriticalRisks}
              total={Math.max(s.openCriticalRisks + s.openHighRisks, 1)}
              color="bg-rose-500"
            />
            <HBarRow
              label="High"
              value={s.openHighRisks}
              total={Math.max(s.openCriticalRisks + s.openHighRisks, 1)}
              color="bg-orange-400"
            />
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {s.openCriticalRisks + s.openHighRisks} open risk{s.openCriticalRisks + s.openHighRisks !== 1 ? "s" : ""} requiring attention
          </p>
        </ReportCard>
      )}

      {/* Overall health narrative */}
      <ReportCard title="Health Summary" icon="📊">
        <HealthNarrative snapshot={s} />
      </ReportCard>

      <p className="text-xs text-slate-400 text-center print:hidden">
        Data captured {new Date(s.capturedAt).toLocaleString()} · Powered by Drata + Claude AI
      </p>
    </div>
  );
}

// ─── Framework bar (colored by score) ────────────────────────────────────────

function FrameworkBar({ fw }: { fw: FrameworkHealth }) {
  const pct = fw.score;
  const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-500";
  const textColor = pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-rose-600";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-700 font-medium truncate pr-4" title={fw.name}>{fw.name}</span>
        <span className={`text-xs font-bold ${textColor} shrink-0`}>{pct}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className={`${barColor} h-full rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-0.5">
        {fw.passingCount}/{fw.totalCount} requirements met
      </p>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  dotColor,
}: {
  label: string;
  value: string;
  sub: string;
  dotColor: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 print:border">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mb-1">{value}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor }} />
        <span className="text-xs text-slate-400">{sub}</span>
      </div>
    </div>
  );
}

// ─── Health narrative ─────────────────────────────────────────────────────────

function HealthNarrative({ snapshot: s }: { snapshot: PortalSnapshot }) {
  const lines: string[] = [];

  const ragLabel = s.ragStatus === "green" ? "on track" : s.ragStatus === "amber" ? "needing attention" : "at risk";
  lines.push(
    `${s.workspaceName} is currently ${ragLabel} with an overall compliance score of ${s.overallScore}%.`
  );

  if (s.frameworks.length > 0) {
    const worst = [...s.frameworks].sort((a, b) => a.score - b.score)[0]!;
    const best  = [...s.frameworks].sort((a, b) => b.score - a.score)[0]!;
    if (worst.score < 80) {
      lines.push(`${worst.name} has the lowest compliance score at ${worst.score}% and may need immediate attention.`);
    }
    if (best.score >= 90 && best.id !== worst.id) {
      lines.push(`${best.name} is performing well at ${best.score}%.`);
    }
  }

  if (s.failingControls > 0) {
    const pct = Math.round((s.failingControls / s.totalControls) * 100);
    lines.push(`${s.failingControls} of ${s.totalControls} controls (${pct}%) are currently failing.`);
  } else {
    lines.push("All monitored controls are currently passing.");
  }

  if (s.overdueTasksCount > 0) {
    lines.push(`${s.overdueTasksCount} task${s.overdueTasksCount !== 1 ? "s are" : " is"} overdue and should be addressed promptly.`);
  }

  if (s.openCriticalRisks > 0) {
    lines.push(`${s.openCriticalRisks} critical risk${s.openCriticalRisks !== 1 ? "s require" : " requires"} immediate action.`);
  }

  if (s.failingTestsCount > 0) {
    lines.push(`${s.failingTestsCount} monitoring test${s.failingTestsCount !== 1 ? "s are" : " is"} currently failing. Review the Monitoring Tests tab for remediation steps.`);
  }

  return (
    <ul className="space-y-2">
      {lines.map((line, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-600">
          <span className="text-slate-300 shrink-0 mt-0.5">•</span>
          {line}
        </li>
      ))}
    </ul>
  );
}
