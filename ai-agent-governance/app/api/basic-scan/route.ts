/**
 * POST /api/basic-scan
 * Accepts IdP user activity, aggregates AI tool usage by tool (not user),
 * researches unrecognized apps via web search, and returns a per-tool
 * AI Discovery report with risk scores — no policy document required.
 *
 * Designed for orgs that haven't established an AI acceptable use policy yet
 * and need to first understand what's already in use.
 */
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import type { UserActivity, BasicAIReport, AIToolProfile, AIRiskLevel } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Risk scoring ─────────────────────────────────────────────────────────────

// Base risk by category (0–60 range, scopes add up to 40 more)
const CATEGORY_BASE_RISK: Record<string, number> = {
  "Autonomous Agent":        60,
  "Browser Automation":      55,
  "Code Generation":         40,
  "LLM Chat":                30,
  "AI Search":               25,
  "Writing Assistant":       20,
  "Meeting Intelligence":    20,
  "Image Generation":        15,
  "Video Generation":        15,
  "Audio Generation":        15,
  "Presentation AI":         10,
  "Automation / Workflow":   25,
};

const SENSITIVE_SCOPE_KEYWORDS = [
  "gmail", "mail", "email",
  "drive", "storage", "files",
  "calendar", "contacts",
  "admin", "directory",
  "spreadsheet", "docs",
];

function scopeRiskBonus(scopes: string[]): number {
  const lower = scopes.map((s) => s.toLowerCase()).join(" ");
  const hits = SENSITIVE_SCOPE_KEYWORDS.filter((k) => lower.includes(k)).length;
  // Each sensitive scope type adds up to 8 points, max +40
  return Math.min(hits * 8, 40);
}

function riskLevel(score: number): AIRiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 30) return "MEDIUM";
  return "LOW";
}

// ─── Tool aggregation ─────────────────────────────────────────────────────────

interface AggregatedTool {
  tool: string;
  vendor: string;
  recognized: boolean;
  userEmails: Set<string>;
  allScopes: Set<string>;
  allSystems: Set<string>;
}

function aggregateTools(users: UserActivity[]): Map<string, AggregatedTool> {
  const map = new Map<string, AggregatedTool>();
  for (const user of users) {
    for (const t of user.aiToolsDetected) {
      if (!map.has(t.tool)) {
        map.set(t.tool, {
          tool: t.tool,
          vendor: t.vendor,
          recognized: t.recognized !== false,
          userEmails: new Set(),
          allScopes: new Set(),
          allSystems: new Set(),
        });
      }
      const agg = map.get(t.tool)!;
      agg.userEmails.add(user.email);
      for (const s of t.oauthScopes ?? []) agg.allScopes.add(s);
      for (const s of t.systemsAccessed ?? []) agg.allSystems.add(s);
    }
  }
  return map;
}

// ─── Claude helpers ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callClaude = (client: Anthropic, params: any) =>
  (client.messages.create as (p: any) => Promise<Anthropic.Message>)(params);

// Research unrecognized tools via web search and return their profiles.
// Uses the pause_turn loop pattern (web_search is a server-side Anthropic tool).
async function researchAndProfileTools(
  client: Anthropic,
  tools: AggregatedTool[]
): Promise<Map<string, { category: string; description: string; capabilities: string[]; webSummary: string }>> {
  if (tools.length === 0) return new Map();

  const toolList = tools
    .map((t) => `- ${t.tool} by ${t.vendor ?? "Unknown"}`)
    .join("\n");

  const prompt = `You are an AI governance analyst. For each app below, search the web to find out what it does and whether it is an AI tool. For each confirmed AI tool, characterize it.

Apps to research:
${toolList}

For each app:
1. Search for its official website and description
2. Determine if it is an AI tool
3. If yes: categorize it and describe its AI capabilities

Return ONLY valid JSON (no markdown):
{
  "tools": [
    {
      "name": "<exact name from input>",
      "isAITool": true,
      "category": "<one of: Autonomous Agent | Browser Automation | Code Generation | LLM Chat | AI Search | Writing Assistant | Meeting Intelligence | Image Generation | Video Generation | Audio Generation | Presentation AI | Automation / Workflow | Other AI>",
      "description": "<1-2 sentence plain-English description of what this tool does>",
      "capabilities": ["<specific AI capability, e.g. 'Generates code from natural language prompts'>"],
      "webSummary": "<1 sentence of what the website/about page says about the product>"
    }
  ]
}

For tools that are NOT AI tools (e.g. Zoom, Slack, Dropbox), still include them with isAITool: false and no other fields required.`;

  const webSearchTool = [
    { type: "web_search_20260209", name: "web_search" } as unknown as Anthropic.Tool,
  ];

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let response = await callClaude(client, {
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    tools: webSearchTool,
    messages,
  });

  let iterations = 0;
  while (response.stop_reason === "pause_turn" && iterations < 8) {
    iterations++;
    messages = [...messages, { role: "assistant", content: response.content }];
    response = await callClaude(client, {
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      tools: webSearchTool,
      messages,
    });
  }

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return new Map();

  try {
    const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(raw) as {
      tools: Array<{
        name: string;
        isAITool: boolean;
        category?: string;
        description?: string;
        capabilities?: string[];
        webSummary?: string;
      }>;
    };

    const result = new Map<string, { category: string; description: string; capabilities: string[]; webSummary: string }>();
    for (const t of parsed.tools ?? []) {
      if (t.isAITool) {
        result.set(t.name, {
          category: t.category ?? "Other AI",
          description: t.description ?? "",
          capabilities: t.capabilities ?? [],
          webSummary: t.webSummary ?? "",
        });
      }
    }
    return result;
  } catch {
    return new Map();
  }
}

