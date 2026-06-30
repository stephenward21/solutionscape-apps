/**
 * POST /api/idp
 * Accepts credentials in the request body, connects to the IdP, and returns
 * detected AI tool activity per user.
 *
 * Body: { provider: "google" | "microsoft" | "okta" | "manual", credentials: {...} }
 */
import { NextResponse } from "next/server";
import type { UserActivity, DetectedAITool } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Known AI tool OAuth client IDs / app names ───────────────────────────────
// These are the OAuth client IDs and app names that popular AI tools use when
// requesting authorization via Google Workspace's Admin Reports API.
const AI_TOOL_SIGNATURES: Array<{
  patterns: string[];   // substrings to match in app name (case-insensitive)
  tool: string;
  vendor: string;
  categories: string[];
}> = [
  { patterns: ["chatgpt", "openai", "chat.openai"], tool: "ChatGPT",        vendor: "OpenAI",        categories: ["llm", "chat"] },
  { patterns: ["github copilot", "copilot"],         tool: "GitHub Copilot", vendor: "GitHub",        categories: ["code-generation"] },
  { patterns: ["claude", "anthropic"],               tool: "Claude",         vendor: "Anthropic",     categories: ["llm", "chat"] },
  { patterns: ["midjourney"],                        tool: "Midjourney",     vendor: "Midjourney",    categories: ["image-generation"] },
  { patterns: ["grammarly"],                         tool: "Grammarly",      vendor: "Grammarly",     categories: ["writing-assistant"] },
  { patterns: ["notion ai", "notion"],               tool: "Notion AI",      vendor: "Notion",        categories: ["productivity", "llm"] },
  { patterns: ["jasper"],                            tool: "Jasper",         vendor: "Jasper AI",     categories: ["writing-assistant"] },
  { patterns: ["otter.ai", "otter"],                 tool: "Otter.ai",       vendor: "Otter.ai",      categories: ["transcription", "meeting"] },
  { patterns: ["fireflies"],                         tool: "Fireflies",      vendor: "Fireflies.ai",  categories: ["transcription", "meeting"] },
  { patterns: ["perplexity"],                        tool: "Perplexity",     vendor: "Perplexity AI", categories: ["search", "llm"] },
  { patterns: ["cursor"],                            tool: "Cursor",         vendor: "Anysphere",     categories: ["code-generation"] },
  { patterns: ["writesonic"],                        tool: "Writesonic",     vendor: "Writesonic",    categories: ["writing-assistant"] },
  { patterns: ["copy.ai"],                           tool: "Copy.ai",        vendor: "Copy.ai",       categories: ["writing-assistant"] },
  { patterns: ["beautiful.ai"],                      tool: "Beautiful.ai",   vendor: "Beautiful.ai",  categories: ["presentation"] },
  { patterns: ["gamma"],                             tool: "Gamma",          vendor: "Gamma",         categories: ["presentation"] },
  { patterns: ["zapier"],                            tool: "Zapier",         vendor: "Zapier",        categories: ["automation"] },
  { patterns: ["make.com", "integromat"],            tool: "Make",           vendor: "Make",          categories: ["automation"] },
  { patterns: ["runway"],                            tool: "Runway",         vendor: "Runway",        categories: ["video-generation"] },
  { patterns: ["synthesia"],                         tool: "Synthesia",      vendor: "Synthesia",     categories: ["video-generation"] },
  { patterns: ["heygen"],                            tool: "HeyGen",         vendor: "HeyGen",        categories: ["video-generation"] },
  { patterns: ["elevenlabs"],                        tool: "ElevenLabs",     vendor: "ElevenLabs",    categories: ["audio-generation"] },
  { patterns: ["character.ai"],                      tool: "Character.AI",   vendor: "Character Technologies", categories: ["llm", "chat"] },
  { patterns: ["gemini", "bard"],                    tool: "Gemini",         vendor: "Google",        categories: ["llm", "chat"] },
  { patterns: ["copilot365", "microsoft 365 copilot"], tool: "Microsoft 365 Copilot", vendor: "Microsoft", categories: ["llm", "productivity"] },
  { patterns: ["manus"],                             tool: "Manus",          vendor: "Butterfly Effect", categories: ["agent", "autonomous-task"] },
  { patterns: ["devin"],                             tool: "Devin",          vendor: "Cognition Labs", categories: ["agent", "code-generation"] },
  { patterns: ["replit"],                            tool: "Replit Agent",   vendor: "Replit",        categories: ["agent", "code-generation"] },
  { patterns: ["lovable"],                           tool: "Lovable",        vendor: "Lovable",       categories: ["agent", "code-generation"] },
  { patterns: ["v0.dev", "v0 by vercel"],             tool: "v0",             vendor: "Vercel",        categories: ["agent", "code-generation"] },
  { patterns: ["genspark"],                           tool: "Genspark",       vendor: "Genspark",      categories: ["agent", "search"] },
  { patterns: ["adept ai", "adept.ai"],               tool: "Adept",          vendor: "Adept",         categories: ["agent", "autonomous-task"] },
  { patterns: ["browser use", "browser-use"],         tool: "Browser Use",    vendor: "Browser Use",   categories: ["agent", "browser-automation"] },
  { patterns: ["poe.com", "poe"],                     tool: "Poe",            vendor: "Quora",         categories: ["llm", "chat"] },
  { patterns: ["you.com"],                            tool: "You.com",        vendor: "You.com",       categories: ["search", "llm"] },
  { patterns: ["deepseek"],                           tool: "DeepSeek",       vendor: "DeepSeek",      categories: ["llm", "chat"] },
  { patterns: ["mistral"],                            tool: "Mistral",        vendor: "Mistral AI",    categories: ["llm", "chat"] },
  { patterns: ["huggingface", "hugging face"],        tool: "HuggingChat",    vendor: "Hugging Face",  categories: ["llm", "chat"] },
  { patterns: ["glean"],                              tool: "Glean",          vendor: "Glean",         categories: ["search", "llm"] },
  { patterns: ["harvey"],                             tool: "Harvey",         vendor: "Harvey AI",     categories: ["llm", "legal"] },
  { patterns: ["sourcegraph cody", "cody"],           tool: "Cody",           vendor: "Sourcegraph",   categories: ["code-generation"] },
  { patterns: ["tabnine"],                            tool: "Tabnine",        vendor: "Tabnine",       categories: ["code-generation"] },
  { patterns: ["codeium", "windsurf"],                tool: "Windsurf",       vendor: "Codeium",       categories: ["code-generation"] },
  { patterns: ["suno"],                               tool: "Suno",           vendor: "Suno",          categories: ["audio-generation"] },
  { patterns: ["pika.art", "pika labs"],               tool: "Pika",           vendor: "Pika Labs",     categories: ["video-generation"] },
  { patterns: ["luma ai", "luma labs"],               tool: "Luma AI",        vendor: "Luma Labs",     categories: ["video-generation"] },
  { patterns: ["ideogram"],                           tool: "Ideogram",       vendor: "Ideogram",      categories: ["image-generation"] },
  { patterns: ["leonardo.ai", "leonardo ai"],          tool: "Leonardo.Ai",    vendor: "Leonardo.Ai",   categories: ["image-generation"] },
  { patterns: ["firefly"],                            tool: "Adobe Firefly",  vendor: "Adobe",         categories: ["image-generation"] },
  { patterns: ["agentforce"],                         tool: "Agentforce",     vendor: "Salesforce",    categories: ["agent", "crm"] },
];

