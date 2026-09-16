"use client";

import { useState } from "react";
import type { BasicAIReport, UserActivity } from "@/lib/types";

type Channel = "slack" | "teams" | "email";
type RiskFilter = "CRITICAL" | "HIGH" | "MEDIUM" | "ALL";

interface Props {
  report: BasicAIReport;
  idpUsers: UserActivity[];
}

interface SendResult {
  sent: number;
  failed?: Array<{ email: string; error: string }>;
  channel: Channel;
  error?: string;
}

const CHANNEL_TABS: { id: Channel; label: string; icon: string }[] = [
  { id: "email",  label: "Email",  icon: "✉️" },
  { id: "slack",  label: "Slack",  icon: "💬" },
  { id: "teams",  label: "Teams",  icon: "🟦" },
];

export default function NotificationsPanel({ report, idpUsers }: Props) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("email");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("HIGH");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  // Email config
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");

  // Slack / Teams config
  const [slackWebhook, setSlackWebhook] = useState("");
  const [teamsWebhook, setTeamsWebhook] = useState("");

  // Shared config
  const [adminContact, setAdminContact] = useState("");
  const [orgName, setOrgName] = useState("");

  // Build notification targets from report + idpUsers
  const riskLevels = riskFilter === "ALL"
    ? ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
    : riskFilter === "HIGH"
    ? ["CRITICAL", "HIGH"]
    : [riskFilter];

  const riskyTools = report.toolProfiles.filter((p) => riskLevels.includes(p.riskLevel));
  const toolByEmail = new Map<string, typeof riskyTools[0][]>();
  for (const tool of riskyTools) {
    for (const email of tool.userEmails) {
      if (!toolByEmail.has(email)) toolByEmail.set(email, []);
      toolByEmail.get(email)!.push(tool);
    }
  }

  const userMap = new Map(idpUsers.map((u) => [u.email, u]));
  const notifications = Array.from(toolByEmail.entries()).map(([email, tools]) => ({
    userEmail: email,
    displayName: userMap.get(email)?.displayName,
    tools: tools.map((t) => ({
      tool: t.tool,
      vendor: t.vendor,
      riskLevel: t.riskLevel,
      riskScore: t.riskScore,
    })),
  }));

  async function send() {
    if (notifications.length === 0) return;
    setSending(true);
    setResult(null);
    try {
      const config: Record<string, unknown> = { adminContact, orgName };
      if (channel === "email") {
        Object.assign(config, {
          smtpHost, smtpPort: Number(smtpPort), smtpUser, smtpPass, fromEmail, fromName,
        });
      } else if (channel === "slack") {
        config.webhookUrl = slackWebhook;
      } else if (channel === "teams") {
        config.teamsWebhookUrl = teamsWebhook;
      }

      const res = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, config, notifications }),
      });
      const data = await res.json() as SendResult;
      setResult(data);
    } catch (e) {
      setResult({ sent: 0, channel, error: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  }

  const canSend = notifications.length > 0 && (
    (channel === "email" && smtpHost && fromEmail) ||
    (channel === "slack" && slackWebhook) ||
    (channel === "teams" && teamsWebhook)
  );

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className="text-lg">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Notify Users</p>
          <p className="text-xs text-slate-500">
            Send policy alerts to affected users via email, Slack, or Teams
          </p>
        </div>
        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">
          {notifications.length} users
        </span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-slate-100 bg-white p-4 space-y-4">
          {/* Risk filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600 shrink-0">Notify users with:</span>
            <div className="flex gap-1 flex-wrap">
              {(["CRITICAL", "HIGH", "MEDIUM", "ALL"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => { setRiskFilter(lvl); setResult(null); }}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    riskFilter === lvl
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {lvl === "HIGH" ? "Critical + High" : lvl === "ALL" ? "All risks" : lvl.charAt(0) + lvl.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Affected users preview */}
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500">No users match the selected risk filter.</p>
          ) : (
            <div className="bg-slate-50 rounded-lg p-3 max-h-32 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-600 mb-2">
                {notifications.length} user{notifications.length !== 1 ? "s" : ""} will be notified
              </p>
              <div className="space-y-1">
                {notifications.map((n) => (
                  <div key={n.userEmail} className="flex items-center gap-2 text-xs">
                    <span className="text-slate-700 font-medium">{n.displayName ?? n.userEmail}</span>
                    <span className="text-slate-400">{n.userEmail !== n.displayName && n.displayName ? `· ${n.userEmail}` : ""}</span>
                    <div className="ml-auto flex gap-1 flex-wrap justify-end">
                      {n.tools.map((t) => (
                        <span key={t.tool} className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          t.riskLevel === "CRITICAL" ? "bg-rose-100 text-rose-700" :
                          t.riskLevel === "HIGH" ? "bg-orange-100 text-orange-700" :
                          "bg-amber-100 text-amber-700"
                        }`}>
                          {t.tool}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Channel selector */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Notification Channel</p>
            <div className="flex gap-2">
              {CHANNEL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setChannel(tab.id); setResult(null); }}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    channel === tab.id
                      ? "bg-brand-50 border-brand-400 text-brand-700 font-semibold"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shared optional fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Organization name (optional)"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <input
              type="text"
              placeholder="Admin contact email (optional)"
              value={adminContact}
              onChange={(e) => setAdminContact(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {/* Channel-specific config */}
          {channel === "email" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Sends an individual email to each affected user. Emails go directly to their work address.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text" placeholder="SMTP host (e.g. smtp.office365.com)"
                  value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)}
                  className="sm:col-span-2 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="number" placeholder="SMTP port (default 587)"
                  value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="text" placeholder="SMTP username (optional)"
                  value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="password" placeholder="SMTP password (optional)"
                  value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="email" placeholder="From email address (required)"
                  value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="text" placeholder="From name (e.g. IT Security Team)"
                  value={fromName} onChange={(e) => setFromName(e.target.value)}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            </div>
          )}

          {channel === "slack" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Posts a summary of all affected users to the Slack channel configured for your incoming webhook.
              </p>
              <input
                type="url"
                placeholder="Slack incoming webhook URL (https://hooks.slack.com/services/...)"
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <p className="text-xs text-slate-400">
                Set up an incoming webhook at <span className="font-mono">api.slack.com/apps</span> and select the channel to post to.
              </p>
            </div>
          )}

          {channel === "teams" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">
                Posts an Adaptive Card to the Teams channel configured for your incoming webhook.
              </p>
              <input
                type="url"
                placeholder="Teams incoming webhook URL (https://...webhook.office.com/...)"
                value={teamsWebhook}
                onChange={(e) => setTeamsWebhook(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <p className="text-xs text-slate-400">
                Add an Incoming Webhook connector in your Teams channel settings.
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`rounded-lg px-4 py-3 text-sm ${result.error ? "bg-rose-50 border border-rose-200 text-rose-700" : "bg-emerald-50 border border-emerald-200 text-emerald-700"}`}>
              {result.error
                ? `Failed: ${result.error}`
                : channel === "email"
                ? `✓ Sent ${result.sent} email${result.sent !== 1 ? "s" : ""}${result.failed?.length ? ` · ${result.failed.length} failed` : ""}`
                : `✓ Notification posted to ${channel === "slack" ? "Slack" : "Teams"} channel`}
              {result.failed && result.failed.length > 0 && (
                <ul className="mt-1 text-xs space-y-0.5">
                  {result.failed.map((f) => (
                    <li key={f.email}>{f.email}: {f.error}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Send button */}
          <button
            onClick={() => { void send(); }}
            disabled={!canSend || sending || notifications.length === 0}
            className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition-colors flex items-center justify-center gap-2"
          >
            {sending ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Sending…
              </>
            ) : (
              `Send ${channel === "email" ? "Emails" : channel === "slack" ? "Slack Alert" : "Teams Alert"} to ${notifications.length} User${notifications.length !== 1 ? "s" : ""}`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
