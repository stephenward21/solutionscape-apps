/**
 * POST /api/notify
 * Sends notifications about risky AI tool usage.
 *
 * Channels:
 *   "slack"  — posts to an incoming webhook URL (Block Kit)
 *   "teams"  — posts to a Teams incoming webhook (Adaptive Card)
 *   "email"  — sends individual SMTP emails to each user via nodemailer
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface NotificationUser {
  userEmail: string;
  displayName?: string;
  tools: Array<{
    tool: string;
    vendor: string;
    riskLevel: string;
    riskScore: number;
  }>;
}

interface NotifyBody {
  channel: "slack" | "teams" | "email";
  config: {
    // Slack
    webhookUrl?: string;
    // Teams
    teamsWebhookUrl?: string;
    // Email (SMTP)
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPass?: string;
    fromEmail?: string;
    fromName?: string;
    // Optional org context
    adminContact?: string;
    orgName?: string;
  };
  notifications: NotificationUser[];
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: NotifyBody;
  try {
    body = await req.json() as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { channel, config, notifications } = body;

  if (!notifications?.length) {
    return NextResponse.json({ error: "No notifications to send" }, { status: 400 });
  }

  try {
    if (channel === "slack") {
      return await sendSlack(config.webhookUrl!, notifications, config);
    }
    if (channel === "teams") {
      return await sendTeams(config.teamsWebhookUrl!, notifications, config);
    }
    if (channel === "email") {
      return await sendEmail(config, notifications);
    }
    return NextResponse.json({ error: `Unknown channel: ${channel}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────

const RISK_EMOJI: Record<string, string> = {
  CRITICAL: "🔴",
  HIGH:     "🟠",
  MEDIUM:   "🟡",
  LOW:      "🟢",
};

async function sendSlack(
  webhookUrl: string,
  notifications: NotificationUser[],
  config: NotifyBody["config"],
): Promise<NextResponse> {
  if (!webhookUrl?.trim()) {
    return NextResponse.json({ error: "Slack webhook URL is required" }, { status: 400 });
  }

  const orgName = config.orgName ?? "Your organization";
  const critical = notifications.filter((n) => n.tools.some((t) => t.riskLevel === "CRITICAL")).length;
  const high     = notifications.filter((n) => n.tools.some((t) => t.riskLevel === "HIGH")).length;

  const userLines = notifications.map((n) => {
    const toolList = n.tools
      .map((t) => `${RISK_EMOJI[t.riskLevel] ?? "⚠️"} *${t.tool}* (${t.riskLevel}, score ${t.riskScore})`)
      .join("\n    ");
    return `*${n.displayName ?? n.userEmail}* (<${n.userEmail}>)\n    ${toolList}`;
  });

  const payload = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: "⚠️ AI Tool Policy Alert", emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${orgName} AI Governance — Action Required*\n${notifications.length} user${notifications.length !== 1 ? "s" : ""} have unapproved or high-risk AI tools in use.`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Critical Risk:*\n${critical} user${critical !== 1 ? "s" : ""}` },
          { type: "mrkdwn", text: `*High Risk:*\n${high} user${high !== 1 ? "s" : ""}` },
        ],
      },
      { type: "divider" },
      ...userLines.map((line) => ({
        type: "section",
        text: { type: "mrkdwn", text: line },
      })),
      { type: "divider" },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Sent by SolutionScape AI Governance${config.adminContact ? ` · Contact: ${config.adminContact}` : ""}`,
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

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack webhook error (${res.status}): ${text}`);
  }

  return NextResponse.json({ sent: notifications.length, channel: "slack" });
}

// ─── Microsoft Teams ──────────────────────────────────────────────────────────

async function sendTeams(
  webhookUrl: string,
  notifications: NotificationUser[],
  config: NotifyBody["config"],
): Promise<NextResponse> {
  if (!webhookUrl?.trim()) {
    return NextResponse.json({ error: "Teams webhook URL is required" }, { status: 400 });
  }

  const orgName = config.orgName ?? "Your organization";

  const facts = notifications.flatMap((n) =>
    n.tools.map((t) => ({
      name: `${n.displayName ?? n.userEmail}`,
      value: `${t.tool} — ${t.riskLevel} risk (score ${t.riskScore})`,
    }))
  );

  const payload = {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.3",
          body: [
            {
              type: "TextBlock",
              text: "⚠️ AI Tool Policy Alert",
              weight: "Bolder",
              size: "Large",
              color: "Warning",
            },
            {
              type: "TextBlock",
              text: `${orgName} AI Governance — ${notifications.length} user${notifications.length !== 1 ? "s" : ""} require action`,
              wrap: true,
            },
            {
              type: "FactSet",
              facts,
            },
            {
              type: "TextBlock",
              text: `Sent by SolutionScape AI Governance${config.adminContact ? ` · Contact: ${config.adminContact}` : ""}`,
              size: "Small",
              color: "Accent",
              wrap: true,
            },
          ],
        },
      },
    ],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams webhook error (${res.status}): ${text}`);
  }

  return NextResponse.json({ sent: notifications.length, channel: "teams" });
}

// ─── Email (SMTP via nodemailer) ──────────────────────────────────────────────

async function sendEmail(
  config: NotifyBody["config"],
  notifications: NotificationUser[],
): Promise<NextResponse> {
  const { smtpHost, smtpPort = 587, smtpUser, smtpPass, fromEmail, fromName, orgName, adminContact } = config;

  if (!smtpHost?.trim()) throw new Error("SMTP host is required");
  if (!fromEmail?.trim()) throw new Error("From email address is required");

  // Dynamic import so nodemailer is only loaded in server context
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
  });

  const sent: string[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  for (const n of notifications) {
    const toolRows = n.tools
      .map(
        (t) =>
          `<tr style="border-bottom:1px solid #e2e8f0">
            <td style="padding:8px 12px;font-weight:600;color:#1e293b">${t.tool}</td>
            <td style="padding:8px 12px;color:#64748b">${t.vendor}</td>
            <td style="padding:8px 12px">
              <span style="background:${riskBg(t.riskLevel)};color:${riskColor(t.riskLevel)};padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600">
                ${t.riskLevel}
              </span>
            </td>
            <td style="padding:8px 12px;color:#64748b">${t.riskScore}/100</td>
          </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;margin:0;padding:32px 16px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="background:linear-gradient(135deg,#2A8EC5,#2EB598);padding:24px 32px">
      <p style="color:white;font-size:20px;font-weight:700;margin:0">⚠️ Action Required: AI Tool Compliance</p>
      <p style="color:rgba(255,255,255,0.85);font-size:14px;margin:4px 0 0">${orgName ?? "Your organization"} AI Governance</p>
    </div>
    <div style="padding:32px">
      <p style="color:#1e293b;font-size:15px;margin:0 0 16px">Hi ${n.displayName ?? n.userEmail.split("@")[0]},</p>
      <p style="color:#475569;line-height:1.6;margin:0 0 24px">
        Our IT security team has identified AI applications in your account that require attention.
        The following tools have been flagged as either unapproved or high-risk under our AI acceptable use policy.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Tool</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Vendor</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Risk Level</th>
            <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Score</th>
          </tr>
        </thead>
        <tbody>${toolRows}</tbody>
      </table>
      <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:8px;padding:16px;margin-bottom:24px">
        <p style="color:#92400e;font-weight:600;margin:0 0 8px">Action Required</p>
        <ol style="color:#92400e;margin:0;padding-left:20px;line-height:1.8">
          <li>Stop using the listed tools for work purposes immediately</li>
          <li>Remove their authorization from your account settings</li>
          <li>Contact IT if you need an approved alternative or believe this is an error</li>
        </ol>
      </div>
      ${adminContact ? `<p style="color:#64748b;font-size:13px">Questions? Contact IT at <a href="mailto:${adminContact}" style="color:#2A8EC5">${adminContact}</a></p>` : ""}
    </div>
    <div style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0">
      <p style="color:#94a3b8;font-size:12px;margin:0">Sent by SolutionScape AI Governance · This is an automated security notice</p>
    </div>
  </div>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from: fromName ? `"${fromName}" <${fromEmail}>` : fromEmail,
        to: n.userEmail,
        subject: "Action Required: AI Tool Policy Compliance",
        html,
      });
      sent.push(n.userEmail);
    } catch (err) {
      failed.push({ email: n.userEmail, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ sent: sent.length, failed, channel: "email" });
}

function riskBg(level: string): string {
  const map: Record<string, string> = { CRITICAL: "#fee2e2", HIGH: "#ffedd5", MEDIUM: "#fef9c3", LOW: "#dcfce7" };
  return map[level] ?? "#f1f5f9";
}

function riskColor(level: string): string {
  const map: Record<string, string> = { CRITICAL: "#b91c1c", HIGH: "#c2410c", MEDIUM: "#a16207", LOW: "#15803d" };
  return map[level] ?? "#475569";
}
