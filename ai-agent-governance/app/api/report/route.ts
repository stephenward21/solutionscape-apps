/**
 * POST /api/report
 * Combines the analyzed policy (from session/cache) with user activity from the
 * IdP connection to produce a per-user compliance report via Claude.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type { GovernanceReport, UserComplianceRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(_req: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  // In the full implementation, policy + user activity come from the session/DB.
  // For now this endpoint documents the expected contract.
  return NextResponse.json(
    {
      error:
        "Report generation requires a completed policy analysis and directory connection. " +
        "Please complete both steps in the Policy and Directory tabs first.",
    },
    { status: 400 }
  );
}

/**
 * Core report generation — called once policy and user data are available.
 * Exported so it can be called from a stateful implementation (e.g. with DB session).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function generateGovernanceReport(params: {
  apiKey: string;
  organizationName?: string;
  policyId?: string;
  prohibitedTools: string[];
  conditionalTools: string[];
  approvedTools: string[];
  users: Array<{
    userId: string;
    email: string;
    displayName?: string;
    department?: string;
    aiToolsDetected: Array<{
      tool: string;
      vendor: string;
      oauthScopes?: string[];
      systemsAccessed?: string[];
    }>;
  }>;
}): Promise<GovernanceReport> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const prompt = `You are an AI governance expert. Cross-reference the following AI policy rules
against each user's detected AI tool usage and produce a compliance assessment.

POLICY RULES:
- Approved tools: ${params.approvedTools.join(", ") || "none specified"}
- Prohibited tools: ${params.prohibitedTools.join(", ") || "none specified"}
- Conditional tools (require review): ${params.conditionalTools.join(", ") || "none specified"}

USERS AND THEIR DETECTED AI TOOLS:
${params.users.map((u) =>
  `User: ${u.email} (${u.displayName ?? ""}${u.department ? `, ${u.department}` : ""})
  Tools: ${u.aiToolsDetected.map((t) => `${t.tool} by ${t.vendor} [scopes: ${(t.oauthScopes ?? []).join(", ")}] [systems: ${(t.systemsAccessed ?? []).join(", ")}]`).join("; ")}`)
  .join("\n")}

For each user, determine:
1. complianceStatus: COMPLIANT | BREACH | CONDITIONAL | UNKNOWN
2. Which tools are breaching policy and why
3. What systems those tools can access (from the scopes/systems data)
4. A risk score 0-100 (100 = highest risk)
5. Specific remediation recommendation per breach

Return ONLY valid JSON:
{
  "aiNarrative": "<2-3 sentence executive summary of overall compliance posture>",
  "prohibitedToolsInUse": ["<tool names actively being used in breach>"],
  "userRecords": [
    {
      "userId": "<userId>",
      "email": "<email>",
      "displayName": "<name>",
      "department": "<dept>",
      "complianceStatus": "COMPLIANT" | "BREACH" | "CONDITIONAL" | "UNKNOWN",
      "riskScore": <0-100>,
      "breachingTools": [
        {
          "tool": "<name>",
          "vendor": "<vendor>",
          "policyStatus": "PROHIBITED",
          "reason": "<why this is a breach>",
          "systemsAccessed": ["<system>"],
          "recommendation": "<specific action to take>"
        }
      ],
      "conditionalTools": [],
      "approvedTools": []
    }
  ]
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const message = await (client.messages.create as (p: any) => Promise<Anthropic.Message>)({
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const parsed = JSON.parse(raw) as {
    aiNarrative: string;
    prohibitedToolsInUse: string[];
    userRecords: UserComplianceRecord[];
  };

  const records = parsed.userRecords ?? [];

  return {
    id: uuidv4(),
    generatedAt: new Date().toISOString(),
    organizationName: params.organizationName,
    policyId: params.policyId,
    totalUsers: records.length,
    compliantUsers:   records.filter((u) => u.complianceStatus === "COMPLIANT").length,
    breachingUsers:   records.filter((u) => u.complianceStatus === "BREACH").length,
    conditionalUsers: records.filter((u) => u.complianceStatus === "CONDITIONAL").length,
    unknownUsers:     records.filter((u) => u.complianceStatus === "UNKNOWN").length,
    totalAIToolsDetected: records.reduce((s, u) => s + u.breachingTools.length + u.approvedTools.length + u.conditionalTools.length, 0),
    prohibitedToolsInUse: parsed.prohibitedToolsInUse ?? [],
    topRiskUsers: [...records].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    aiNarrative: parsed.aiNarrative ?? "",
    userRecords: records,
  };
}