// Google first-party products — skip entirely when building the unrecognized
// bucket for a Google Workspace connector so we don't surface Google's own
// apps as "unknown third-party grants" needing AI review.
const GOOGLE_FIRST_PARTY_PATTERNS = [
  "google", "gmail", "youtube", "android", "chrome", "blogger",
  "google maps", "google drive", "google docs", "google sheets", "google slides",
  "google calendar", "google meet", "google chat", "google forms",
  "google classroom", "google photos", "google play", "google earth",
  "google analytics", "google ads", "google cloud", "google pay",
  "google workspace", "google admin", "google sites", "google vault",
  "google keep", "google tasks", "google currents", "google jamboard",
  "google one", "google fi", "google voice", "hangouts",
];

function isGoogleFirstParty(appName: string): boolean {
  const lower = appName.toLowerCase();
  return GOOGLE_FIRST_PARTY_PATTERNS.some((p) => lower.includes(p));
}

function matchAITool(appName: string): { tool: string; vendor: string; categories: string[] } | null {
  const lower = appName.toLowerCase();
  for (const sig of AI_TOOL_SIGNATURES) {
    if (sig.patterns.some((p) => lower.includes(p))) {
      return { tool: sig.tool, vendor: sig.vendor, categories: sig.categories };
    }
  }
  return null;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<NextResponse> {
  let body: { provider?: string; credentials?: Record<string, string> };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { provider, credentials = {} } = body;

  if (!provider) {
    return NextResponse.json({ error: "provider is required" }, { status: 400 });
  }

  try {
    if (provider === "google") {
      const users = await connectGoogle(credentials as { serviceAccountJson: string; adminEmail: string });
      return NextResponse.json({ provider, users });
    }

    if (provider === "microsoft") {
      const users = await connectMicrosoft(credentials as { tenantId: string; clientId: string; clientSecret: string });
      return NextResponse.json({ provider, users });
    }

    if (provider === "okta") {
      const users = await connectOkta(credentials as { domain: string; apiToken: string });
      return NextResponse.json({ provider, users });
    }

    if (provider === "manual") {
      return NextResponse.json(
        { error: "Manual CSV upload is not yet implemented in this version." },
        { status: 501 }
      );
    }

    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Google Workspace ─────────────────────────────────────────────────────────

async function connectGoogle(creds: { serviceAccountJson: string; adminEmail: string }): Promise<UserActivity[]> {
  if (!creds.serviceAccountJson?.trim()) {
    throw new Error("Service account JSON is required.");
  }
  if (!creds.adminEmail?.trim()) {
    throw new Error("Admin email is required.");
  }

  let keyJson: Record<string, string>;
  try {
    keyJson = JSON.parse(creds.serviceAccountJson) as Record<string, string>;
  } catch {
    throw new Error("Service account JSON is not valid JSON. Paste the entire contents of the downloaded key file.");
  }

  if (keyJson.type !== "service_account") {
    throw new Error('Service account JSON must have "type": "service_account". Did you paste the right file?');
  }

  // Dynamic import so the module is only loaded on the server
  const { google } = await import("googleapis");

  const auth = new google.auth.JWT({
    email: keyJson.client_email,
    key: keyJson.private_key,
    scopes: [
      "https://www.googleapis.com/auth/admin.reports.audit.readonly",
      "https://www.googleapis.com/auth/admin.directory.user.readonly",
    ],
    subject: creds.adminEmail,
  });

  // Verify the credentials work before doing anything else
  try {
    await auth.authorize();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unauthorized_client")) {
      throw new Error(
        "Google rejected the service account credentials. Make sure you:\n" +
        "1. Enabled domain-wide delegation on the service account\n" +
        "2. Added the required OAuth scopes in Workspace Admin Console\n" +
        "3. Entered a Super Admin email for impersonation\n\n" +
        `Google error: ${msg}`
      );
    }
    throw new Error(`Google authentication failed: ${msg}`);
  }

  const reports = google.admin({ version: "reports_v1", auth });
  const directory = google.admin({ version: "directory_v1", auth });

  // Fetch all users from the directory
  const userMap = new Map<string, { displayName: string; department?: string }>();
  try {
    let pageToken: string | undefined;
    do {
      const res = await directory.users.list({
        customer: "my_customer",
        maxResults: 500,
        pageToken,
        projection: "basic",
      });
      for (const u of res.data.users ?? []) {
        if (u.primaryEmail) {
          userMap.set(u.primaryEmail, {
            displayName: u.name?.fullName ?? u.primaryEmail,
            department: (u.organizations as Array<{ department?: string }> | undefined)?.[0]?.department,
          });
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch user list from Google Directory: ${msg}`);
  }

  // Fetch OAuth token events from the last 180 days.
  // We do NOT filter by eventName — the token application emits authorize,
  // revoke, approve, reject events. We want all of them to accurately track
  // which apps each user currently has active grants for.
  const startTime = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  interface ToolGrant extends DetectedAITool {
    revoked: boolean;
  }
  const toolsPerUser = new Map<string, Map<string, ToolGrant>>();

  try {
    let pageToken: string | undefined;
    do {
      const res = await reports.activities.list({
        userKey: "all",
        applicationName: "token",
        // No eventName filter — capture authorize, revoke, approve, reject
        startTime,
        maxResults: 1000,
        pageToken,
      });

      for (const activity of res.data.items ?? []) {
        const timestamp = activity.id?.time ?? new Date().toISOString();

        for (const event of activity.events ?? []) {
          const rawParams = event.parameters ?? [];

          // Helper functions for extracting event parameters
          const param = (name: string): string | null => {
            const p = rawParams.find((x) => x.name === name);
            return p?.value ?? p?.multiValue?.[0] ?? null;
          };
          const paramMulti = (name: string): string[] => {
            const p = rawParams.find((x) => x.name === name);
            if (p?.multiValue?.length) return p.multiValue as string[];
            return p?.value ? [p.value] : [];
          };

          // "User" column in Admin Console OAuth log = resource_owner parameter.
          // actor.email is whoever performed the action — could be an admin for
          // delegated actions. Always prefer resource_owner for the affected user.
          const userEmail =
            param("resource_owner") ??
            activity.actor?.email ??
            null;
          if (!userEmail) continue;

          // app_name is the human-readable name shown in the "Application Name"
          // column in the Admin Console. client_id is an opaque OAuth ID string
          // and should NOT be used for name matching.
          const appName = param("app_name") ?? "";
          if (!appName) continue;

          // Google first-party apps are irrelevant for AI governance — skip them.
          // For everything else: if not in the known-AI signature list, keep it
          // with recognized: false so the report step can do a web lookup to
          // determine whether the app is AI-related rather than silently dropping it.
          const knownMatch = matchAITool(appName);
          if (!knownMatch && isGoogleFirstParty(appName)) continue;

          const match = knownMatch ?? {
            tool: appName,
            vendor: "Unknown",
            categories: ["unclassified"],
          };
          const recognized = knownMatch !== null;

          const scopes = paramMulti("scope");
          const eventName = event.name ?? "";

          if (!toolsPerUser.has(userEmail)) toolsPerUser.set(userEmail, new Map());
          const userTools = toolsPerUser.get(userEmail)!;

          if (userTools.has(match.tool)) {
            const existing = userTools.get(match.tool)!;
            existing.signInCount = (existing.signInCount ?? 0) + 1;
            if (timestamp > (existing.lastSeenAt ?? "")) existing.lastSeenAt = timestamp;
            if (timestamp < (existing.firstSeenAt ?? timestamp)) existing.firstSeenAt = timestamp;
            // Track revocation state: revoke cancels, authorize/approve re-activates
            if (eventName === "revoke") existing.revoked = true;
            if (eventName === "authorize" || eventName === "approve") existing.revoked = false;
          } else {
            const systemsAccessed = inferSystemsFromScopes(scopes);
            userTools.set(match.tool, {
              tool: match.tool,
              vendor: match.vendor,
              firstSeenAt: timestamp,
              lastSeenAt: timestamp,
              signInCount: 1,
              oauthScopes: scopes,
              systemsAccessed,
              detectionMethod: "oauth",
              recognized,
              revoked: eventName === "revoke",
            });
          }
        }
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch OAuth activity from Google Reports: ${msg}`);
  }

  // Assemble UserActivity array — exclude tools where the most recent event
  // was a revoke (the user has since removed the app's access)
  const results: UserActivity[] = [];
  for (const [email, tools] of toolsPerUser) {
    const activeTools = Array.from(tools.values()).filter((t) => !t.revoked);
    if (activeTools.length === 0) continue;

    const userInfo = userMap.get(email) ?? { displayName: email };
    const timestamps = activeTools.map((t) => new Date(t.lastSeenAt ?? 0).getTime());
    results.push({
      userId: email,
      email,
      displayName: userInfo.displayName,
      department: userInfo.department,
      aiToolsDetected: activeTools.map(({ revoked: _revoked, ...rest }) => rest),
      lastActivityAt: new Date(Math.max(...timestamps)).toISOString(),
    });
  }

  // Sort by most recent activity first
  results.sort((a, b) =>
    new Date(b.lastActivityAt ?? 0).getTime() - new Date(a.lastActivityAt ?? 0).getTime()
  );

  return results;
}

function inferSystemsFromScopes(scopes: string[]): string[] {
  const systems: string[] = [];
  const joined = scopes.join(" ").toLowerCase();
  if (joined.includes("drive"))     systems.push("Google Drive");
  if (joined.includes("gmail") || joined.includes("mail")) systems.push("Gmail");
  if (joined.includes("calendar"))  systems.push("Google Calendar");
  if (joined.includes("meet"))      systems.push("Google Meet");
  if (joined.includes("docs"))      systems.push("Google Docs");
  if (joined.includes("sheets"))    systems.push("Google Sheets");
  if (joined.includes("slides"))    systems.push("Google Slides");
  if (joined.includes("contacts"))  systems.push("Google Contacts");
  if (joined.includes("admin"))     systems.push("Workspace Admin");
  return systems;
}

// ─── Microsoft Entra ID ───────────────────────────────────────────────────────

async function connectMicrosoft(creds: { tenantId: string; clientId: string; clientSecret: string }): Promise<UserActivity[]> {
  if (!creds.tenantId?.trim() || !creds.clientId?.trim() || !creds.clientSecret?.trim()) {
    throw new Error("Tenant ID, Client ID, and Client Secret are all required.");
  }

  // Get access token via client credentials flow
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
    throw new Error(
      `Microsoft authentication failed: ${err.error_description ?? tokenRes.statusText}. ` +
      "Check your Tenant ID, Client ID, and Client Secret."
    );
  }

  const tokenData = await tokenRes.json() as { access_token: string };
  const accessToken = tokenData.access_token;

  const graphHeaders = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  // Fetch service principals (enterprise apps) from the directory
  const spRes = await fetch(
    "https://graph.microsoft.com/v1.0/servicePrincipals?$select=id,displayName,appId&$top=999",
    { headers: graphHeaders }
  );
  if (!spRes.ok) {
    throw new Error(`Failed to fetch enterprise apps from Microsoft Graph: ${spRes.statusText}`);
  }

  const spData = await spRes.json() as { value: Array<{ id: string; displayName: string; appId: string }> };
  const aiApps = spData.value.filter((sp) => matchAITool(sp.displayName));

  if (aiApps.length === 0) {
    return [];
  }

  // For each AI app, get the users who have been assigned
  const toolsPerUser = new Map<string, Map<string, DetectedAITool>>();

  for (const app of aiApps) {
    const match = matchAITool(app.displayName)!;
    try {
      const assignRes = await fetch(
        `https://graph.microsoft.com/v1.0/servicePrincipals/${app.id}/appRoleAssignedTo?$select=principalId,principalDisplayName,createdDateTime&$top=999`,
        { headers: graphHeaders }
      );
      if (!assignRes.ok) continue;

      const assignData = await assignRes.json() as {
        value: Array<{ principalId: string; principalDisplayName: string; createdDateTime: string }>;
      };

      for (const assignment of assignData.value) {
        const email = assignment.principalDisplayName; // may not be email; Graph returns UPN on users endpoint
        const userId = assignment.principalId;
        if (!toolsPerUser.has(userId)) toolsPerUser.set(userId, new Map());
        const userTools = toolsPerUser.get(userId)!;
        userTools.set(match.tool, {
          tool: match.tool,
          vendor: match.vendor,
          firstSeenAt: assignment.createdDateTime,
          lastSeenAt: assignment.createdDateTime,
          detectionMethod: "saml",
        });
      }
    } catch {
      // Skip apps we can't read
    }
  }

  // Resolve user UPNs/emails for each principalId
  const results: UserActivity[] = [];
  for (const [userId, tools] of toolsPerUser) {
    let email = userId;
    let displayName: string | undefined;
    try {
      const userRes = await fetch(
        `https://graph.microsoft.com/v1.0/users/${userId}?$select=userPrincipalName,displayName,department`,
        { headers: graphHeaders }
      );
      if (userRes.ok) {
        const u = await userRes.json() as { userPrincipalName: string; displayName: string; department?: string };
        email = u.userPrincipalName;
        displayName = u.displayName;
      }
    } catch {
      // Use principal ID as fallback
    }

    results.push({
      userId,
      email,
      displayName,
      aiToolsDetected: Array.from(tools.values()),
    });
  }

  return results;
}

// ─── Okta ─────────────────────────────────────────────────────────────────────

async function connectOkta(creds: { domain: string; apiToken: string }): Promise<UserActivity[]> {
  if (!creds.domain?.trim() || !creds.apiToken?.trim()) {
    throw new Error("Okta domain and API token are both required.");
  }

  const domain = creds.domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const headers = {
    Authorization: `SSWS ${creds.apiToken}`,
    Accept: "application/json",
  };

  // Verify credentials by fetching the org info
  const orgRes = await fetch(`https://${domain}/api/v1/org`, { headers });
  if (!orgRes.ok) {
    if (orgRes.status === 401) {
      throw new Error("Okta authentication failed: invalid API token. Generate a new token in Security → API → Tokens.");
    }
    if (orgRes.status === 404) {
      throw new Error(`Okta domain "${domain}" not found. Check the domain format (e.g. yourcompany.okta.com, no https://).`);
    }
    throw new Error(`Okta connection failed: ${orgRes.statusText}`);
  }

  // Fetch all applications in the org
  const appsRes = await fetch(`https://${domain}/api/v1/apps?limit=200`, { headers });
  if (!appsRes.ok) {
    throw new Error(`Failed to fetch Okta applications: ${appsRes.statusText}`);
  }

  const apps = await appsRes.json() as Array<{ id: string; label: string; status: string }>;
  const aiApps = apps.filter((a) => a.status === "ACTIVE" && matchAITool(a.label));

  if (aiApps.length === 0) {
    return [];
  }

  const toolsPerUser = new Map<string, { email: string; displayName?: string; tools: Map<string, DetectedAITool> }>();

  for (const app of aiApps) {
    const match = matchAITool(app.label)!;
    try {
      const usersRes = await fetch(`https://${domain}/api/v1/apps/${app.id}/users?limit=500`, { headers });
      if (!usersRes.ok) continue;

      const appUsers = await usersRes.json() as Array<{
        id: string;
        credentials?: { userName?: string };
        profile?: { email?: string; displayName?: string };
        created: string;
        lastUpdated: string;
      }>;

      for (const u of appUsers) {
        const email = u.credentials?.userName ?? u.profile?.email ?? u.id;
        if (!toolsPerUser.has(u.id)) {
          toolsPerUser.set(u.id, { email, displayName: u.profile?.displayName, tools: new Map() });
        }
        toolsPerUser.get(u.id)!.tools.set(match.tool, {
          tool: match.tool,
          vendor: match.vendor,
          firstSeenAt: u.created,
          lastSeenAt: u.lastUpdated,
          detectionMethod: "saml",
        });
      }
    } catch {
      // Skip apps we can't read
    }
  }

  return Array.from(toolsPerUser.entries()).map(([userId, data]) => ({
    userId,
    email: data.email,
    displayName: data.displayName,
    aiToolsDetected: Array.from(data.tools.values()),
  }));
}
