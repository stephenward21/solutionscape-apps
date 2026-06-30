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
    const client = new Anthropic({ apiKey });

    // Collect unique unrecognized app names for web lookup
    const unrecognizedNames = new Set<string>();
    for (const user of users) {
      for (const tool of user.aiToolsDetected) {
        if (tool.recognized === false) unrecognizedNames.add(tool.tool);
      }
    }

    // Web-search classification is best-effort: if it fails for any reason
    // (API error, timeout, parse failure) the report still generates — it just
    // won't have web-lookup verdicts for unrecognized apps.
    let webClassifications = new Map<string, WebClassification>();
    if (unrecognizedNames.size > 0) {
      try {
        webClassifications = await classifyUnrecognizedAppsViaWeb(
          client,
          Array.from(unrecognizedNames)
        );
      } catch {
        // Non-fatal — continue without web verdicts
      }
    }

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
      webClassifications,
    });
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface WebClassification {
  isAITool: boolean | null; // null = uncertain
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidence: string;
}

// Uses Claude Haiku + Anthropic's built-in web_search tool to look up each
// unrecognized app name and determine whether the site description references
// AI. Runs before the main report generation so verdicts can be embedded in
// the governance prompt as ground-truth rather than relying on Claude's guess.
async function classifyUnrecognizedAppsViaWeb(
  client: Anthropic,
  appNames: string[]
): Promise<Map<string, WebClassification>> {
  if (appNames.length === 0) return new Map();

  const prompt = `For each app name below, search the web for the app's homepage or official description and determine whether it is an AI tool (LLM, AI chatbot, AI coding assistant, image/video/audio generation, autonomous AI agent, AI-powered search, AI automation, etc.).

Apps to classify:
${appNames.map((name, i) => `${i + 1}. ${name}`).join("\n")}

For each app, search for "[app name] official website" or "[app name] what is it", then check the homepage description, meta description, or about page. Look for phrases like "AI", "artificial intelligence", "machine learning", "LLM", "generative", "neural", "copilot", "agent", etc.

Return ONLY valid JSON (no markdown):
{
  "classifications": [
    {
      "appName": "<exact name from input list>",
      "isAITool": true,
      "confidence": "HIGH",
      "evidence": "<1-sentence summary of what the website says, e.g. 'Homepage describes it as an autonomous AI agent for task completion'>"
    }
  ]
}

Set isAITool to false if it is clearly a non-AI SaaS tool. Set confidence to LOW and isAITool to null if you genuinely cannot determine.`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = [{ type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool];

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callClaude = (msgs: Anthropic.MessageParam[]) =>
    (client.messages.create as (p: any) => Promise<Anthropic.Message>)({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      tools,
      messages: msgs,
    });

  let response = await callClaude(messages);
  let iterations = 0;

  // web_search is a server-side tool: stop_reason is "pause_turn", not "tool_use".
  // Loop by appending the assistant content and re-calling until end_turn.
  while (response.stop_reason === "pause_turn" && iterations < 8) {
    iterations++;
    messages = [
      ...messages,
      { role: "assistant", content: response.content },
    ];
    response = await callClaude(messages);
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return new Map();

  try {
    const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(raw) as {
      classifications: Array<{
        appName: string;
        isAITool: boolean | null;
        confidence: "HIGH" | "MEDIUM" | "LOW";
        evidence: string;
      }>;
    };
    const map = new Map<string, WebClassification>();
    for (const c of parsed.classifications ?? []) {
      map.set(c.appName, {
        isAITool: c.isAITool,
        confidence: c.confidence ?? "MEDIUM",
        evidence: c.evidence ?? "",
      });
    }
    return map;
  } catch {
    return new Map();
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
  webClassifications: Map<string, WebClassification>;
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

${params.webClassifications.size > 0 ? `
WEB LOOKUP RESULTS FOR UNRECOGNIZED APPS:
The following apps were not in our known-AI-tool signature list. Their websites were searched to determine whether they reference AI. Use these verdicts — do NOT guess or override them:
${Array.from(params.webClassifications.entries()).map(([name, c]) =>
  `- "${name}": ${c.isAITool ? "IS an AI tool" : c.isAITool === false ? "is NOT an AI tool" : "UNCERTAIN"} (confidence: ${c.confidence}) — ${c.evidence}`
).join("\n")}

Apps classified as NOT AI tools should be excluded entirely from compliance scoring.
Apps classified as AI tools should be treated like known tools and compared against policy rules.
Apps with UNCERTAIN classification should appear in that user's needsReview array.
` : ""}
${hasUsers ? `
USERS AND THEIR DETECTED OAUTH GRANTS:
${params.users.map((u) =>
  `- ${u.email} (${u.displayName ?? ""}${u.department ? `, ${u.department}` : ""}):
    ${u.aiToolsDetected.length === 0 ? "No OAuth grants detected" : u.aiToolsDetected.map((t) => {
      const webResult = t.recognized === false ? params.webClassifications.get(t.tool) : undefined;
      const label = webResult
        ? (webResult.isAITool ? " [WEB-CONFIRMED AI TOOL]" : webResult.isAITool === false ? " [WEB-CONFIRMED NON-AI — exclude]" : " [WEB-UNCERTAIN — flag for review]")
        : (t.recognized === false ? " [UNRECOGNIZED — no web result]" : "");
      return `${t.tool} by ${t.vendor}${label}` +
        (t.oauthScopes?.length ? ` [scopes: ${t.oauthScopes.slice(0, 5).join(", ")}]` : "") +
        (t.systemsAccessed?.length ? ` [systems: ${t.systemsAccessed.join(", ")}]` : "") +
        (t.signInCount ? ` [${t.signInCount} sign-ins]` : "");
    }).join("; ")}`
).join("\n")}
` : "NOTE: No user directory data provided. Generate an executive summary based on the policy analysis only."}

For each user, determine:
1. complianceStatus: COMPLIANT (only approved tools in use, or no AI tools detected) | BREACH (using prohibited tools) | CONDITIONAL (using conditional tools without issues, or approved + conditional mix) | UNKNOWN (no policy, or detected AI tools that aren't covered by any policy rule)
2. Which specific tools are breaching policy and exactly why
3. What systems those tools can access (from the scopes/systems data)
4. Risk score 0–100: 0 = no risk (compliant), 30–50 = minor (only conditional tools), 60–80 = significant (1–2 prohibited tools with limited access), 80–100 = critical (prohibited tools with broad system access like Gmail, Drive, Calendar)
5. Specific, actionable remediation recommendation per breach
6. needsReview: any UNRECOGNIZED app you could not confidently classify as AI or non-AI — name it and say why a human should check it

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
      "approvedTools": [{ "tool": "...", "vendor": "...", "detectionMethod": "oauth" }],
      "needsReview": [{ "tool": "<unrecognized app name>", "reason": "<why you couldn't classify it confidently>" }]
    }
  ]
}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const callClaude = (p: any) =>
    (client.messages.create as (p: any) => Promise<Anthropic.Message>)(p);

  const baseCallParams = {
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  };

  let message: Anthropic.Message;
  try {
    message = await callClaude(baseCallParams);
  } catch (firstErr) {
    const isServerError = firstErr instanceof Anthropic.InternalServerError;
    if (!isServerError) throw firstErr;
    message = await callClaude({ ...baseCallParams, thinking: undefined });
  }

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
    toolsNeedingReview: records.reduce((s, u) => s + (u.needsReview?.length ?? 0), 0),
    topRiskUsers: [...records].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5),
    aiNarrative: parsed.aiNarrative ?? "",
    userRecords: records,
  };
}
