"use client";
import type { AlertRule, AlertTrigger, ChannelType } from "@/lib/types";

const TRIGGER_LABELS: Record<AlertTrigger, string> = {
  NEW_FAILING_CONTROL: "New Failing Control",
  NEW_OVERDUE_TASK: "New Overdue Task",
  CRITICAL_RISK_OPENED: "Critical Risk Opened",
  HIGH_RISK_OPENED: "High Risk Opened",
  FAILING_TEST: "Failing Test",
  CONTROL_NEEDS_OWNER: "Control Needs Owner",
  DAILY_DIGEST: "Daily Digest",
};

const CHANNEL_ICON: Record<ChannelType, string> = {
  SLACK: "💬",
  EMAIL: "📧",
  JIRA: "🎫",
  WEBHOOK: "🔗",
};

export default function RuleList({
  rules,
  loading,
  onToggle,
  onDelete,
  onRunRule,
}: {
  rules: AlertRule[];
  loading: boolean;
  onToggle: (id: string, enabled: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRunRule: (id: string) => Promise<void>;
}) {
  if (loading) return <div className="py-12 text-center text-sm text-slate-400">Loading rules…</div>;

  if (!rules.length) {
    return (
      <div className="py-16 text-center">
        <div className="text-4xl mb-3">🔔</div>
        <p className="text-slate-600 font-medium">No alert rules yet</p>
        <p className="text-sm text-slate-400 mt-1">Click &ldquo;+ New Rule&rdquo; to create your first alert</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <div
          key={rule.id}
          className={`border rounded-xl p-4 transition-colors ${
            rule.enabled ? "border-slate-100 hover:border-slate-200" : "border-slate-100 bg-slate-50 opacity-60"
          }`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-800">{rule.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  rule.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
                }`}>
                  {rule.enabled ? "Active" : "Paused"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-2">{rule.workspaceName}</p>

              {/* Triggers */}
              <div className="flex flex-wrap gap-1 mb-2">
                {rule.triggers.map((t) => (
                  <span key={t} className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">
                    {TRIGGER_LABELS[t]}
                  </span>
                ))}
              </div>

              {/* Channels */}
              <div className="flex flex-wrap gap-2">
                {rule.channels.map((ch, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    {CHANNEL_ICON[ch.type]} {ch.type}
                    {ch.type === "SLACK" && ch.channel ? ` ${ch.channel}` : ""}
                    {ch.type === "JIRA" ? ` ${ch.projectKey}` : ""}
                    {ch.type === "EMAIL" ? ` ${ch.to[0]}${ch.to.length > 1 ? `+${ch.to.length - 1}` : ""}` : ""}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {rule.lastCheckedAt && (
                <span className="text-xs text-slate-400 hidden md:block">
                  Last: {new Date(rule.lastCheckedAt).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => { void onRunRule(rule.id); }}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                ▶ Run
              </button>
              <button
                onClick={() => { void onToggle(rule.id, !rule.enabled); }}
                className="text-xs text-slate-500 hover:text-slate-700 font-medium bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                {rule.enabled ? "Pause" : "Enable"}
              </button>
              <button
                onClick={() => { void onDelete(rule.id); }}
                className="text-xs text-rose-500 hover:text-rose-700 font-medium bg-rose-50 hover:bg-rose-100 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
