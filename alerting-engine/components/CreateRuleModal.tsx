"use client";

import { useState } from "react";
import type { AlertTrigger, ChannelType, AlertChannel } from "@/lib/types";

const ALL_TRIGGERS: { id: AlertTrigger; label: string; description: string }[] = [
  { id: "NEW_FAILING_CONTROL", label: "New Failing Control", description: "A control transitions from passing → failing" },
  { id: "NEW_OVERDUE_TASK", label: "New Overdue Task", description: "A task becomes past its due date" },
  { id: "CRITICAL_RISK_OPENED", label: "Critical Risk", description: "An active risk with score ≥ 20 is detected" },
  { id: "HIGH_RISK_OPENED", label: "High Risk", description: "An active risk with score 12–19 is detected" },
  { id: "FAILING_TEST", label: "Failing Monitoring Test", description: "An automated test flips to FAILED" },
  { id: "CONTROL_NEEDS_OWNER", label: "Control Without Owner", description: "A control has no assigned owner" },
  { id: "DAILY_DIGEST", label: "Daily Digest", description: "Summary of current compliance state, sent daily" },
];

type ChannelDraft =
  | { type: "SLACK"; webhookUrl: string; channel: string }
  | { type: "EMAIL"; to: string }
  | { type: "JIRA"; baseUrl: string; projectKey: string; email: string; apiToken: string }
  | { type: "WEBHOOK"; url: string; bearerToken: string };

