/**
 * POST /api/generate-link
 *
 * Creates a shareable portal token for a client workspace.
 * Body: { apiKey, workspaceName?, workspaceId?, label, expiresInDays?, showRisks?, showControls? }
 *
 * If workspaceId is not provided but workspaceName is, it resolves the ID via the Drata API.
 */
import { NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { makeClient } from "@/lib/drata-client";
import { savePortal } from "@/lib/portal-store";
import type { PortalConfig } from "@/lib/types";

export const dynamic = "force-dynamic";

interface RequestBody {
  apiKey: string;
  workspaceId?: number;
  workspaceName?: string;
  label: string;
  expiresInDays?: number;
  showRisks?: boolean;
  showControls?: boolean;
}

export async function POST(req: Request): Promise<NextResponse> {
  const adminKey = process.env.ADMIN_API_KEY;
  if (adminKey) {
    const authHeader = req.headers.get("x-admin-key");
    if (authHeader !== adminKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { apiKey, label, expiresInDays, showRisks = true, showControls = true } = body;
  if (!apiKey) return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  if (!label) return NextResponse.json({ error: "label is required" }, { status: 400 });

  let workspaceId = body.workspaceId;
  let workspaceName = body.workspaceName ?? label;

  // If no workspaceId, resolve from Drata
  if (!workspaceId) {
    try {
      const client = makeClient(apiKey);
      const workspaces = await client.listWorkspaces();
      if (!workspaces.length) {
        return NextResponse.json({ error: "No workspaces found for this API key" }, { status: 400 });
      }
      // If workspaceName given, find matching; otherwise take first
      const match = body.workspaceName
        ? workspaces.find((w) =>
            w.name.toLowerCase().includes(body.workspaceName!.toLowerCase())
          )
        : workspaces[0];
      const chosen = match ?? workspaces[0];
      if (!chosen) {
        return NextResponse.json({ error: "Could not resolve workspace" }, { status: 400 });
      }
      workspaceId = chosen.id;
      workspaceName = chosen.name;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Failed to resolve workspace: ${msg}` }, { status: 500 });
    }
  }

  const token = uuidv4();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  const config: PortalConfig = {
    token,
    label,
    workspaceId,
    workspaceName,
    apiKey,
    createdAt: new Date().toISOString(),
    expiresAt,
    showRisks,
    showControls,
  };

  savePortal(config);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3002";
  return NextResponse.json({
    token,
    url: `${baseUrl}/portal/${token}`,
    label,
    workspaceId,
    workspaceName,
    expiresAt: expiresAt ?? "never",
  });
}
