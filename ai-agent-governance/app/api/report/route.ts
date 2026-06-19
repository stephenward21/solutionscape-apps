/**
 * POST /api/report
 * Accepts policy analysis result + IdP user activity, cross-references them
 * via Claude, and returns a GovernanceReport.
 *
 * Body: { policyResult: PolicyAnalysisResult | null, users: UserActivity[] }
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type { GovernanceReport, PolicyAnalysisResult, UserActivity, UserComplianceRecord } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body: { policyResult?: PolicyAnalysisResult | null; users?: UserActivity[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { policyResult, users = [] } = body;

  if (!policyResult && users.length === 0) {
    return NextResponse.json(
      { error: "Provide a policy result, a list of users, or both. Complete the Policy and Directory tabs first." },
      { status: 400 }
    );
  }

  try {
    const report = await generateGovernanceReport({
      apiKey,
      organizationName: policyResult?.organizationName,
      policyId: policyResult?.id,
      prohibitedTools: (policyResult?.prohibitedTools ?? []).map((t) => t.tool),
      conditionalTools: (policyResult?.conditionalTools ?? []).map((t) => t.tool),
      approvedTools:    (policyResult?.approvedTools ?? []).map((t) => t.tool),
      policyToolDetails: [
        ...(policyResult?.prohibitedTools  ?? []).map((t) => ({ ...t, status: "PROHIBITED"  as const })),
        ...(policyResult?.conditionalTools ?? []).map((t) => ({ ...t, status: "CONDITIONAL" as const })),
        ...(policyResult?.approvedTools    ?? []).map((t) => ({ ...t, status: "APPROVED"    as const })),
      ],
      users,
    });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function generateGovernanceReport(params: {
  apiKey: string;
  organizationName?: string;
  policyId?: string;
  prohibitedTools: string[];
  conditionalTools: string[];
  approvedTools: string[];
  policyToolDetails: Array<{ tool: string; vendor: string; status: string; conditions?: string; reasoning: string }>;
  users: UserActivity[];
}): Promise<GovernanceReport> {
  const client = new Anthropic({ apiKey: params.apiKey });

  const hasPolicyRules = params.prohibitedTools.length + params.conditionalTools.length + params.approvedTools.length > 0;
  const hasUsers = params.users.length > 0;

  const prompt = `You are an AI governance expert. Cross-reference the following AI policy rules
against each user's detected AI tool usage and produce a per-user compliance assessment.

${hasPolicyRules ? `
POLICY RULES:
- Approved tools: ${params.approvedTools.join(", ") || "none specified"}
- Prohibited tools: ${params.prohibitedTools.join(", ") || "none specified"}
- Conditional tools (require review): ${params.conditionalTools.join(", ") || "none specified"}

Detailed policy entries:
${params.policyToolDetails.map((t) => `  ${t.status}: ${t.tool} (${t.vendor})${t.conditions ? ` — Condition: ${t.conditions}` : ""} — ${t.reasoning}`).join("\n")}
` : "NOTE: No policy rules provided. Classify all detected tools as UNKNOWN status — the organization has no policy to compare against."}

${hasUsers ? `
USERS AND THEIR DETECTED AI TOOLS:
${params.users.map((u) =>
  `- ${u.email} (${u.displayName ?? ""}${u.department ? `, ${u.department}` : ""}):
    ${u.aiToolsDetected.length === 0 ? "No AI tools detected" : u.aiToolsDetected.map((t) =>
      `${t.tool} by ${t.vendor}` +
      (t.oauthScopes?.length ? ` [scopes: ${t.oauthScopes.slice(0, 5).join(", ")}]` : "") +
      (t.systemsAccessed?.length ? ` [systems: ${t.systemsAccessed.join(", ")}]` : "") +
      (t.signInCount ? ` [${t.signInCount} sign-ins]` : "")
    ).join("; ")}`
).join("\n")}
` : "NOTE: No user directory data provided. Generate an executive summary based on the policy analysis only."}

For each user, determine:
1. complianceStatus: COMPLIANT (only approved tools in use, or no tools detected) | BREACH (using prohibited tools) | CONDITIONAL (using conditional tools without issues, or approved + conditional mix) | UNKNOWN (no policy or unrecognized tools)
2. Which specific tools are breaching policy and exactly why
3. What systems those tools can access (from the scopes/systems data)
4. Risk score 0–100: 0 = no risk (compliant), 30–50 = minor (only conditional tools), 60–80 = significant (1–2 prohibited tools with limited access), 80–100 = critical (prohibited tools with broad system access like Gmail, Drive, Calendar)
5. Specific, actionable remediation recommendation per breach

Also identify which prohibited tools are being actively used across the org.

Return ONLY valid JSON (no markdown fences):
{
  "aiNarrative": "<2-3 sentence executive summary of overall compliance posture, citing specific numbers>",
  "prohibitedToolsInUse": ["<tool names actively used in breach>"],
  "userRecords": [
    {
      "userId": "<userId>",
      "email": "<email>",
      "displayName": "<name or null>",
      "department": "<dept or null>",
      "complianceStatus": "COMPLIANT",
      "riskScore": 0,
      "breachingTools": [],
      "conditionalTools": [],
      "approvedTools": [{ "tool": "...", "vendor": "...", "detectionMethod": "oauth" }]
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

  let parsed: { aiNarrative: string; prohibitedToolsInUse: string[]; userRecords: UserComplianceRecord[] };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error(`Claude returned invalid JSON. Response preview: ${raw.slice(0, 200)}`);
  }

  const records = parsed.userRecords ?? [];

  return {
    id: uuidv4(),
    generatedAt: new Date().toISOString(),
    organizationName: params.organizationName,
    policyId: params.policyId,
    totalUsers:       records.length,
    compliantUsers:   records.filter((u) => u.complianceStatus === "COMPLIANT").length,
    breachingUsers:   records.filter((u) => u.complianceStatus === "BREACH").length,
    conditionalUsers: records.filter((u) => u.complianceStatus === "CONDITIONAL").length,
    unknownUsers:     records.filter((u) => u.complianceStatus === "UNKNOWN").length,
    totalAIToolsDetected: records.reduce(
      (s, u) => s + u.breachingTools.length + u.approvedTools.length + u.conditionalTools.length,
      0
    ),
    prohibitedToolsInUse: parsed.prohibitedToolsInUse ?? [],
    topRiskUsers: [...records].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    aiNarrative: parsed.aiNarrative ?? "",
    userRecords: records,
  };
}
