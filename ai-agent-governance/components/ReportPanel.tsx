"use client";

import { useState, useMemo } from "react";
import type {
  GovernanceReport, UserComplianceRecord, ComplianceStatus,
  PolicyAnalysisResult, UserActivity, IdPProvider,
} from "@/lib/types";

// ─── Print export ─────────────────────────────────────────────────────────────

function statusColor(s: ComplianceStatus): string {
  return s === "BREACH" ? "#e11d48" : s === "CONDITIONAL" ? "#d97706" : s === "COMPLIANT" ? "#059669" : "#94a3b8";
}
function statusLabel(s: ComplianceStatus): string {
  return s === "BREACH" ? "Breach" : s === "CONDITIONAL" ? "Conditional" : s === "COMPLIANT" ? "Compliant" : "Unknown";
}

function buildPrintHtml(report: GovernanceReport): string {
  const date = new Date(report.generatedAt).toLocaleString(undefined, {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  // ── Aggregate apps (same logic as appRows in the component) ──────────────────
  const appMap = new Map<string, { tool: string; vendor: string; worstStatus: ComplianceStatus; breachCount: number; conditionalCount: number; approvedCount: number; reason?: string; recommendation?: string }>();
  for (const u of report.userRecords) {
    for (const t of u.breachingTools) {
      const e = appMap.get(t.tool);
      e ? e.breachCount++ : appMap.set(t.tool, { tool: t.tool, vendor: t.vendor, worstStatus: "BREACH", breachCount: 1, conditionalCount: 0, approvedCount: 0, reason: t.reason, recommendation: t.recommendation });
    }
    for (const t of u.conditionalTools) {
      const e = appMap.get(t.tool);
      e ? e.conditionalCount++ : appMap.set(t.tool, { tool: t.tool, vendor: t.vendor, worstStatus: "CONDITIONAL", breachCount: 0, conditionalCount: 1, approvedCount: 0, reason: t.reason, recommendation: t.recommendation });
    }
    for (const t of u.approvedTools) {
      const e = appMap.get(t.tool);
      e ? e.approvedCount++ : appMap.set(t.tool, { tool: t.tool, vendor: t.vendor, worstStatus: "COMPLIANT", breachCount: 0, conditionalCount: 0, approvedCount: 1 });
    }
  }
  const apps = [...appMap.values()].sort((a, b) => {
    const o: Record<ComplianceStatus, number> = { BREACH: 4, CONDITIONAL: 3, UNKNOWN: 2, COMPLIANT: 1 };
    return o[b.worstStatus] - o[a.worstStatus];
  });

  const sortedUsers = [...report.userRecords].sort((a, b) => b.riskScore - a.riskScore);

  // ── HTML helpers ──────────────────────────────────────────────────────────────
  const h = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const kpiBox = (label: string, value: number | string, color = "#1e293b") =>
    `<div style="flex:1;min-width:100px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 10px;text-align:center">
       <div style="font-size:26px;font-weight:700;color:${color}">${value}</div>
       <div style="font-size:11px;color:#64748b;margin-top:3px">${h(label)}</div>
     </div>`;

  const badge = (s: ComplianceStatus) =>
    `<span style="display:inline-block;background:${s === "BREACH" ? "#fff1f2" : s === "CONDITIONAL" ? "#fffbeb" : s === "COMPLIANT" ? "#ecfdf5" : "#f8fafc"};color:${statusColor(s)};border:1px solid ${s === "BREACH" ? "#fecdd3" : s === "CONDITIONAL" ? "#fde68a" : s === "COMPLIANT" ? "#a7f3d0" : "#e2e8f0"};border-radius:20px;padding:2px 8px;font-size:11px;font-weight:600">${statusLabel(s)}</span>`;

  const sectionHeader = (title: string, pageBreak = false) =>
    `<h2 style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:${pageBreak ? "0 0 16px" : "28px 0 16px"};${pageBreak ? "page-break-before:always;padding-top:20px;" : ""}">${h(title)}</h2>`;

  const tdStyle = "padding:8px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#334155;vertical-align:top";
  const thStyle = "padding:8px 10px;background:#f8fafc;font-size:11px;color:#64748b;font-weight:600;text-align:left;border-bottom:2px solid #e2e8f0";

  // ── Section 1: Summary ────────────────────────────────────────────────────────
  const summarySection = `
    ${sectionHeader("Compliance Summary")}

    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
      ${kpiBox("Total Users",   report.totalUsers)}
      ${kpiBox("Compliant",     report.compliantUsers,   "#059669")}
      ${kpiBox("In Breach",     report.breachingUsers,   "#e11d48")}
      ${kpiBox("Conditional",   report.conditionalUsers, "#d97706")}
      ${kpiBox("Unknown",       report.unknownUsers ?? 0, "#94a3b8")}
    </div>

    ${report.aiNarrative ? `
    <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">AI Executive Summary</div>
      <div style="font-size:12.5px;color:#1e293b;line-height:1.65">${h(report.aiNarrative)}</div>
    </div>` : ""}

    ${report.prohibitedToolsInUse.length > 0 ? `
    <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:14px 16px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#be123c;text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Prohibited Tools Actively In Use (${report.prohibitedToolsInUse.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${report.prohibitedToolsInUse.map((t) => `<span style="background:white;border:1px solid #fecdd3;color:#be123c;border-radius:20px;padding:2px 10px;font-size:12px;font-weight:500">${h(t)}</span>`).join("")}
      </div>
    </div>` : ""}

    ${report.toolsNeedingReview > 0 ? `
    <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:12px 16px;margin-bottom:12px">
      <div style="font-size:12px;font-weight:600;color:#7c3aed">${report.toolsNeedingReview} app${report.toolsNeedingReview === 1 ? "" : "s"} flagged for manual review — could not be automatically classified.</div>
    </div>` : ""}

    <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">Compliance Breakdown</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Users</th>
          <th style="${thStyle}">% of Total</th>
        </tr></thead>
        <tbody>
          ${(["BREACH","CONDITIONAL","COMPLIANT","UNKNOWN"] as ComplianceStatus[]).map((s) => {
            const count = report.userRecords.filter((u) => u.complianceStatus === s).length;
            const pct   = report.totalUsers ? Math.round((count / report.totalUsers) * 100) : 0;
            return `<tr>
              <td style="${tdStyle}">${badge(s)}</td>
              <td style="${tdStyle};font-weight:600;color:${statusColor(s)}">${count}</td>
              <td style="${tdStyle}">${pct}%</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>

    ${report.topRiskUsers.length > 0 ? `
    <div style="background:white;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px">
      <div style="font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">Top Risk Users</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="${thStyle}">User</th>
          <th style="${thStyle}">Department</th>
          <th style="${thStyle}">Status</th>
          <th style="${thStyle}">Risk Score</th>
        </tr></thead>
        <tbody>
          ${report.topRiskUsers.slice(0, 10).map((u) => `
          <tr>
            <td style="${tdStyle}"><div style="font-weight:500">${h(u.displayName ?? u.email)}</div>${u.displayName ? `<div style="font-size:11px;color:#94a3b8">${h(u.email)}</div>` : ""}</td>
            <td style="${tdStyle}">${h(u.department ?? "—")}</td>
            <td style="${tdStyle}">${badge(u.complianceStatus)}</td>
            <td style="${tdStyle};font-weight:700;color:${statusColor(u.complianceStatus)}">${u.riskScore}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : ""}
  `;

  // ── Section 2: Identified Apps ────────────────────────────────────────────────
  const appsSection = `
    ${sectionHeader("Identified Apps", true)}
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="${thStyle}">Status</th>
        <th style="${thStyle}">Tool</th>
        <th style="${thStyle}">Vendor</th>
        <th style="${thStyle}">In Breach</th>
        <th style="${thStyle}">Conditional</th>
        <th style="${thStyle}">Approved</th>
        <th style="${thStyle}">Policy Reason</th>
      </tr></thead>
      <tbody>
        ${apps.map((a) => `
        <tr style="background:${a.worstStatus === "BREACH" ? "#fff1f2" : a.worstStatus === "CONDITIONAL" ? "#fffbeb" : "white"}">
          <td style="${tdStyle}">${badge(a.worstStatus)}</td>
          <td style="${tdStyle};font-weight:500">${h(a.tool)}</td>
          <td style="${tdStyle};color:#64748b">${h(a.vendor)}</td>
          <td style="${tdStyle};color:#e11d48;font-weight:600">${a.breachCount > 0 ? `${a.breachCount} user${a.breachCount !== 1 ? "s" : ""}` : "—"}</td>
          <td style="${tdStyle};color:#d97706;font-weight:600">${a.conditionalCount > 0 ? String(a.conditionalCount) : "—"}</td>
          <td style="${tdStyle};color:#059669;font-weight:600">${a.approvedCount > 0 ? String(a.approvedCount) : "—"}</td>
          <td style="${tdStyle};color:#475569;font-size:11px">${h(a.reason ?? "")}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  `;

  // ── Section 3: Users ──────────────────────────────────────────────────────────
  const usersSection = `
    ${sectionHeader("User Detail", true)}
    ${sortedUsers.map((u) => `
    <div style="border:1px solid ${u.complianceStatus === "BREACH" ? "#fecdd3" : u.complianceStatus === "CONDITIONAL" ? "#fde68a" : "#e2e8f0"};border-radius:10px;margin-bottom:14px;overflow:hidden;page-break-inside:avoid">
      <div style="padding:10px 14px;background:${u.complianceStatus === "BREACH" ? "#fff1f2" : u.complianceStatus === "CONDITIONAL" ? "#fffbeb" : "#f8fafc"};display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <span style="font-size:13px;font-weight:600;color:#0f172a">${h(u.displayName ?? u.email)}</span>
          ${u.displayName ? `<span style="font-size:11px;color:#94a3b8;margin-left:8px">${h(u.email)}</span>` : ""}
          ${u.department ? `<span style="font-size:11px;color:#64748b;margin-left:8px">· ${h(u.department)}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${badge(u.complianceStatus)}
          <span style="font-size:15px;font-weight:700;color:${statusColor(u.complianceStatus)}">${u.riskScore}</span>
        </div>
      </div>
      ${u.breachingTools.length > 0 ? `
      <div style="padding:10px 14px">
        <div style="font-size:11px;font-weight:700;color:#be123c;margin-bottom:6px">POLICY BREACHES</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="${thStyle}">Tool</th>
            <th style="${thStyle}">Vendor</th>
            <th style="${thStyle}">Reason</th>
            <th style="${thStyle}">Recommendation</th>
          </tr></thead>
          <tbody>
            ${u.breachingTools.map((t) => `
            <tr style="background:#fff1f2">
              <td style="${tdStyle};font-weight:500">${h(t.tool)}</td>
              <td style="${tdStyle}">${h(t.vendor)}</td>
              <td style="${tdStyle};color:#be123c">${h(t.reason ?? "")}</td>
              <td style="${tdStyle};color:#475569">${h(t.recommendation ?? "")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}
      ${u.conditionalTools.length > 0 ? `
      <div style="padding:0 14px 10px">
        <div style="font-size:11px;font-weight:700;color:#b45309;margin-bottom:6px">CONDITIONAL TOOLS</div>
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${u.conditionalTools.map((t) => `
            <tr style="background:#fffbeb">
              <td style="${tdStyle};font-weight:500;width:140px">${h(t.tool)}</td>
              <td style="${tdStyle};color:#b45309">${h(t.reason ?? "")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>` : ""}
      ${u.approvedTools.length > 0 ? `
      <div style="padding:0 14px 10px">
        <div style="font-size:11px;font-weight:700;color:#059669;margin-bottom:5px">APPROVED TOOLS</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px">
          ${u.approvedTools.map((t) => `<span style="background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;border-radius:20px;padding:2px 8px;font-size:11px">${h(t.tool)}</span>`).join("")}
        </div>
      </div>` : ""}
    </div>`).join("")}
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Compliance Report${report.organizationName ? ` — ${report.organizationName}` : ""}</title>
  <style>
    @page { margin: 18mm 16mm; size: A4; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; color: #1e293b; margin: 0; padding: 20px; background: white; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <!-- Cover header -->
  <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:16px;border-bottom:3px solid #0f172a">
    <div>
      <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">AI Tooling Governance</div>
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 4px">Compliance Report</h1>
      ${report.organizationName ? `<div style="font-size:14px;color:#475569;margin-bottom:2px">${h(report.organizationName)}</div>` : ""}
      <div style="font-size:11px;color:#94a3b8">Generated ${h(date)}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">Report covers</div>
      <div style="font-size:20px;font-weight:700;color:#0f172a">${report.totalUsers} users</div>
      <div style="font-size:11px;color:#64748b">${apps.length} apps identified</div>
    </div>
  </div>

  ${summarySection}
  ${appsSection}
  ${usersSection}

  <div style="margin-top:32px;padding-top:12px;border-top:1px solid #e2e8f0;text-align:center;font-size:10px;color:#94a3b8">
    Confidential — AI Tooling Governance by SolutionScape · Generated ${h(date)}
  </div>
</body>
</html>`;
}

function openPrintWindow(report: GovernanceReport) {
  const html = buildPrintHtml(report);
  // In Electron, window.open is blocked by setWindowOpenHandler — use IPC instead
  if (window.electronAPI) {
    void window.electronAPI.reports.print(html);
    return;
  }
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; badge: string; dot: string; row: string; border: string }> = {
  COMPLIANT:   { label: "Compliant",   badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500", row: "",              border: "border-emerald-200" },
  BREACH:      { label: "Breach",      badge: "bg-rose-100 text-rose-700",       dot: "bg-rose-500",    row: "bg-rose-50/40",  border: "border-rose-300" },
  CONDITIONAL: { label: "Conditional", badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500",   row: "bg-amber-50/30", border: "border-amber-200" },
  UNKNOWN:     { label: "Unknown",     badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-300",   row: "",              border: "border-slate-200" },
};

const STATUS_ORDER: Record<ComplianceStatus, number> = { BREACH: 4, CONDITIONAL: 3, UNKNOWN: 2, COMPLIANT: 1 };

type ReportTab  = "summary" | "apps" | "users";
type NotifyCh   = "email" | "slack" | "teams";
type RevokeState = "idle" | "confirming" | "revoking" | "revoked" | "error";

interface NotifyConfig {
  channel: NotifyCh;
  smtpHost?: string; smtpPort?: string; smtpUser?: string; smtpPass?: string;
  fromEmail?: string; fromName?: string;
  webhookUrl?: string; teamsWebhookUrl?: string;
  orgName?: string; adminContact?: string;
}

// Aggregated app row derived from all user records
interface AppRow {
  tool: string;
  vendor: string;
  worstStatus: ComplianceStatus;
  breachCount: number;
  conditionalCount: number;
  approvedCount: number;
  reason?: string;
  recommendation?: string;
  systemsAccessed: string[];
}

const PAGE_SIZE = 50;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReportPanelProps {
  policyResult: PolicyAnalysisResult | null;
  idpUsers: UserActivity[];
  provider?: IdPProvider;
  credentials?: Record<string, string>;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ReportPanel({ policyResult, idpUsers, provider, credentials }: ReportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [report, setReport]   = useState<GovernanceReport | null>(null);

  // Tabs
  const [tab, setTab]                 = useState<ReportTab>("summary");
  const [appFilter, setAppFilter]     = useState<ComplianceStatus | "all">("all");
  const [appSearch, setAppSearch]     = useState("");
  const [userSearch, setUserSearch]   = useState("");
  const [userFilter, setUserFilter]   = useState<ComplianceStatus | "all">("all");
  const [userPage, setUserPage]       = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [notifyConfig, setNotifyConfig] = useState<NotifyConfig>({ channel: "email" });
  const [notifyConfigOpen, setNotifyConfigOpen] = useState(false);

  // ── Generate report ───────────────────────────────────────────────────────────

  async function generateReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyResult, users: idpUsers }),
      });
      const data = await res.json() as GovernanceReport & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Report generation failed");
      setReport(data);
      setTab("summary");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  // ── Derived: aggregated app list ──────────────────────────────────────────────

  const appRows = useMemo((): AppRow[] => {
    if (!report) return [];
    const map = new Map<string, AppRow>();

    for (const u of report.userRecords) {
      for (const t of u.breachingTools) {
        const existing = map.get(t.tool);
        if (existing) {
          existing.breachCount++;
          if (t.systemsAccessed) existing.systemsAccessed = [...new Set([...existing.systemsAccessed, ...t.systemsAccessed])];
        } else {
          map.set(t.tool, {
            tool: t.tool, vendor: t.vendor,
            worstStatus: "BREACH",
            breachCount: 1, conditionalCount: 0, approvedCount: 0,
            reason: t.reason, recommendation: t.recommendation,
            systemsAccessed: t.systemsAccessed ?? [],
          });
        }
      }
      for (const t of u.conditionalTools) {
        const existing = map.get(t.tool);
        if (existing) {
          existing.conditionalCount++;
        } else {
          map.set(t.tool, {
            tool: t.tool, vendor: t.vendor,
            worstStatus: "CONDITIONAL",
            breachCount: 0, conditionalCount: 1, approvedCount: 0,
            reason: t.reason, recommendation: t.recommendation,
            systemsAccessed: t.systemsAccessed ?? [],
          });
        }
      }
      for (const t of u.approvedTools) {
        const existing = map.get(t.tool);
        if (existing) {
          existing.approvedCount++;
        } else {
          map.set(t.tool, {
            tool: t.tool, vendor: t.vendor,
            worstStatus: "COMPLIANT",
            breachCount: 0, conditionalCount: 0, approvedCount: 1,
            reason: undefined, recommendation: undefined,
            systemsAccessed: [],
          });
        }
      }
    }
    return [...map.values()].sort((a, b) => STATUS_ORDER[b.worstStatus] - STATUS_ORDER[a.worstStatus]);
  }, [report]);

  const filteredApps = useMemo(() => {
    const low = appSearch.toLowerCase();
    return appRows.filter((r) => {
      const statusMatch = appFilter === "all" || r.worstStatus === appFilter;
      const textMatch   = !appSearch || r.tool.toLowerCase().includes(low) || r.vendor.toLowerCase().includes(low);
      return statusMatch && textMatch;
    });
  }, [appRows, appFilter, appSearch]);

  // ── Derived: sorted user records ──────────────────────────────────────────────

  const sortedUsers = useMemo(() => {
    if (!report) return [];
    return [...report.userRecords].sort((a, b) => STATUS_ORDER[b.complianceStatus] - STATUS_ORDER[a.complianceStatus]);
  }, [report]);

  const filteredUsers = useMemo(() => {
    const low = userSearch.toLowerCase();
    return sortedUsers.filter((u) => {
      const statusMatch = userFilter === "all" || u.complianceStatus === userFilter;
      const textMatch   = !userSearch ||
        u.email.toLowerCase().includes(low) ||
        (u.displayName ?? "").toLowerCase().includes(low) ||
        (u.department ?? "").toLowerCase().includes(low) ||
        u.breachingTools.some((t) => t.tool.toLowerCase().includes(low));
      return statusMatch && textMatch;
    });
  }, [sortedUsers, userFilter, userSearch]);

  const userPageCount = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const pagedUsers    = filteredUsers.slice(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE);

  // ── Pre-report state ──────────────────────────────────────────────────────────

  if (!report) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Compliance Report</h2>
          <p className="text-sm text-slate-500">
            After uploading a policy and connecting your directory, generate a report
            showing which users are breaching your AI policy and why.
          </p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 text-center">
          <p className="text-3xl mb-3">📊</p>
          <p className="text-sm font-semibold text-slate-700 mb-1">Generate Compliance Report</p>
          <div className="inline-flex flex-col gap-2 text-left mb-5 mt-2">
            <StepCheck done={!!policyResult} label="AI Policy analyzed" />
            <StepCheck done={idpUsers.length > 0} label={`Directory connected${idpUsers.length > 0 ? ` (${idpUsers.length} users)` : ""}`} />
          </div>
          {error && (
            <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 mb-4 text-left">{error}</div>
          )}
          <button
            onClick={() => { void generateReport(); }}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl px-6 py-3 transition-colors"
          >
            {loading ? (
              <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Claude is generating report…</>
            ) : "Generate Compliance Report"}
          </button>
        </div>
      </div>
    );
  }

  // ── Report ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Compliance Report</h2>
          {report.organizationName && <p className="text-sm text-slate-500">{report.organizationName}</p>}
          <p className="text-xs text-slate-400">Generated {new Date(report.generatedAt).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openPrintWindow(report)} className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors">
            Print / PDF
          </button>
          <button onClick={() => { setReport(null); }} className="text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors">
            Regenerate
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Total Users"   value={report.totalUsers}       color="text-slate-700"   bg="bg-slate-50" />
        <StatBox label="Compliant"     value={report.compliantUsers}   color="text-emerald-600" bg="bg-emerald-50" />
        <StatBox label="In Breach"     value={report.breachingUsers}   color="text-rose-600"    bg="bg-rose-50" />
        <StatBox label="Conditional"   value={report.conditionalUsers} color="text-amber-600"   bg="bg-amber-50" />
      </div>

      {/* Tab bar */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          {([
            { key: "summary", label: "Compliance Summary" },
            { key: "apps",    label: `Identified Apps (${appRows.length})` },
            { key: "users",   label: `Users (${report.totalUsers})` },
          ] as { key: ReportTab; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? "border-brand-600 text-brand-700"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── Tab: Summary ── */}
      {tab === "summary" && (
        <div className="space-y-4">

          {/* AI narrative */}
          {report.aiNarrative && (
            <div className="bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200 rounded-xl p-5">
              <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-2">AI Executive Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{report.aiNarrative}</p>
            </div>
          )}

          {/* Prohibited tools */}
          {report.prohibitedToolsInUse.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">
                Prohibited Tools Actively In Use
              </p>
              <div className="flex flex-wrap gap-2">
                {report.prohibitedToolsInUse.map((tool) => (
                  <span key={tool} className="text-xs bg-white border border-rose-300 text-rose-700 px-2 py-1 rounded-full font-medium">{tool}</span>
                ))}
              </div>
            </div>
          )}

          {/* Needs manual review */}
          {report.toolsNeedingReview > 0 && (
            <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">
                {report.toolsNeedingReview} App{report.toolsNeedingReview === 1 ? "" : "s"} Need Manual Review
              </p>
              <p className="text-xs text-violet-700">
                These OAuth grants didn&apos;t match our known AI-tool list and Claude couldn&apos;t confidently
                classify them. Expand a user in the Users tab to see details.
              </p>
            </div>
          )}

          {/* Compliance breakdown */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-3">Compliance Breakdown</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {(["BREACH", "CONDITIONAL", "COMPLIANT", "UNKNOWN"] as ComplianceStatus[]).map((s) => {
                const count = report.userRecords.filter((u) => u.complianceStatus === s).length;
                const cfg   = STATUS_CONFIG[s];
                return (
                  <button
                    key={s}
                    onClick={() => { setTab("users"); setUserFilter(s); }}
                    className={`rounded-lg p-3 text-center border transition-colors hover:opacity-80 ${cfg.border} ${cfg.row || "bg-white"}`}
                  >
                    <p className={`text-2xl font-bold ${cfg.badge.split(" ")[1]}`}>{count}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{cfg.label}</p>
                  </button>
                );
              })}
            </div>

            {/* Top risk users */}
            {report.topRiskUsers.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 mb-2">Top risk users</p>
                <div className="space-y-1.5">
                  {report.topRiskUsers.slice(0, 5).map((u) => {
                    const cfg = STATUS_CONFIG[u.complianceStatus];
                    return (
                      <div key={u.userId} className="flex items-center gap-2 text-xs">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-slate-700 font-medium truncate flex-1">{u.displayName ?? u.email}</span>
                        <span className={`px-1.5 py-0.5 rounded-full font-semibold ${cfg.badge}`}>{cfg.label}</span>
                        <span className={`font-bold w-8 text-right ${u.riskScore >= 70 ? "text-rose-600" : u.riskScore >= 40 ? "text-amber-600" : "text-emerald-600"}`}>{u.riskScore}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Prompt to Users tab for action */}
          {report.breachingUsers > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">{report.breachingUsers} user{report.breachingUsers !== 1 ? "s" : ""}</span> in breach of policy. Notify or remediate from the Users tab.
              </p>
              <button
                onClick={() => { setTab("users"); setUserFilter("BREACH"); }}
                className="text-xs font-semibold text-amber-700 border border-amber-300 bg-white hover:bg-amber-50 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors"
              >
                View Users →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Apps ── */}
      {tab === "apps" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex gap-1 flex-wrap">
              {(["all", "BREACH", "CONDITIONAL", "COMPLIANT"] as const).map((f) => {
                const count = f === "all" ? appRows.length : appRows.filter((r) => r.worstStatus === f).length;
                return (
                  <button
                    key={f}
                    onClick={() => setAppFilter(f)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      appFilter === f ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f === "all" ? "All" : STATUS_CONFIG[f].label}
                    <span className="ml-1 opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Search tool or vendor…"
              value={appSearch}
              onChange={(e) => setAppSearch(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-52"
            />
            <span className="text-xs text-slate-400 ml-auto">{filteredApps.length} apps</span>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 font-medium">
                  <th className="px-4 py-2.5 text-left w-28">Status</th>
                  <th className="px-4 py-2.5 text-left">Tool</th>
                  <th className="px-4 py-2.5 text-left hidden sm:table-cell">Vendor</th>
                  <th className="px-4 py-2.5 text-center w-24">In Breach</th>
                  <th className="px-4 py-2.5 text-center w-24 hidden md:table-cell">Conditional</th>
                  <th className="px-4 py-2.5 text-center w-24 hidden md:table-cell">Approved</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApps.map((app) => {
                  const cfg        = STATUS_CONFIG[app.worstStatus];
                  const isExpanded = expandedApp === app.tool;
                  return (
                    <>
                      <tr
                        key={app.tool}
                        onClick={() => setExpandedApp(isExpanded ? null : app.tool)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${cfg.row}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{app.tool}</div>
                          {app.reason && <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">{app.reason}</div>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-600">{app.vendor}</td>
                        <td className="px-4 py-3 text-center">
                          {app.breachCount > 0
                            ? <span className="text-xs font-semibold text-rose-600">{app.breachCount} user{app.breachCount !== 1 ? "s" : ""}</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {app.conditionalCount > 0
                            ? <span className="text-xs font-semibold text-amber-600">{app.conditionalCount}</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center hidden md:table-cell">
                          {app.approvedCount > 0
                            ? <span className="text-xs font-semibold text-emerald-600">{app.approvedCount}</span>
                            : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        <td className="pr-3 text-slate-400">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${app.tool}-detail`} className="bg-slate-50">
                          <td colSpan={7} className="px-6 py-4">
                            <AppDetail app={app} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filteredApps.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">No apps match the current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Tab: Users ── */}
      {tab === "users" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 flex-wrap">
              {(["all", "BREACH", "CONDITIONAL", "COMPLIANT", "UNKNOWN"] as const).map((f) => {
                const count = f === "all" ? report.userRecords.length : report.userRecords.filter((u) => u.complianceStatus === f).length;
                return (
                  <button
                    key={f}
                    onClick={() => { setUserFilter(f); setUserPage(0); }}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      userFilter === f ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {f === "all" ? "All" : STATUS_CONFIG[f].label}
                    <span className="ml-1 opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="Search user, tool, department…"
              value={userSearch}
              onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
              className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-52"
            />
            <button
              onClick={() => setNotifyConfigOpen((o) => !o)}
              className="ml-auto text-xs border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              ✉ Notification settings {notifyConfigOpen ? "▲" : "▼"}
            </button>
          </div>

          {notifyConfigOpen && (
            <NotifyConfigPanel config={notifyConfig} onChange={setNotifyConfig} />
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 font-medium">
                  <th className="px-4 py-2.5 text-left w-28">Status</th>
                  <th className="px-4 py-2.5 text-left">User</th>
                  <th className="px-4 py-2.5 text-left hidden sm:table-cell">Department</th>
                  <th className="px-4 py-2.5 text-center w-20">Risk</th>
                  <th className="px-4 py-2.5 text-left hidden md:table-cell">Breaching Tools</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedUsers.map((u) => {
                  const cfg        = STATUS_CONFIG[u.complianceStatus];
                  const isExpanded = expandedUser === u.userId;
                  return (
                    <>
                      <tr
                        key={u.userId}
                        onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${cfg.row}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{u.displayName ?? u.email}</div>
                          {u.displayName && <div className="text-xs text-slate-400">{u.email}</div>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs text-slate-600">{u.department ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-bold ${u.riskScore >= 70 ? "text-rose-600" : u.riskScore >= 40 ? "text-amber-600" : "text-emerald-600"}`}>
                            {u.riskScore}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {u.breachingTools.slice(0, 4).map((t, i) => (
                              <span key={i} className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded">{t.tool}</span>
                            ))}
                            {u.breachingTools.length > 4 && <span className="text-xs text-slate-400">+{u.breachingTools.length - 4} more</span>}
                          </div>
                        </td>
                        <td className="pr-3 text-slate-400">
                          <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${u.userId}-detail`} className="bg-slate-50">
                          <td colSpan={6} className="px-6 py-4">
                            <UserDetail
                              user={u}
                              idpUsers={idpUsers}
                              provider={provider}
                              credentials={credentials}
                              notifyConfig={notifyConfig}
                            />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">No users match the current filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {userPageCount > 1 && (
            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Showing {userPage * PAGE_SIZE + 1}–{Math.min((userPage + 1) * PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}</span>
              <div className="flex gap-1">
                <button disabled={userPage === 0} onClick={() => setUserPage((p) => p - 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">← Prev</button>
                <button disabled={userPage >= userPageCount - 1} onClick={() => setUserPage((p) => p + 1)} className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 transition-colors">Next →</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppDetail({ app }: { app: AppRow }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
      {app.reason && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">Policy Reason</p>
          <p className="text-slate-700">{app.reason}</p>
        </div>
      )}
      {app.recommendation && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">Recommendation</p>
          <p className="text-slate-700">{app.recommendation}</p>
        </div>
      )}
      {app.systemsAccessed.length > 0 && (
        <div>
          <p className="font-semibold text-slate-600 mb-1">Systems Accessed</p>
          <div className="flex flex-wrap gap-1">
            {app.systemsAccessed.map((s, i) => (
              <span key={i} className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserDetail({ user, idpUsers, provider, credentials, notifyConfig }: {
  user: UserComplianceRecord;
  idpUsers: UserActivity[];
  provider?: IdPProvider;
  credentials?: Record<string, string>;
  notifyConfig: NotifyConfig;
}) {
  const [revokeStates, setRevokeStates] = useState<Record<string, RevokeState>>({});
  const [revokeErrors, setRevokeErrors] = useState<Record<string, string>>({});
  const [notifySending, setNotifySending] = useState(false);
  const [notifyResult, setNotifyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const canRevoke = !!provider && !!credentials && provider !== "manual";

  // Look up raw IdP user to get clientId / idpItemId for revocation
  const idpUser = idpUsers.find((u) => u.userId === user.userId || u.email === user.email);

  function setRevoke(key: string, state: RevokeState) {
    setRevokeStates((p) => ({ ...p, [key]: state }));
  }

  async function doRevoke(toolName: string) {
    if (!canRevoke || !idpUser) return;
    const detected = idpUser.aiToolsDetected.find((t) => t.tool.toLowerCase() === toolName.toLowerCase());
    if (!detected?.clientId) return;
    const key = `${user.userId}::${detected.clientId}`;
    setRevoke(key, "revoking");
    try {
      const res = await fetch("/api/idp/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, credentials, userEmail: user.email, clientId: detected.clientId, idpItemId: detected.idpItemId, toolName }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (data.success) {
        setRevoke(key, "revoked");
      } else {
        setRevokeErrors((p) => ({ ...p, [key]: data.error ?? "Unknown error" }));
        setRevoke(key, "error");
      }
    } catch (e) {
      setRevokeErrors((p) => ({ ...p, [key]: e instanceof Error ? e.message : String(e) }));
      setRevoke(key, "error");
    }
  }

  async function doNotify() {
    setNotifySending(true);
    setNotifyResult(null);
    try {
      const tools = [
        ...user.breachingTools.map((t) => ({ tool: t.tool, vendor: t.vendor, riskLevel: "HIGH", riskScore: user.riskScore })),
        ...user.conditionalTools.map((t) => ({ tool: t.tool, vendor: t.vendor, riskLevel: "MEDIUM", riskScore: 50 })),
      ];
      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: notifyConfig.channel,
          config: {
            webhookUrl: notifyConfig.webhookUrl,
            teamsWebhookUrl: notifyConfig.teamsWebhookUrl,
            smtpHost: notifyConfig.smtpHost,
            smtpPort: notifyConfig.smtpPort ? parseInt(notifyConfig.smtpPort) : undefined,
            smtpUser: notifyConfig.smtpUser,
            smtpPass: notifyConfig.smtpPass,
            fromEmail: notifyConfig.fromEmail,
            fromName: notifyConfig.fromName,
            orgName: notifyConfig.orgName,
            adminContact: notifyConfig.adminContact,
          },
          notifications: [{ userEmail: user.email, displayName: user.displayName, tools }],
        }),
      });
      const data = await res.json() as { sent?: number; error?: string };
      setNotifyResult(res.ok && !data.error ? { ok: true, msg: "Notification sent." } : { ok: false, msg: data.error ?? "Send failed." });
    } catch (e) {
      setNotifyResult({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setNotifySending(false);
    }
  }

  function RevokeCell({ toolName }: { toolName: string }) {
    if (!canRevoke || !idpUser) return null;
    const detected = idpUser.aiToolsDetected.find((t) => t.tool.toLowerCase() === toolName.toLowerCase());
    if (!detected?.clientId) return <span className="text-slate-300 text-xs">—</span>;
    const key    = `${user.userId}::${detected.clientId}`;
    const rState = revokeStates[key] ?? "idle";
    return rState === "idle" ? (
      <button onClick={() => setRevoke(key, "confirming")} className="text-xs text-rose-600 hover:text-rose-700 font-medium px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-50 transition-colors">Revoke</button>
    ) : rState === "confirming" ? (
      <span className="inline-flex gap-1">
        <button onClick={() => setRevoke(key, "idle")} className="text-xs text-slate-500 px-2 py-0.5 rounded border border-slate-200 hover:bg-slate-100 transition-colors">Cancel</button>
        <button onClick={() => void doRevoke(toolName)} className="text-xs text-white bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded transition-colors font-medium">Confirm</button>
      </span>
    ) : rState === "revoking" ? (
      <span className="text-slate-400 text-xs flex items-center gap-1"><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Revoking…</span>
    ) : rState === "revoked" ? (
      <span className="text-emerald-600 text-xs font-medium">✓ Revoked</span>
    ) : (
      <span className="text-rose-600 text-xs" title={revokeErrors[key]}>Failed</span>
    );
  }

  return (
    <div className="space-y-4">

      {/* Breaching tools */}
      {user.breachingTools.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-rose-700 mb-2">Policy Breaches</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-200">
                <th className="pb-1.5 text-left font-medium">Tool</th>
                <th className="pb-1.5 text-left font-medium hidden sm:table-cell">Reason</th>
                <th className="pb-1.5 text-left font-medium hidden md:table-cell">Recommendation</th>
                {canRevoke && <th className="pb-1.5 text-right font-medium">Access</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-rose-100">
              {user.breachingTools.map((t, i) => (
                <tr key={i} className="bg-rose-50/30">
                  <td className="py-2 font-semibold text-slate-800">{t.tool}<span className="ml-1 text-slate-400 font-normal">{t.vendor}</span></td>
                  <td className="py-2 text-rose-700 hidden sm:table-cell">{t.reason}</td>
                  <td className="py-2 text-slate-600 hidden md:table-cell">{t.recommendation}</td>
                  {canRevoke && <td className="py-2 text-right"><RevokeCell toolName={t.tool} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Conditional tools */}
      {user.conditionalTools.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700 mb-2">Conditional Tools (review required)</p>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-amber-100">
              {user.conditionalTools.map((t, i) => (
                <tr key={i} className="bg-amber-50/30">
                  <td className="py-2 font-semibold text-slate-800 w-40">{t.tool}</td>
                  <td className="py-2 text-amber-700">{t.reason}</td>
                  {canRevoke && <td className="py-2 text-right"><RevokeCell toolName={t.tool} /></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Approved tools */}
      {user.approvedTools.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-emerald-700 mb-1">Approved Tools In Use</p>
          <div className="flex flex-wrap gap-1">
            {user.approvedTools.map((t, i) => (
              <span key={i} className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">{t.tool}</span>
            ))}
          </div>
        </div>
      )}

      {/* Needs manual review */}
      {user.needsReview && user.needsReview.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-violet-700 mb-1">Needs Manual Review</p>
          <div className="space-y-1">
            {user.needsReview.map((t, i) => (
              <div key={i} className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                <span className="text-xs font-semibold text-slate-800">{t.tool}</span>
                <span className="text-xs text-violet-700 ml-2">{t.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notify action */}
      <div className="flex items-center gap-3 pt-1 border-t border-slate-200">
        <button
          onClick={() => void doNotify()}
          disabled={notifySending}
          className="text-xs font-medium border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {notifySending
            ? <><svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Sending…</>
            : `Notify ${user.displayName ?? user.email} via ${notifyConfig.channel}`}
        </button>
        {notifyResult && (
          <span className={`text-xs ${notifyResult.ok ? "text-emerald-600" : "text-rose-600"}`}>{notifyResult.msg}</span>
        )}
        {!notifyResult && <span className="text-xs text-slate-400">Configure notification channel using the settings above.</span>}
      </div>
    </div>
  );
}

function NotifyConfigPanel({ config, onChange }: { config: NotifyConfig; onChange: (c: NotifyConfig) => void }) {
  function set(patch: Partial<NotifyConfig>) { onChange({ ...config, ...patch }); }
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
      <p className="font-semibold text-slate-700 text-sm">Notification Channel</p>
      <div className="flex gap-2">
        {(["email", "slack", "teams"] as NotifyCh[]).map((ch) => (
          <button key={ch} onClick={() => set({ channel: ch })} className={`px-3 py-1.5 rounded-lg border transition-colors capitalize ${config.channel === ch ? "bg-brand-600 text-white border-brand-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}>
            {ch === "email" ? "✉ Email" : ch === "slack" ? "💬 Slack" : "🟦 Teams"}
          </button>
        ))}
      </div>
      {config.channel === "email" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="SMTP Host"    value={config.smtpHost ?? ""}    onChange={(v) => set({ smtpHost: v })}    placeholder="smtp.example.com" />
          <Field label="SMTP Port"    value={config.smtpPort ?? "587"} onChange={(v) => set({ smtpPort: v })}    placeholder="587" />
          <Field label="SMTP User"    value={config.smtpUser ?? ""}    onChange={(v) => set({ smtpUser: v })}    placeholder="user@example.com" />
          <Field label="SMTP Pass"    value={config.smtpPass ?? ""}    onChange={(v) => set({ smtpPass: v })}    placeholder="••••••••" type="password" />
          <Field label="From Email"   value={config.fromEmail ?? ""}   onChange={(v) => set({ fromEmail: v })}   placeholder="security@example.com" />
          <Field label="From Name"    value={config.fromName ?? ""}    onChange={(v) => set({ fromName: v })}    placeholder="IT Security" />
          <Field label="Org Name"     value={config.orgName ?? ""}     onChange={(v) => set({ orgName: v })}     placeholder="Acme Corp" />
          <Field label="Admin Contact" value={config.adminContact ?? ""} onChange={(v) => set({ adminContact: v })} placeholder="it@example.com" />
        </div>
      )}
      {config.channel === "slack" && (
        <Field label="Slack Webhook URL" value={config.webhookUrl ?? ""} onChange={(v) => set({ webhookUrl: v })} placeholder="https://hooks.slack.com/services/…" />
      )}
      {config.channel === "teams" && (
        <Field label="Teams Webhook URL" value={config.teamsWebhookUrl ?? ""} onChange={(v) => set({ teamsWebhookUrl: v })} placeholder="https://…webhook.office.com/…" />
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-0.5">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white placeholder-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );
}

function StepCheck({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
      ) : (
        <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
      )}
      <span className={`text-xs ${done ? "text-slate-700 font-medium" : "text-slate-400"}`}>{label}</span>
    </div>
  );
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