// Generate the full report narrative and per-tool risk analysis via Claude.
async function generateReport(
  client: Anthropic,
  aggregated: Map<string, AggregatedTool>,
  profiles: Map<string, { category: string; description: string; capabilities: string[]; webSummary: string }>,
  totalUsers: number
): Promise<BasicAIReport> {
  // Build per-tool context for the prompt
  const toolEntries = Array.from(aggregated.values())
    .filter((t) => profiles.has(t.tool) || t.recognized)
    .map((t) => {
      const profile = profiles.get(t.tool);
      const scopes = Array.from(t.allScopes);
      const systems = Array.from(t.allSystems);
      return {
        tool: t.tool,
        vendor: t.vendor,
        recognized: t.recognized,
        userCount: t.userEmails.size,
        userEmails: Array.from(t.userEmails),
        scopes,
        systems,
        profile,
      };
    });

  if (toolEntries.length === 0) {
    return {
      id: uuidv4(),
      generatedAt: new Date().toISOString(),
      totalUsersScanned: totalUsers,
      totalAIToolsFound: 0,
      criticalTools: 0,
      highRiskTools: 0,
      summary: "No AI tools were detected in the connected directory.",
      recommendations: ["Consider connecting additional identity providers to broaden coverage."],
      toolProfiles: [],
    };
  }

  const toolContext = toolEntries
    .map((t) =>
      `Tool: ${t.tool} (${t.vendor})
Category: ${t.profile?.category ?? "Unknown"}
Description: ${t.profile?.description ?? "Not researched"}
AI Capabilities: ${t.profile?.capabilities?.join(", ") ?? "Unknown"}
Users: ${t.userCount} employee(s)
OAuth Scopes: ${t.scopes.slice(0, 8).join(", ") || "none recorded"}
Systems Accessed: ${t.systems.join(", ") || "none recorded"}`
    )
    .join("\n\n");

  const prompt = `You are an AI governance analyst helping a company understand its AI tool landscape. This company does NOT yet have an AI acceptable use policy — your job is to help them understand what AI tools are in use, what risks they pose, and what they should prioritize.

ORGANIZATION CONTEXT:
- Total employees scanned: ${totalUsers}
- Total AI tools found: ${toolEntries.length}

AI TOOLS IN USE:
${toolContext}

For each tool, assign a risk score (0–100) and risk level (LOW / MEDIUM / HIGH / CRITICAL) based on:
- Tool category: Autonomous Agents and Browser Automation = highest risk (can act independently)
- Code Generation tools = high risk (IP exposure, security)
- LLM Chat tools = medium risk (data leakage risk)
- Creative/productivity tools = lower risk
- OAuth scopes: email/drive/calendar/admin access significantly increases risk
- Number of users: wider adoption = higher organizational risk

Return ONLY valid JSON (no markdown):
{
  "summary": "<3-4 sentence executive narrative — what AI tools are in use, what the overall risk posture looks like, and the most pressing concern>",
  "recommendations": [
    "<specific, actionable recommendation — e.g. 'Establish an AI acceptable use policy that addresses these 5 tool categories'>",
    "<recommendation 2>",
    "<recommendation 3>"
  ],
  "toolProfiles": [
    {
      "tool": "<tool name>",
      "vendor": "<vendor>",
      "category": "<category>",
      "description": "<1-2 sentence description>",
      "aiCapabilities": ["<capability 1>", "<capability 2>"],
      "dataAccess": ["<system or data type>"],
      "userCount": 0,
      "userEmails": ["<email>"],
      "riskScore": 0,
      "riskLevel": "LOW",
      "riskFactors": ["<why this score — be specific, e.g. 'Has admin directory access', 'Can autonomously browse the web'>"]
    }
  ]
}`;

  let message: Anthropic.Message;
  const baseParams = {
    model: "claude-opus-4-7",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  };

  try {
    message = await callClaude(client, baseParams);
  } catch (firstErr) {
    if (!(firstErr instanceof Anthropic.InternalServerError)) throw firstErr;
    message = await callClaude(client, { ...baseParams, thinking: undefined });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("No text response from Claude");

  const raw = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: {
    summary: string;
    recommendations: string[];
    toolProfiles: Omit<AIToolProfile, "recognized">[];
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error(`Claude returned invalid JSON: ${raw.slice(0, 300)}`);
  }

  // Merge Claude's profiles with our aggregated data (ensure userEmails are current)
  const finalProfiles: AIToolProfile[] = (parsed.toolProfiles ?? []).map((p) => {
    const agg = aggregated.get(p.tool);
    return {
      ...p,
      userCount: agg?.userEmails.size ?? p.userCount,
      userEmails: agg ? Array.from(agg.userEmails) : p.userEmails,
      dataAccess: p.dataAccess?.length ? p.dataAccess : Array.from(agg?.allSystems ?? []),
      riskLevel: (p.riskLevel as AIRiskLevel) ?? riskLevel(p.riskScore),
      recognized: agg?.recognized ?? true,
    };
  });

  // Sort: CRITICAL → HIGH → MEDIUM → LOW, then by riskScore desc
  const ORDER: Record<AIRiskLevel, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  finalProfiles.sort((a, b) =>
    ORDER[a.riskLevel] !== ORDER[b.riskLevel]
      ? ORDER[a.riskLevel] - ORDER[b.riskLevel]
      : b.riskScore - a.riskScore
  );

  return {
    id: uuidv4(),
    generatedAt: new Date().toISOString(),
    totalUsersScanned: totalUsers,
    totalAIToolsFound: finalProfiles.length,
    criticalTools: finalProfiles.filter((p) => p.riskLevel === "CRITICAL").length,
    highRiskTools: finalProfiles.filter((p) => p.riskLevel === "HIGH").length,
    summary: parsed.summary ?? "",
    recommendations: parsed.recommendations ?? [],
    toolProfiles: finalProfiles,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }

  let body: { users?: UserActivity[] };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const users = body.users ?? [];
  if (users.length === 0) {
    return NextResponse.json(
      { error: "No user data provided. Connect a directory in the Directory tab first." },
      { status: 400 }
    );
  }

  try {
    const client = new Anthropic({ apiKey });

    // Aggregate all AI tool grants by tool name across all users
    const aggregated = aggregateTools(users);

    // Research any unrecognized tools via web search (best-effort)
    const unrecognizedTools = Array.from(aggregated.values()).filter((t) => !t.recognized);
    const webProfiles = new Map<string, { category: string; description: string; capabilities: string[]; webSummary: string }>();

    if (unrecognizedTools.length > 0) {
      try {
        const researched = await researchAndProfileTools(client, unrecognizedTools);
        for (const [k, v] of researched) webProfiles.set(k, v);
        // Remove tools that web search confirmed are NOT AI
        for (const t of unrecognizedTools) {
          if (!researched.has(t.tool)) aggregated.delete(t.tool);
        }
      } catch {
        // Non-fatal: continue without web profiles for unrecognized tools
      }
    }

    // Merge web profiles into aggregated so Claude has full context
    // (recognized tools already have profile info from the signature list;
    //  unrecognized tools now have web-researched info)
    const mergedProfiles = new Map<string, { category: string; description: string; capabilities: string[]; webSummary: string }>();
    for (const [k, v] of webProfiles) mergedProfiles.set(k, v);

    const report = await generateReport(client, aggregated, mergedProfiles, users.length);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