export default function CreateRuleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"triggers" | "channels" | "confirm">("triggers");
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [selectedTriggers, setSelectedTriggers] = useState<Set<AlertTrigger>>(new Set(["NEW_FAILING_CONTROL", "NEW_OVERDUE_TASK"]));
  const [channels, setChannels] = useState<ChannelDraft[]>([]);
  const [channelType, setChannelType] = useState<ChannelType>("SLACK");
  const [channelDraft, setChannelDraft] = useState<ChannelDraft>({ type: "SLACK", webhookUrl: "", channel: "" });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTrigger(t: AlertTrigger) {
    setSelectedTriggers((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }

  function switchChannelType(type: ChannelType) {
    setChannelType(type);
    setChannelDraft(
      type === "SLACK" ? { type: "SLACK", webhookUrl: "", channel: "" }
      : type === "EMAIL" ? { type: "EMAIL", to: "" }
      : type === "JIRA" ? { type: "JIRA", baseUrl: "", projectKey: "", email: "", apiToken: "" }
      : { type: "WEBHOOK", url: "", bearerToken: "" }
    );
    setTestResult(null);
  }

  function addChannel() {
    // Basic validation
    if (channelDraft.type === "SLACK" && !channelDraft.webhookUrl) { setError("Webhook URL required"); return; }
    if (channelDraft.type === "EMAIL" && !channelDraft.to) { setError("Email address required"); return; }
    if (channelDraft.type === "JIRA" && (!channelDraft.baseUrl || !channelDraft.projectKey || !channelDraft.email || !channelDraft.apiToken)) { setError("All Jira fields required"); return; }
    if (channelDraft.type === "WEBHOOK" && !channelDraft.url) { setError("Webhook URL required"); return; }
    setError(null);
    setChannels((prev) => [...prev, channelDraft]);
    switchChannelType(channelType); // Reset draft
  }

  async function testChannel() {
    setTesting(true);
    setTestResult(null);
    try {
      const ch: AlertChannel =
        channelDraft.type === "SLACK" ? { type: "SLACK", webhookUrl: channelDraft.webhookUrl, channel: channelDraft.channel || undefined }
        : channelDraft.type === "EMAIL" ? { type: "EMAIL", to: channelDraft.to.split(",").map((s) => s.trim()) }
        : channelDraft.type === "JIRA" ? { type: "JIRA", baseUrl: channelDraft.baseUrl, projectKey: channelDraft.projectKey, email: channelDraft.email, apiToken: channelDraft.apiToken }
        : { type: "WEBHOOK", url: (channelDraft as { type: "WEBHOOK"; url: string; bearerToken: string }).url, bearerToken: (channelDraft as { type: "WEBHOOK"; url: string; bearerToken: string }).bearerToken || undefined };

      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: ch }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      setTestResult(d.ok ? "✅ Test message sent successfully!" : `❌ ${d.error}`);
    } catch (err) {
      setTestResult(`❌ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTesting(false);
    }
  }

  async function saveRule() {
    if (!name) { setError("Rule name required"); return; }
    if (!apiKey) { setError("Drata API key required"); return; }
    if (!selectedTriggers.size) { setError("Select at least one trigger"); return; }
    if (!channels.length) { setError("Add at least one channel"); return; }
    setSaving(true);
    setError(null);
    try {
      const mappedChannels: AlertChannel[] = channels.map((ch) =>
        ch.type === "SLACK" ? { type: "SLACK", webhookUrl: ch.webhookUrl, channel: ch.channel || undefined }
        : ch.type === "EMAIL" ? { type: "EMAIL", to: ch.to.split(",").map((s) => s.trim()) }
        : ch.type === "JIRA" ? { type: "JIRA", baseUrl: ch.baseUrl, projectKey: ch.projectKey, email: ch.email, apiToken: ch.apiToken }
        : { type: "WEBHOOK", url: (ch as { type: "WEBHOOK"; url: string; bearerToken: string }).url, bearerToken: (ch as { type: "WEBHOOK"; url: string; bearerToken: string }).bearerToken || undefined }
      );

      const res = await fetch("/api/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          drataApiKey: apiKey,
          workspaceName: workspaceName || undefined,
          enabled: true,
          triggers: Array.from(selectedTriggers),
          channels: mappedChannels,
        }),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(d.error ?? "Failed to save rule");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-800">Create Alert Rule</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Name + API Key */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rule Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp Alerts"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Drata API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="drata_..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
            </div>
          </div>

          {/* Triggers */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Triggers</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ALL_TRIGGERS.map((t) => (
                <label key={t.id} className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                  selectedTriggers.has(t.id) ? "border-brand-300 bg-brand-50" : "border-slate-200 hover:border-slate-300"
                }`}>
                  <input type="checkbox" checked={selectedTriggers.has(t.id)} onChange={() => toggleTrigger(t.id)} className="mt-0.5 accent-brand-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t.label}</p>
                    <p className="text-xs text-slate-400">{t.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Notification Channels</label>

            {channels.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {channels.map((ch, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-3 py-1.5 rounded-full">
                    <span>{ch.type}</span>
                    {ch.type === "SLACK" && ch.channel && <span>{ch.channel}</span>}
                    {ch.type === "JIRA" && <span>{ch.projectKey}</span>}
                    <button onClick={() => setChannels((prev) => prev.filter((_, j) => j !== i))} className="text-emerald-500 hover:text-rose-500">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Channel type selector */}
            <div className="flex gap-2 mb-3">
              {(["SLACK", "EMAIL", "JIRA", "WEBHOOK"] as ChannelType[]).map((t) => (
                <button key={t} onClick={() => switchChannelType(t)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${channelType === t ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Channel-specific fields */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              {channelDraft.type === "SLACK" && (
                <>
                  <input value={channelDraft.webhookUrl} onChange={(e) => setChannelDraft({ ...channelDraft, webhookUrl: e.target.value })}
                    placeholder="Slack Incoming Webhook URL" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input value={channelDraft.channel} onChange={(e) => setChannelDraft({ ...channelDraft, channel: e.target.value })}
                    placeholder="#channel (optional override)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                </>
              )}
              {channelDraft.type === "EMAIL" && (
                <input value={channelDraft.to} onChange={(e) => setChannelDraft({ ...channelDraft, to: e.target.value })}
                  placeholder="recipient@company.com, another@company.com" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
              )}
              {channelDraft.type === "JIRA" && (
                <div className="grid grid-cols-2 gap-2">
                  <input value={channelDraft.baseUrl} onChange={(e) => setChannelDraft({ ...channelDraft, baseUrl: e.target.value })}
                    placeholder="https://company.atlassian.net" className="col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input value={channelDraft.projectKey} onChange={(e) => setChannelDraft({ ...channelDraft, projectKey: e.target.value })}
                    placeholder="Project Key (COMP)" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input value={channelDraft.email} onChange={(e) => setChannelDraft({ ...channelDraft, email: e.target.value })}
                    placeholder="your@email.com" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input type="password" value={channelDraft.apiToken} onChange={(e) => setChannelDraft({ ...channelDraft, apiToken: e.target.value })}
                    placeholder="Jira API Token" className="col-span-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                </div>
              )}
              {channelDraft.type === "WEBHOOK" && (
                <>
                  <input value={(channelDraft as { url: string }).url} onChange={(e) => setChannelDraft({ ...channelDraft, url: e.target.value } as typeof channelDraft)}
                    placeholder="https://your-endpoint.com/webhook" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                  <input type="password" value={(channelDraft as { bearerToken: string }).bearerToken} onChange={(e) => setChannelDraft({ ...channelDraft, bearerToken: e.target.value } as typeof channelDraft)}
                    placeholder="Bearer token (optional)" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                </>
              )}

              <div className="flex items-center gap-2">
                <button onClick={() => { void testChannel(); }} disabled={testing}
                  className="text-xs text-slate-600 hover:text-slate-800 font-medium bg-white border border-slate-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50">
                  {testing ? "Testing…" : "Test Channel"}
                </button>
                <button onClick={addChannel}
                  className="text-xs text-white font-medium bg-brand-600 hover:bg-brand-500 rounded-lg px-3 py-1.5 transition-colors">
                  + Add Channel
                </button>
                {testResult && <span className="text-xs">{testResult}</span>}
              </div>
            </div>
          </div>

          {error && <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">{error}</div>}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-between">
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700 font-medium text-sm px-4 py-2">Cancel</button>
          <button onClick={() => { void saveRule(); }} disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors flex items-center gap-2">
            {saving ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving…</> : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
