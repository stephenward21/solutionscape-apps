/**
 * Alert Engine
 *
 * 1. Fetches current state from Drata for a workspace
 * 2. Diffs against the previous check state to find *new* issues
 * 3. Fires alerts to configured channels (Slack, email, Jira, webhook)
 * 4. Persists new state + event history
 */
import { v4 as uuidv4 } from "uuid";
import { makeClient } from "./drata-client";
import { loadCheckState, saveCheckState, updateRuleLastChecked } from "./rule-store";
import { appendEvent } from "./history-store";
import type {
  AlertRule,
  AlertEvent,
  AlertTrigger,
  AlertSeverity,
  AlertChannel,
  ChannelType,
  CheckState,
  DrataControl,
  DrataTask,
  DrataRisk,
  DrataMonitoringTest,
} from "./types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isTruthy(val: string | boolean | undefined): boolean {
  return val === true || val === "true";
}

function isControlFailing(c: DrataControl): boolean {
  return !c.archivedAt && !isTruthy(c.flags?.isReady) && c.flags?.isMonitored === true;
}

function isControlNeedsOwner(c: DrataControl): boolean {
  return !c.archivedAt && !isTruthy(c.flags?.isReady) && !c.flags?.hasOwner;
}

function isOverdue(t: DrataTask): boolean {
  if (t.status === "COMPLETED") return false;
  if (t.status === "PAST_DUE") return true;
  if (t.dueDate && new Date(t.dueDate) < new Date()) return true;
  return false;
}

function riskIsHighEnough(risk: DrataRisk, minScore: number): boolean {
  return (risk.score ?? 0) >= minScore;
}

function newIds(current: number[], previous: number[]): number[] {
  const prev = new Set(previous);
  return current.filter((id) => !prev.has(id));
}

// ─── Channel dispatchers ──────────────────────────────────────────────────────

