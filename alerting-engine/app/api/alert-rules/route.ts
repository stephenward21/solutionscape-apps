import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { listRules, saveRule, deleteRule, loadRule } from "@/lib/rule-store";
import { makeClient } from "@/lib/drata-client";
import type { AlertRule } from "@/lib/types";

export const dynamic = "force-dynamic";

/** GET /api/alert-rules — list all rules */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ rules: listRules() });
}

/** POST /api/alert-rules — create a new rule */
export async function POST(req: Request): Promise<NextResponse> {
  let body: Omit<AlertRule, "id" | "createdAt" | "lastCheckedAt">;
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.drataApiKey) return NextResponse.json({ error: "drataApiKey required" }, { status: 400 });
  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (!body.triggers?.length) return NextResponse.json({ error: "at least one trigger required" }, { status: 400 });
  if (!body.channels?.length) return NextResponse.json({ error: "at least one channel required" }, { status: 400 });

  // Resolve workspace if not provided
  let workspaceId = body.workspaceId;
  let workspaceName = body.workspaceName;
  if (!workspaceId) {
    try {
      const client = makeClient(body.drataApiKey);
      const workspaces = await client.listWorkspaces();
      const first = workspaces[0];
      if (!first) return NextResponse.json({ error: "No workspaces found" }, { status: 400 });
      workspaceId = first.id;
      workspaceName = first.name;
    } catch (err) {
      return NextResponse.json({ error: `Workspace resolution failed: ${String(err)}` }, { status: 500 });
    }
  }

  const rule: AlertRule = {
    ...body,
    id: uuidv4(),
    workspaceId,
    workspaceName: workspaceName ?? "Unknown",
    createdAt: new Date().toISOString(),
    enabled: body.enabled ?? true,
  };

  saveRule(rule);
  return NextResponse.json(rule, { status: 201 });
}

/** DELETE /api/alert-rules?id=xxx */
export async function DELETE(req: Request): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const rule = loadRule(id);
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  deleteRule(id);
  return NextResponse.json({ deleted: true });
}

/** PATCH /api/alert-rules?id=xxx — toggle enabled */
export async function PATCH(req: Request): Promise<NextResponse> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const rule = loadRule(id);
  if (!rule) return NextResponse.json({ error: "Rule not found" }, { status: 404 });
  const body = (await req.json()) as Partial<AlertRule>;
  const updated = { ...rule, ...body };
  saveRule(updated);
  return NextResponse.json(updated);
}
