/**
 * POST /api/revoke
 * Revokes an AI tool's access for a specific user via their connected IdP.
 *
 * Provider-specific behaviour:
 *   google    — DELETE /admin/directory/v1/users/{userKey}/tokens/{clientId}
 *               Requires admin.directory.user.security scope on the service account.
 *   microsoft — DELETE /users/{userId}/appRoleAssignments/{idpItemId}
 *               Removes the specific enterprise app assignment for that user.
 *               Falls back to POST /users/{userId}/revokeSignInSessions if idpItemId is missing.
 *   okta      — DELETE /api/v1/apps/{clientId}/users/{userId}
 *               Removes the user from the Okta application.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RevokeBody {
  provider: "google" | "microsoft" | "okta";
  credentials: Record<string, string>;
  userId: string;
  userEmail: string;
  toolName: string;
  clientId: string;
  idpItemId?: string; // Microsoft: app role assignment ID
}

export async function POST(req: Request): Promise<NextResponse> {
  let body: RevokeBody;
  try {
    body = await req.json() as RevokeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, credentials, userId, userEmail, toolName, clientId, idpItemId } = body;

  if (!provider || !credentials || !userId || !clientId) {
    return NextResponse.json({ error: "provider, credentials, userId, and clientId are all required" }, { status: 400 });
  }

  try {
    if (provider === "google") {
      await revokeGoogle(credentials, userId, clientId);
    } else if (provider === "microsoft") {
      await revokeMicrosoft(credentials, userId, idpItemId);
    } else if (provider === "okta") {
      await revokeOkta(credentials, clientId, userId);
    } else {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `Revoked access to ${toolName} for ${userEmail}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Google Workspace ─────────────────────────────────────────────────────────

async function revokeGoogle(
  creds: Record<string, string>,
  userEmail: string,
  clientId: string,
): Promise<void> {
  if (!creds.serviceAccountJson?.trim()) throw new Error("Service account JSON is required");
  if (!creds.adminEmail?.trim()) throw new Error("Admin email is required");

  let keyJson: Record<string, string>;
  try {
    keyJson = JSON.parse(creds.serviceAccountJson) as Record<string, string>;
  } catch {
    throw new Error("Service account JSON is not valid JSON");
  }

  const { google } = await import("googleapis");

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.user.security",
    ],
    subject: creds.adminEmail,
  });

  const directory = google.admin({ version: "directory_v1", auth });

  try {
    await directory.tokens.delete({ userKey: userEmail, clientId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Resource Not Found") || msg.includes("404")) {
      throw new Error(`No active OAuth grant found for this app (${clientId}) on user ${userEmail}. The token may have already been revoked.`);
    }
    if (msg.includes("unauthorized_client")) {
      throw new Error(
        "Permission denied. Ensure the service account has the 'admin.directory.user.security' scope granted in the Google Workspace Admin Console under domain-wide delegation."
      );
    }
    throw new Error(`Google token revocation failed: ${msg}`);
  }
}

// ─── Microsoft Entra ID ───────────────────────────────────────────────────────

async function revokeMicrosoft(
  creds: Record<string, string>,
  userId: string,
  idpItemId?: string,
): Promise<void> {
  if (!creds.tenantId?.trim() || !creds.clientId?.trim() || !creds.clientSecret?.trim()) {
    throw new Error("Tenant ID, Client ID, and Client Secret are all required");
  }

  // Get access token
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    }
  );

  if (!tokenRes.ok) {
    const err = await tokenRes.json() as { error_description?: string };
    throw new Error(`Microsoft authentication failed: ${err.error_description ?? tokenRes.statusText}`);
  }

  const { access_token } = await tokenRes.json() as { access_token: string };
  const headers = { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" };

  if (idpItemId) {
    // Targeted: remove the specific app role assignment
    const deleteRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/appRoleAssignments/${idpItemId}`,
      { method: "DELETE", headers }
    );
    if (!deleteRes.ok && deleteRes.status !== 404) {
      const body = await deleteRes.text();
      throw new Error(`Failed to remove app role assignment: ${body}`);
    }
  } else {
    // Fallback: revoke all sign-in sessions (forces re-auth on all apps)
    const revokeRes = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}/revokeSignInSessions`,
      { method: "POST", headers }
    );
    if (!revokeRes.ok) {
      const body = await revokeRes.text();
      throw new Error(`Failed to revoke sign-in sessions: ${body}`);
    }
  }
}

// ─── Okta ─────────────────────────────────────────────────────────────────────

async function revokeOkta(
  creds: Record<string, string>,
  appId: string,
  oktaUserId: string,
): Promise<void> {
  if (!creds.domain?.trim() || !creds.apiToken?.trim()) {
    throw new Error("Okta domain and API token are required");
  }

  const domain = creds.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const headers = { Authorization: `SSWS ${creds.apiToken}`, Accept: "application/json" };

  const res = await fetch(`https://${domain}/api/v1/apps/${appId}/users/${oktaUserId}`, {
    method: "DELETE",
    headers,
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`User not found in this Okta application. They may have already been removed.`);
    }
    const body = await res.text();
    throw new Error(`Okta revocation failed (${res.status}): ${body}`);
  }
}