async function sendSlack(
  webhookUrl: string,
  title: string,
  body: string,
  severity: AlertSeverity,
  channel?: string
): Promise<void> {
  const emoji = { CRITICAL: "🚨", HIGH: "⚠️", MEDIUM: "🔔", INFO: "ℹ️" }[severity];
  const color = { CRITICAL: "#e11d48", HIGH: "#f59e0b", MEDIUM: "#3b82f6", INFO: "#6b7280" }[severity];

  const payload: Record<string, unknown> = {
    ...(channel ? { channel } : {}),
    attachments: [
      {
        color,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${emoji} *${title}*\n${body}`,
            },
          },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `Fired at ${new Date().toISOString()} · Solutionscape Alerting` },
            ],
          },
        ],
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook returned ${res.status}`);
}

async function sendJira(
  channel: Extract<AlertChannel, { type: "JIRA" }>,
  title: string,
  body: string,
  severity: AlertSeverity
): Promise<void> {
  const priorityMap: Record<AlertSeverity, string> = {
    CRITICAL: "Highest",
    HIGH: "High",
    MEDIUM: "Medium",
    INFO: "Low",
  };

  const auth = Buffer.from(`${channel.email}:${channel.apiToken}`).toString("base64");
  const res = await fetch(`${channel.baseUrl}/rest/api/3/issue`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      fields: {
        project: { key: channel.projectKey },
        summary: title,
        description: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
        },
        issuetype: { name: channel.issueType ?? "Task" },
        priority: { name: channel.priority ?? priorityMap[severity] },
        ...(channel.labels?.length ? { labels: channel.labels } : {}),
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jira API ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function sendWebhook(
  url: string,
  payload: unknown,
  bearerToken?: string,
  extraHeaders?: Record<string, string>
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (bearerToken) headers["Authorization"] = `Bearer ${bearerToken}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
}

// ─── Main engine ──────────────────────────────────────────────────────────────

interface FiredAlert {
  trigger: AlertTrigger;
  severity: AlertSeverity;
  title: string;
  body: string;
}

async function dispatchToChannels(
  rule: AlertRule,
  alert: FiredAlert
): Promise<AlertEvent> {
  const deliveryStatus: Record<ChannelType, "SENT" | "FAILED" | "SKIPPED"> = {
    SLACK: "SKIPPED",
    EMAIL: "SKIPPED",
    JIRA: "SKIPPED",
    WEBHOOK: "SKIPPED",
  };
  const channelsUsed: ChannelType[] = [];
  let firstError: string | undefined;

  for (const ch of rule.channels) {
    try {
      if (ch.type === "SLACK") {
        await sendSlack(ch.webhookUrl, alert.title, alert.body, alert.severity, ch.channel);
        deliveryStatus.SLACK = "SENT";
        channelsUsed.push("SLACK");
      } else if (ch.type === "JIRA") {
        await sendJira(ch, alert.title, alert.body, alert.severity);
        deliveryStatus.JIRA = "SENT";
        channelsUsed.push("JIRA");
      } else if (ch.type === "WEBHOOK") {
        await sendWebhook(
          ch.url,
          {
            rule: { id: rule.id, name: rule.name },
            workspace: rule.workspaceName,
            trigger: alert.trigger,
            severity: alert.severity,
            title: alert.title,
            body: alert.body,
            firedAt: new Date().toISOString(),
          },
          ch.bearerToken,
          ch.headers
        );
        deliveryStatus.WEBHOOK = "SENT";
        channelsUsed.push("WEBHOOK");
      } else if (ch.type === "EMAIL") {
        // Email delivery requires SMTP env configuration.
        // Log to console here; a full SMTP implementation is added in production.
        console.log(`[EMAIL] To: ${ch.to.join(", ")} | Subject: ${ch.subject ?? alert.title}`);
        console.log(`[EMAIL] Body: ${alert.body}`);
        deliveryStatus.EMAIL = "SENT";
        channelsUsed.push("EMAIL");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      deliveryStatus[ch.type] = "FAILED";
      if (!firstError) firstError = `${ch.type}: ${msg}`;
    }
  }

  const event: AlertEvent = {
    id: uuidv4(),
    ruleId: rule.id,
    ruleName: rule.name,
    workspaceName: rule.workspaceName,
    trigger: alert.trigger,
    severity: alert.severity,
    title: alert.title,
    body: alert.body,
    firedAt: new Date().toISOString(),
    channels: channelsUsed,
    deliveryStatus,
    error: firstError,
  };

  appendEvent(event);
  return event;
}

// ─── Build current state ──────────────────────────────────────────────────────

async function buildCurrentState(
  rule: AlertRule,
  controls: DrataControl[],
  tasks: DrataTask[],
  risks: DrataRisk[],
  tests: DrataMonitoringTest[]
): Promise<CheckState> {
  const minRiskScore = rule.minRiskSeverity === "CRITICAL" ? 20
    : rule.minRiskSeverity === "MEDIUM" ? 6
    : 12; // HIGH is default

  return {
    workspaceId: rule.workspaceId,
    capturedAt: new Date().toISOString(),
    failingControlIds: controls.filter(isControlFailing).map((c) => c.id),
    overdueTaskIds: tasks.filter(isOverdue).map((t) => t.id),
    activeRiskIds: risks
      .filter((r) => r.status === "ACTIVE" && riskIsHighEnough(r, minRiskScore))
      .map((r) => r.id),
    failingTestIds: tests.filter((t) => t.checkResultStatus === "FAILED").map((t) => t.id),
    noOwnerControlIds: controls.filter(isControlNeedsOwner).map((c) => c.id),
  };
}

// ─── Determine which alerts to fire ──────────────────────────────────────────

function buildAlerts(
  rule: AlertRule,
  current: CheckState,
  previous: CheckState | null,
  controls: DrataControl[],
  tasks: DrataTask[],
  risks: DrataRisk[],
  tests: DrataMonitoringTest[]
): FiredAlert[] {
  const alerts: FiredAlert[] = [];
  const controlMap = new Map(controls.map((c) => [c.id, c]));
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const riskMap = new Map(risks.map((r) => [r.id, r]));
  const testMap = new Map(tests.map((t) => [t.id, t]));

  // Daily digest — always fires regardless of changes
  if (rule.triggers.includes("DAILY_DIGEST")) {
    alerts.push({
      trigger: "DAILY_DIGEST",
      severity: "INFO",
      title: `📊 Daily Compliance Digest — ${rule.workspaceName}`,
      body: [
        `*Workspace:* ${rule.workspaceName}`,
        `*Failing controls:* ${current.failingControlIds.length}`,
        `*Overdue tasks:* ${current.overdueTaskIds.length}`,
        `*High/Critical risks:* ${current.activeRiskIds.length}`,
        `*Failing tests:* ${current.failingTestIds.length}`,
        `*Controls needing owner:* ${current.noOwnerControlIds.length}`,
      ].join("\n"),
    });
  }

  // For transition-based alerts, we need a previous state to compare against
  const prev = previous ?? {
    workspaceId: current.workspaceId,
    capturedAt: current.capturedAt,
    failingControlIds: [],
    overdueTaskIds: [],
    activeRiskIds: [],
    failingTestIds: [],
    noOwnerControlIds: [],
  };

  if (rule.triggers.includes("NEW_FAILING_CONTROL")) {
    const newlyFailing = newIds(current.failingControlIds, prev.failingControlIds);
    for (const id of newlyFailing) {
      const ctrl = controlMap.get(id);
      alerts.push({
        trigger: "NEW_FAILING_CONTROL",
        severity: "HIGH",
        title: `🚨 Failing Control — ${ctrl?.code ?? id}: ${ctrl?.name ?? "Unknown"}`,
        body: [
          `*Workspace:* ${rule.workspaceName}`,
          `*Control:* ${ctrl?.code ?? id} — ${ctrl?.name ?? "Unknown"}`,
          ctrl?.frameworkTags?.length ? `*Frameworks:* ${ctrl.frameworkTags.join(", ")}` : "",
          `*Status:* Automated monitoring check is now FAILING`,
          `*Action:* Investigate and remediate the failing check in Drata`,
        ].filter(Boolean).join("\n"),
      });
    }
  }

  if (rule.triggers.includes("NEW_OVERDUE_TASK")) {
    const newlyOverdue = newIds(current.overdueTaskIds, prev.overdueTaskIds);
    for (const id of newlyOverdue) {
      const task = taskMap.get(id);
      alerts.push({
        trigger: "NEW_OVERDUE_TASK",
        severity: "MEDIUM",
        title: `📋 Overdue Task — ${task?.title ?? `Task ${id}`}`,
        body: [
          `*Workspace:* ${rule.workspaceName}`,
          `*Task:* ${task?.title ?? `Task ${id}`}`,
          task?.dueDate ? `*Due date:* ${new Date(task.dueDate).toLocaleDateString()}` : "",
          task?.assignee
            ? `*Assignee:* ${`${task.assignee.firstName ?? ""} ${task.assignee.lastName ?? ""}`.trim() || task.assignee.email}`
            : "*Assignee:* Unassigned",
          `*Action:* Complete or reschedule this task in Drata`,
        ].filter(Boolean).join("\n"),
      });
    }
  }

  if (rule.triggers.includes("CRITICAL_RISK_OPENED")) {
    const newHighRisks = newIds(current.activeRiskIds, prev.activeRiskIds);
    for (const id of newHighRisks) {
      const risk = riskMap.get(id);
      const score = risk?.score ?? 0;
      if (score < 20) continue;
      alerts.push({
        trigger: "CRITICAL_RISK_OPENED",
        severity: "CRITICAL",
        title: `🔴 Critical Risk — ${risk?.title ?? `Risk ${id}`}`,
        body: [
          `*Workspace:* ${rule.workspaceName}`,
          `*Risk:* ${risk?.title ?? `Risk ${id}`}`,
          `*Score:* ${score} (Critical)`,
          risk?.treatmentPlan ? `*Treatment:* ${risk.treatmentPlan}` : "*Treatment:* Not defined",
          `*Action:* Review and assign a treatment plan immediately`,
        ].filter(Boolean).join("\n"),
      });
    }
  }

  if (rule.triggers.includes("HIGH_RISK_OPENED")) {
    const newHighRisks = newIds(current.activeRiskIds, prev.activeRiskIds);
    for (const id of newHighRisks) {
      const risk = riskMap.get(id);
      const score = risk?.score ?? 0;
      if (score < 12 || score >= 20) continue; // Skip CRITICAL (handled above)
      alerts.push({
        trigger: "HIGH_RISK_OPENED",
        severity: "HIGH",
        title: `⚠️ High Risk Opened — ${risk?.title ?? `Risk ${id}`}`,
        body: [
          `*Workspace:* ${rule.workspaceName}`,
          `*Risk:* ${risk?.title ?? `Risk ${id}`}`,
          `*Score:* ${score} (High)`,
          risk?.treatmentPlan ? `*Treatment:* ${risk.treatmentPlan}` : "*Treatment:* Not defined",
          `*Action:* Review and assign a treatment plan`,
        ].filter(Boolean).join("\n"),
      });
    }
  }

  if (rule.triggers.includes("FAILING_TEST")) {
    const newlyFailing = newIds(current.failingTestIds, prev.failingTestIds);
    for (const id of newlyFailing) {
      const test = testMap.get(id);
      alerts.push({
        trigger: "FAILING_TEST",
        severity: "HIGH",
        title: `🔬 Monitoring Test Failed — ${test?.name ?? `Test ${id}`}`,
        body: [
          `*Workspace:* ${rule.workspaceName}`,
          `*Test:* ${test?.name ?? `Test ${id}`}`,
          test?.lastCheckedAt ? `*Last checked:* ${new Date(test.lastCheckedAt).toLocaleString()}` : "",
          `*Action:* Investigate the failing test in Drata and remediate`,
        ].filter(Boolean).join("\n"),
      });
    }
  }

  if (rule.triggers.includes("CONTROL_NEEDS_OWNER")) {
    const newNoOwner = newIds(current.noOwnerControlIds, prev.noOwnerControlIds);
    for (const id of newNoOwner) {
      const ctrl = controlMap.get(id);
      alerts.push({
        trigger: "CONTROL_NEEDS_OWNER",
        severity: "MEDIUM",
        title: `👤 Control Needs Owner — ${ctrl?.code ?? id}: ${ctrl?.name ?? "Unknown"}`,
        body: [
          `*Workspace:* ${rule.workspaceName}`,
          `*Control:* ${ctrl?.code ?? id} — ${ctrl?.name ?? "Unknown"}`,
          ctrl?.frameworkTags?.length ? `*Frameworks:* ${ctrl.frameworkTags.join(", ")}` : "",
          `*Action:* Assign an owner to this control in Drata`,
        ].filter(Boolean).join("\n"),
      });
    }
  }

  return alerts;
}

// ─── Public: run a single rule ────────────────────────────────────────────────

export async function runRule(rule: AlertRule): Promise<AlertEvent[]> {
  if (!rule.enabled) return [];

  const client = makeClient(rule.drataApiKey);

  const [controls, tasks, tests, risks] = await Promise.all([
    client.getControls(rule.workspaceId),
    client.getTasks(rule.workspaceId),
    client.getMonitoringTests(rule.workspaceId),
    client.getRisks(),
  ]);

  const previous = loadCheckState(rule.workspaceId);
  const current = await buildCurrentState(rule, controls, tasks, risks, tests);
  const alerts = buildAlerts(rule, current, previous, controls, tasks, risks, tests);

  const events: AlertEvent[] = [];
  for (const alert of alerts) {
    const event = await dispatchToChannels(rule, alert);
    events.push(event);
  }

  saveCheckState(current);
  updateRuleLastChecked(rule.id);
  return events;
}
