/**
 * GET /api/idp?provider=google|microsoft|okta|manual
 *
 * Placeholder route for IdP integration. Each provider will be implemented
 * as the relevant API credentials and OAuth flows are configured.
 *
 * Google Workspace: Admin SDK Reports API (oauth2 tokens, audit logs)
 * Microsoft Entra:  Microsoft Graph API (servicePrincipal signIns, appRoleAssignments)
 * Okta:            Okta System Log API + Application Users API
 */
import { NextResponse } from "next/server";
import type { UserActivity } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");

  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  // TODO: implement per-provider fetching using credentials from request body/session
  // For now return a structured placeholder so the UI flow works end-to-end
  const placeholder: UserActivity[] = [
    {
      userId: "placeholder-001",
      email: "example@yourdomain.com",
      displayName: "Example User",
      department: "Engineering",
      aiToolsDetected: [
        {
          tool: "ChatGPT",
          vendor: "OpenAI",
          firstSeenAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastSeenAt: new Date().toISOString(),
          signInCount: 47,
          oauthScopes: ["openid", "email", "profile"],
          systemsAccessed: ["Google Drive", "Gmail"],
          detectionMethod: "oauth",
        },
      ],
      lastActivityAt: new Date().toISOString(),
    },
  ];

  return NextResponse.json({
    provider,
    users: placeholder,
    note: `${provider} integration — full implementation requires API credentials configured server-side`,
  });
}
