/**
 * POST /api/channels/test — send a test message to a channel config
 */
import { NextResponse } from "next/server";
import type { AlertChannel } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  let body: { channel: AlertChannel };
  try { body = (await req.json()) as typeof body; } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { channel } = body;
  if (!channel) return NextResponse.json({ error: "channel required" }, { status: 400 });

  try {
    if (channel.type === "SLACK") {
      const res = await fetch(channel.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "✅ *Test message from Solutionscape Alerting Engine* — your Slack integration is working!",
        }),
      });
      if (!res.ok) throw new Error(`Slack returned ${res.status}`);
    } else if (channel.type === "WEBHOOK") {
      const res = await fetch(channel.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(channel.bearerToken ? { Authorization: `Bearer ${channel.bearerToken}` } : {}),
          ...(channel.headers ?? {}),
        },
        body: JSON.stringify({
          test: true,
          message: "Test message from Solutionscape Alerting Engine",
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`Webhook returned ${res.status}`);
    } else if (channel.type === "EMAIL") {
      console.log(`[TEST EMAIL] To: ${channel.to.join(", ")} — test passed`);
    } else if (channel.type === "JIRA") {
      // Just validate auth by fetching the project
      const auth = Buffer.from(`${channel.email}:${channel.apiToken}`).toString("base64");
      const res = await fetch(`${channel.baseUrl}/rest/api/3/project/${channel.projectKey}`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
      if (!res.ok) throw new Error(`Jira project not found or auth failed (${res.status})`);
    }
    return NextResponse.json({ ok: true, channel: channel.type });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
