/**
 * POST /api/idp/revoke
 *
 * Revokes a specific user's OAuth access to an AI tool via the IdP.
 * Requires write-level credentials — see IdPSetupDrawer for the additional
 * permissions needed beyond the read-only sync scopes.
 *
 * Body: {
 *   provider:   "google" | "microsoft" | "okta",
 *   credentials: <provider-specific creds>,
 *   userEmail:  string,          // the user whose access to revoke
 *   clientId:   string,          // OAuth client ID (Google) | app ID (Okta) | service principal ID (MS)
 *   idpItemId?: string,          // Microsoft: oauth2PermissionGrant ID for targeted revocation
 *   toolName:   string,          // display only, for the audit log message
 * }
 *
 * Response: { success: true } | { error: string }
 */

import { NextResponse } from "next/server";

export const dynamic    = "force-dynamic";
export const maxDuration = 30;

interface RevokeBody {
  provider:    "google" | "microsoft" | "okta";
  credentials: Record<string, string>;
  userEmail:   string;
  clientId:    string;
  idpItemId?:  string;
  toolName:    string;
}

export async function POST(req: Request) {
  let body: RevokeBody;
  try {
    body = await req.json() as RevokeBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, credentials, userEmail, clientId, idpItemId, toolName } = body;

  if (!provider || !credentials || !userEmail || !clientId) {
    return NextResponse.json({ error: "Missing required fields: provider, credentials, userEmail, clientId" }, { status: 400 });
  }

  try {
    switch (provider) {
      case "google":    await revokeGoogle(credentials, userEmail, clientId); break;
      case "microsoft": await revokeMicrosoft(credentials, userEmail, clientId, idpItemId); break;
      case "okta":      await revokeOkta(credentials, userEmail, clientId); break;
      default:
        return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });
    }

    console.log(`[revoke] ${provider} | user=${userEmail} | tool=${toolName} | clientId=${clientId}`);
    return NextResponse.json({ success: true });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[revoke] ${provider} error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── Google Workspace ─────────────────────────────────────────────────────────
// Uses Admin SDK Directory API: tokens.delete
// Additional scope required: https://www.googleapis.com/auth/admin.directory.user.security

async function revokeGoogle(
  credentials: Record<string, string>,
  userEmail: string,
  clientId: string,
) {
  let keyData: Record<string, string>;
  try {
    keyData = JSON.parse(credentials.serviceAccountJson);
  } catch {
    throw new Error("serviceAccountJson is not valid JSON");
  }

  const adminEmail = credentials.adminEmail;
  if (!adminEmail) throw new Error("adminEmail is required");

  // Build a JWT for the service account, impersonating the admin
  const token = await getGoogleAccessToken(keyData, adminEmail, [
    "https://www.googleapis.com/auth/admin.directory.user.security",
  ]);

  // DELETE /admin/directory/v1/users/{userKey}/tokens/{clientId}
  const url = `https://admin.googleapis.com/admin/directory/v1/users/${encodeURIComponent(userEmail)}/tokens/${encodeURIComponent(clientId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) {
    // Token already gone — treat as success
    return;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google tokens.delete failed (${res.status}): ${body}`);
  }
}

// Minimal JWT → access token flow for a Google service account
async function getGoogleAccessToken(
  keyData: Record<string, string>,
  subject: string,
  scopes: string[],
): Promise<string> {
  const { client_email, private_key } = keyData;
  if (!client_email || !private_key) {
    throw new Error("serviceAccountJson missing client_email or private_key");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: client_email,
    sub: subject,
    scope: scopes.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signingInput = `${encode(header)}.${encode(payload)}`;

  // Import the RSA private key and sign
  const pem = private_key.replace(/\\n/g, "\n");
  const keyBuf = Buffer.from(
    pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, ""),
    "base64",
  );
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    Buffer.from(signingInput),
  );
  const jwt = `${signingInput}.${Buffer.from(sig).toString("base64url")}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenData = await tokenRes.json() as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    throw new Error(`Google auth failed: ${tokenData.error ?? "no access_token"}`);
  }
  return tokenData.access_token;
}

// ─── Microsoft Entra ID ───────────────────────────────────────────────────────
// Two strategies depending on what we have:
// 1. If idpItemId is set: DELETE /oauth2PermissionGrants/{id}  (targeted, requires DelegatedPermissionGrant.ReadWrite.All)
// 2. Fallback: POST /users/{userId}/revokeSignInSessions       (broader, requires User.RevokeSessions.All)

async function revokeMicrosoft(
  credentials: Record<string, string>,
  userEmail: string,
  clientId: string,
  idpItemId?: string,
) {
  const { tenantId, clientId: appClientId, clientSecret } = credentials;
  if (!tenantId || !appClientId || !clientSecret) {
    throw new Error("tenantId, clientId, and clientSecret are required");
  }

  const token = await getMicrosoftAccessToken(tenantId, appClientId, clientSecret);

  if (idpItemId) {
    // Targeted: revoke the specific OAuth permission grant
    const url = `https://graph.microsoft.com/v1.0/oauth2PermissionGrants/${encodeURIComponent(idpItemId)}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) return; // Already gone
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Graph oauth2PermissionGrants delete failed (${res.status}): ${body}`);
    }
    return;
  }

  // Fallback: look up the user's object ID, then revoke all sign-in sessions
  // This is broader but works when we don't have the specific grant ID
  const userRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}?$select=id`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!userRes.ok) {
    throw new Error(`Could not look up user ${userEmail}: ${userRes.status}`);
  }
  const userData = await userRes.json() as { id?: string };
  const userId = userData.id;
  if (!userId) throw new Error("Could not resolve user ID from Microsoft Graph");

  const revokeRes = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userId}/revokeSignInSessions`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Length": "0" },
    },
  );
  if (!revokeRes.ok) {
    const body = await revokeRes.text();
    throw new Error(`Graph revokeSignInSessions failed (${revokeRes.status}): ${body}`);
  }
}

async function getMicrosoftAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const res = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
      }),
    },
  );
  const data = await res.json() as { access_token?: string; error_description?: string };
  if (!data.access_token) {
    throw new Error(`Microsoft auth failed: ${data.error_description ?? "no access_token"}`);
  }
  return data.access_token;
}

// ─── Okta ─────────────────────────────────────────────────────────────────────
// Removes the user's assignment from the specific app.
// Requires: App Admin or Super Admin role (Read-Only Admin cannot write)

async function revokeOkta(
  credentials: Record<string, string>,
  userEmail: string,
  clientId: string, // Okta app ID
) {
  const { domain, apiToken } = credentials;
  if (!domain || !apiToken) throw new Error("domain and apiToken are required");

  const base = `https://${domain}`;

  // Resolve Okta user ID from email
  const userRes = await fetch(
    `${base}/api/v1/users/${encodeURIComponent(userEmail)}`,
    { headers: { Authorization: `SSWS ${apiToken}`, Accept: "application/json" } },
  );
  if (!userRes.ok) {
    throw new Error(`Could not look up Okta user ${userEmail}: ${userRes.status}`);
  }
  const userData = await userRes.json() as { id?: string };
  const userId = userData.id;
  if (!userId) throw new Error("Could not resolve Okta user ID");

  // DELETE /api/v1/apps/{appId}/users/{userId}
  const res = await fetch(`${base}/api/v1/apps/${encodeURIComponent(clientId)}/users/${encodeURIComponent(userId)}`, {
    method: "DELETE",
    headers: { Authorization: `SSWS ${apiToken}`, Accept: "application/json" },
  });

  if (res.status === 404) return; // Already removed
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Okta app user delete failed (${res.status}): ${body}`);
  }
}
