"use client";

import React, { useState, useEffect } from "react";
import type { IdPProvider } from "@/lib/types";

type DrawerTab = "setup" | "revoke";
type Provider = Exclude<IdPProvider, "manual">;

const PROVIDERS: { id: Provider; name: string; shortName: string }[] = [
  { id: "google",    name: "Google Workspace",    shortName: "Google" },
  { id: "microsoft", name: "Microsoft Entra ID",  shortName: "Entra ID" },
  { id: "okta",      name: "Okta",                shortName: "Okta" },
];

interface Props {
  open: boolean;
  initialProvider?: Provider;
  onClose: () => void;
}

export default function IdPSetupDrawer({ open, initialProvider = "google", onClose }: Props) {
  const [tab, setTab]           = useState<DrawerTab>("setup");
  const [provider, setProvider] = useState<Provider>(initialProvider);

  // Sync to the caller's initial provider when drawer reopens
  useEffect(() => {
    if (open) setProvider(initialProvider);
  }, [open, initialProvider]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Directory Connection Guide</h2>
            <p className="text-xs text-slate-400 mt-0.5">Step-by-step setup and access revocation</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Provider tabs */}
        <div className="flex gap-1 px-4 pt-3 pb-0 border-b border-slate-100 shrink-0">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => setProvider(p.id)}
              className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-colors -mb-px border-b-2 ${
                provider === p.id
                  ? "text-brand-600 border-brand-500 bg-white"
                  : "text-slate-500 border-transparent hover:text-slate-700"
              }`}
            >
              {p.shortName}
            </button>
          ))}
        </div>

        {/* Setup / Revoke tab toggle */}
        <div className="flex gap-2 px-4 py-3 shrink-0">
          <button
            onClick={() => setTab("setup")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === "setup"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            Setup & Permissions
          </button>
          <button
            onClick={() => setTab("revoke")}
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              tab === "revoke"
                ? "bg-rose-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            Revoking App Access
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {tab === "setup"  && <SetupContent  provider={provider} />}
          {tab === "revoke" && <RevokeContent provider={provider} />}
        </div>
      </div>
    </>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
        <div className="text-xs text-slate-500 leading-relaxed space-y-1">{children}</div>
      </div>
    </div>
  );
}

function RevokeStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-bold flex items-center justify-center mt-0.5">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 mb-1">{title}</p>
        <div className="text-xs text-slate-500 leading-relaxed space-y-1">{children}</div>
      </div>
    </div>
  );
}

function NavPath({ parts }: { parts: string[] }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-0.5 font-medium text-slate-700">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{p}</code>
          {i < parts.length - 1 && <span className="text-slate-400 text-[10px]">›</span>}
        </React.Fragment>
      ))}
    </span>
  );
}

function Scope({ value }: { value: string }) {
  return (
    <code className="block bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-mono text-slate-700 mt-1 break-all">
      {value}
    </code>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
      <span className="text-amber-500 text-sm shrink-0">⚠</span>
      <p className="text-xs text-amber-800 leading-relaxed">{children}</p>
    </div>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2 mt-3">
      <span className="text-brand-500 text-sm shrink-0">💡</span>
      <p className="text-xs text-brand-800 leading-relaxed">{children}</p>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-4">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ─── Setup content per provider ───────────────────────────────────────────────

function SetupContent({ provider }: { provider: Provider }) {
  if (provider === "google")    return <GoogleSetup />;
  if (provider === "microsoft") return <MicrosoftSetup />;
  return <OktaSetup />;
}

function GoogleSetup() {
  return (
    <div className="space-y-5 pt-1">
      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
        SolutionScape uses a <strong className="text-slate-700">service account with domain-wide delegation</strong> to
        read OAuth token grants and Admin SDK audit logs. No passwords are accessed. Read-only scopes only.
      </div>

      <SectionDivider label="Google Cloud Console" />

      <Step n={1} title="Create or select a Google Cloud project">
        <p>Go to <NavPath parts={["console.cloud.google.com"]} /> and create a new project (or use an existing one tied to your Workspace domain).</p>
      </Step>

      <Step n={2} title="Enable required APIs">
        <p>In the project, go to <NavPath parts={["APIs & Services", "Enable APIs and Services"]} /> and enable:</p>
        <Scope value="Admin SDK API" />
        <Scope value="Google Workspace Admin Reports API (included in Admin SDK)" />
      </Step>

      <Step n={3} title="Create a Service Account">
        <p>Go to <NavPath parts={["IAM & Admin", "Service Accounts"]} /> → <strong>Create Service Account</strong>.</p>
        <p className="mt-1">Name it something like <code className="bg-slate-100 px-1 rounded">solutionscape-reader</code>. No project roles needed.</p>
      </Step>

      <Step n={4} title="Enable Domain-Wide Delegation">
        <p>Open the service account → <NavPath parts={["Advanced settings", "Domain-wide delegation"]} /> → check <strong>Enable G Suite Domain-wide Delegation</strong>.</p>
        <p className="mt-1">Copy the <strong>Client ID</strong> shown — you will need it in the next step.</p>
      </Step>

      <Step n={5} title="Create and download a JSON key">
        <p>In the service account → <NavPath parts={["Keys", "Add Key", "Create new key"]} /> → choose <strong>JSON</strong>.</p>
        <p className="mt-1">Save the downloaded file. You will paste its contents into SolutionScape.</p>
        <Note>Keep this file secure. Anyone with the key can read your directory. Delete it after pasting.</Note>
      </Step>

      <SectionDivider label="Google Admin Console" />

      <Step n={6} title="Authorize the delegation scopes">
        <p>In <NavPath parts={["admin.google.com"]} /> → <NavPath parts={["Security", "Access and data control", "API controls", "Domain-wide delegation"]} />.</p>
        <p className="mt-1">Click <strong>Add new</strong>, paste the service account <strong>Client ID</strong>, and add these scopes:</p>
        <Scope value="https://www.googleapis.com/auth/admin.directory.user.readonly" />
        <Scope value="https://www.googleapis.com/auth/admin.reports.audit.readonly" />
        <Scope value="https://www.googleapis.com/auth/admin.reports.usage.readonly" />
      </Step>

      <Step n={7} title="Identify a Super Admin email">
        <p>The service account impersonates a Super Admin to make API calls. Provide any active Super Admin email address in the <strong>Admin Email</strong> field when connecting.</p>
        <Tip>Use a shared service account address (e.g., <code className="bg-brand-50 px-1 rounded">it-admin@yourorg.com</code>) rather than a personal admin account so access isn&apos;t tied to one person.</Tip>
      </Step>

      <SectionDivider label="Required permissions summary" />

      <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
        <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">Minimum required scopes</div>
        {[
          ["admin.directory.user.readonly", "List all users in the directory"],
          ["admin.reports.audit.readonly", "Read OAuth token grant/revoke events"],
          ["admin.reports.usage.readonly", "Read app usage activity per user"],
        ].map(([scope, desc]) => (
          <div key={scope} className="px-3 py-2 border-b border-slate-100 last:border-0">
            <code className="text-[11px] font-mono text-brand-700">{scope}</code>
            <p className="text-slate-400 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MicrosoftSetup() {
  return (
    <div className="space-y-5 pt-1">
      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
        SolutionScape uses a <strong className="text-slate-700">registered application (service principal)</strong> with
        application-level permissions to read enterprise app sign-in logs and directory data. No user credentials are accessed.
      </div>

      <SectionDivider label="Azure Portal — App Registration" />

      <Step n={1} title="Create an App Registration">
        <p>Go to <NavPath parts={["portal.azure.com"]} /> → <NavPath parts={["Azure Active Directory", "App registrations"]} /> → <strong>New registration</strong>.</p>
        <p className="mt-1">Name: <code className="bg-slate-100 px-1 rounded">SolutionScape</code>. Supported account types: <strong>Single tenant</strong>. No redirect URI needed.</p>
      </Step>

      <Step n={2} title="Copy your Tenant ID and Client ID">
        <p>From the app&apos;s Overview page, copy:</p>
        <p className="mt-1">• <strong>Application (client) ID</strong> → paste as <em>Client ID</em> in SolutionScape</p>
        <p>• <strong>Directory (tenant) ID</strong> → paste as <em>Tenant ID</em></p>
      </Step>

      <Step n={3} title="Add API permissions">
        <p>Go to <NavPath parts={["API permissions", "Add a permission", "Microsoft Graph", "Application permissions"]} /> and add:</p>
        <Scope value="AuditLog.Read.All" />
        <Scope value="Directory.Read.All" />
        <Scope value="Application.Read.All" />
        <Note>These are <strong>Application permissions</strong> (not Delegated). They allow background access without a signed-in user.</Note>
      </Step>

      <Step n={4} title="Grant admin consent">
        <p>Still on the API permissions page, click <strong>Grant admin consent for [your org]</strong> and confirm.</p>
        <p className="mt-1">All three permissions should show a green ✓ <em>Granted</em> status.</p>
      </Step>

      <Step n={5} title="Create a Client Secret">
        <p>Go to <NavPath parts={["Certificates & secrets", "Client secrets", "New client secret"]} />.</p>
        <p className="mt-1">Choose an expiry (12 or 24 months recommended). Copy the <strong>Value</strong> immediately — it is only shown once.</p>
        <Note>Set a calendar reminder to rotate the secret before it expires. SolutionScape will fail to connect once the secret expires.</Note>
      </Step>

      <SectionDivider label="Required permissions summary" />

      <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
        <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">Microsoft Graph — Application permissions</div>
        {[
          ["AuditLog.Read.All", "Read sign-in and audit logs for all users"],
          ["Directory.Read.All", "Read all users, groups, and directory metadata"],
          ["Application.Read.All", "Read enterprise app registrations and assignments"],
        ].map(([perm, desc]) => (
          <div key={perm} className="px-3 py-2 border-b border-slate-100 last:border-0">
            <code className="text-[11px] font-mono text-brand-700">{perm}</code>
            <p className="text-slate-400 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>

      <Tip>
        If your org uses <strong>Conditional Access</strong>, ensure the registered app is excluded from
        policies that would block service-principal sign-ins — otherwise the API calls will be denied.
      </Tip>
    </div>
  );
}

function OktaSetup() {
  return (
    <div className="space-y-5 pt-1">
      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
        SolutionScape uses an <strong className="text-slate-700">Okta API token scoped to a Read-Only Admin service account</strong> to
        list application assignments and read system log events. No user credentials are accessed.
      </div>

      <SectionDivider label="Create a service account (recommended)" />

      <Step n={1} title="Create a dedicated service user">
        <p>In the Okta Admin Console → <NavPath parts={["Directory", "People"]} /> → <strong>Add person</strong>.</p>
        <p className="mt-1">Create a user like <code className="bg-slate-100 px-1 rounded">solutionscape-svc@yourorg.com</code>. This keeps the API token tied to a non-personal account.</p>
        <Tip>Using a named user means the token is not lost if an admin leaves. You can also use an Okta service account (OAuth M2M) instead — see the note below.</Tip>
      </Step>

      <Step n={2} title="Assign the Read-Only Admin role">
        <p>Go to the service user&apos;s profile → <NavPath parts={["Admin roles"]} /> → <strong>Add individual admin privilege</strong> → select <strong>Read-Only Administrator</strong>.</p>
        <p className="mt-1">This role has access to all the data SolutionScape needs and cannot modify anything.</p>
      </Step>

      <SectionDivider label="Generate an API token" />

      <Step n={3} title="Sign in as the service account">
        <p>Open a private/incognito browser window, sign in to the Okta Admin Console as the service user you just created.</p>
      </Step>

      <Step n={4} title="Create an API Token">
        <p>Go to <NavPath parts={["Security", "API", "Tokens"]} /> → <strong>Create Token</strong>.</p>
        <p className="mt-1">Name it <code className="bg-slate-100 px-1 rounded">SolutionScape</code>. Copy the token value — it is only shown once.</p>
        <Note>API tokens in Okta are tied to the generating user&apos;s session. The token inherits the Read-Only Admin role permissions and is valid until manually revoked or the user is deactivated.</Note>
      </Step>

      <Step n={5} title="Find your Okta domain">
        <p>Your Okta domain is the hostname you use to access the admin console, e.g.:</p>
        <Scope value="yourcompany.okta.com" />
        <p className="mt-1">Do not include <code className="bg-slate-100 px-1 rounded">https://</code> when entering it in SolutionScape.</p>
      </Step>

      <SectionDivider label="Required API access summary" />

      <div className="rounded-xl border border-slate-200 overflow-hidden text-xs">
        <div className="bg-slate-50 px-3 py-2 font-semibold text-slate-600 border-b border-slate-200">Okta API endpoints used</div>
        {[
          ["/api/v1/users", "List all active directory users"],
          ["/api/v1/apps", "List all app integrations"],
          ["/api/v1/apps/{id}/users", "List which users are assigned to each app"],
          ["/api/v1/logs", "Read system log events (app sign-ins, token grants)"],
        ].map(([endpoint, desc]) => (
          <div key={endpoint} className="px-3 py-2 border-b border-slate-100 last:border-0">
            <code className="text-[11px] font-mono text-brand-700">{endpoint}</code>
            <p className="text-slate-400 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Revoke content per provider ──────────────────────────────────────────────

function RevokeContent({ provider }: { provider: Provider }) {
  if (provider === "google")    return <GoogleRevoke />;
  if (provider === "microsoft") return <MicrosoftRevoke />;
  return <OktaRevoke />;
}

function GoogleRevoke() {
  return (
    <div className="space-y-5 pt-1">
      <div className="bg-rose-50 rounded-xl p-3 text-xs text-rose-700 leading-relaxed border border-rose-100">
        Revoking OAuth access in Google Workspace removes the token the AI tool uses to access Google data.
        The user&apos;s account in the AI tool is <strong>not deleted</strong> — only their Google OAuth connection is severed.
      </div>

      <SectionDivider label="Revoke for a single user" />

      <RevokeStep n={1} title="Open App Access Control">
        <p>Go to <NavPath parts={["admin.google.com"]} /> → <NavPath parts={["Security", "Access and data control", "API controls"]} /> → <strong>Manage third-party app access</strong>.</p>
      </RevokeStep>

      <RevokeStep n={2} title="Find the AI tool">
        <p>Search for the app by name (e.g., <em>ChatGPT</em>, <em>Notion</em>, <em>GitHub Copilot</em>). Click the app row to expand it.</p>
      </RevokeStep>

      <RevokeStep n={3} title="Remove the specific user's access">
        <p>In the app&apos;s detail view, find the user in the <strong>Users with access</strong> list. Click their name → <strong>Remove access</strong>.</p>
        <p className="mt-1">This immediately revokes the OAuth refresh token for that user only. Other users are unaffected.</p>
      </RevokeStep>

      <SectionDivider label="Block an app org-wide" />

      <RevokeStep n={4} title="Block the app for the entire domain">
        <p>From the same <strong>Manage third-party app access</strong> screen, find the app → click <strong>Change access</strong> → select <strong>Blocked</strong>.</p>
        <p className="mt-1">This revokes all existing tokens <em>and</em> prevents any user from re-authorizing the app.</p>
        <Note>Blocking is immediate and affects all users. Notify users before blocking a widely-used tool to avoid disruption.</Note>
      </RevokeStep>

      <SectionDivider label="Revoke from the user's account directly" />

      <RevokeStep n={5} title="User self-service (for low-urgency situations)">
        <p>Direct the user to <NavPath parts={["myaccount.google.com", "Security", "Third-party apps with account access"]} />.</p>
        <p className="mt-1">They can find the AI tool and click <strong>Remove access</strong> themselves. Good for routine cleanup; not appropriate for incident response.</p>
      </RevokeStep>

      <Tip>
        After revoking, run another SolutionScape scan. The tool should no longer appear in that user&apos;s
        activity — confirming the revocation was effective.
      </Tip>
    </div>
  );
}

function MicrosoftRevoke() {
  return (
    <div className="space-y-5 pt-1">
      <div className="bg-rose-50 rounded-xl p-3 text-xs text-rose-700 leading-relaxed border border-rose-100">
        Revoking access in Entra ID can mean removing a user&apos;s app assignment, revoking their OAuth tokens,
        or disabling the enterprise app entirely. Each has different scope and urgency.
      </div>

      <SectionDivider label="Remove a user's app assignment" />

      <RevokeStep n={1} title="Open Enterprise Applications">
        <p>Go to <NavPath parts={["portal.azure.com"]} /> → <NavPath parts={["Azure Active Directory", "Enterprise applications"]} />.</p>
        <p className="mt-1">Search for the application by name (e.g., <em>GitHub</em>, <em>Slack</em>, <em>ChatGPT</em>).</p>
      </RevokeStep>

      <RevokeStep n={2} title="Remove the user assignment">
        <p>Open the application → <NavPath parts={["Users and groups"]} />. Find the user, check the box next to their name, and click <strong>Remove</strong>.</p>
        <p className="mt-1">This prevents them from signing in via SSO, but does not immediately revoke existing access tokens.</p>
      </RevokeStep>

      <SectionDivider label="Revoke active tokens (incident response)" />

      <RevokeStep n={3} title="Revoke the user's refresh tokens">
        <p>Go to <NavPath parts={["Azure Active Directory", "Users"]} /> → find the user → click <strong>Revoke sessions</strong>.</p>
        <p className="mt-1">This signs the user out of all Microsoft sessions and invalidates all OAuth refresh tokens, including those issued to third-party apps. Takes effect within minutes.</p>
        <Note>This revokes ALL the user&apos;s Microsoft sessions — not just the one AI tool. Use for security incidents. For routine offboarding, removing the assignment (Step 2) is sufficient.</Note>
      </RevokeStep>

      <RevokeStep n={4} title="Revoke app-specific delegated permissions">
        <p>In the enterprise application → <NavPath parts={["Permissions"]} /> → <strong>Admin consent</strong> tab.</p>
        <p className="mt-1">Click <strong>Revoke admin consent</strong> to remove all delegated permissions the app was granted for your tenant. This affects all users.</p>
      </RevokeStep>

      <SectionDivider label="Disable an app for the entire org" />

      <RevokeStep n={5} title="Disable the enterprise application">
        <p>In the enterprise application → <NavPath parts={["Properties"]} /> → set <strong>Enabled for users to sign in?</strong> to <strong>No</strong> → Save.</p>
        <p className="mt-1">No users in your org can sign in to the app via this registration. Existing tokens may still work until they expire (usually 1 hour for access tokens).</p>
        <Tip>
          To close the token window immediately, combine this with revoking sessions for any high-risk users
          via Step 3, or set a Conditional Access policy blocking the application.
        </Tip>
      </RevokeStep>
    </div>
  );
}

function OktaRevoke() {
  return (
    <div className="space-y-5 pt-1">
      <div className="bg-rose-50 rounded-xl p-3 text-xs text-rose-700 leading-relaxed border border-rose-100">
        Revoking access in Okta removes a user&apos;s app assignment and can invalidate their active sessions
        with the application. For apps using Okta as SSO, this is immediate. For OAuth token-based apps,
        the token may remain valid until it expires.
      </div>

      <SectionDivider label="Remove a user from a specific app" />

      <RevokeStep n={1} title="Open the application in the Admin Console">
        <p>Go to <NavPath parts={["Applications", "Applications"]} /> → search for the app by name.</p>
        <p className="mt-1">Click the app to open its settings.</p>
      </RevokeStep>

      <RevokeStep n={2} title="Remove the user's assignment">
        <p>Go to the <strong>Assignments</strong> tab. Find the user (or the group that includes them), click the <strong>x</strong> next to their name, and confirm removal.</p>
        <p className="mt-1">For SSO-based apps, this immediately prevents the user from signing in via Okta. They may still have an active browser session until it expires.</p>
      </RevokeStep>

      <SectionDivider label="Terminate the user's active session" />

      <RevokeStep n={3} title="Clear the user's Okta sessions">
        <p>Go to <NavPath parts={["Directory", "People"]} /> → find the user → open their profile → click <strong>More actions</strong> → <strong>Clear user sessions</strong>.</p>
        <p className="mt-1">This terminates their active Okta session, signing them out of all Okta-managed apps immediately.</p>
      </RevokeStep>

      <RevokeStep n={4} title="Revoke OAuth tokens (for OAuth-connected apps)">
        <p>For apps using Okta as an OAuth authorization server (not just SSO), go to the user&apos;s profile → <strong>More actions</strong> → <strong>Revoke OAuth tokens</strong>.</p>
        <p className="mt-1">This specifically invalidates OAuth access and refresh tokens the app holds, even if the user&apos;s main Okta session is still active.</p>
        <Note>Not all apps use Okta OAuth. For SaaS AI tools (ChatGPT, Notion, etc.) that use Google or Microsoft OAuth under the hood, you must revoke access from that provider directly — Okta cannot revoke tokens issued by Google or Microsoft.</Note>
      </RevokeStep>

      <SectionDivider label="Disable an app for the entire org" />

      <RevokeStep n={5} title="Deactivate the application">
        <p>In the application settings → click the <strong>gear icon</strong> or <strong>Actions</strong> → <strong>Deactivate</strong>.</p>
        <p className="mt-1">A deactivated app cannot be accessed by any user. All assignments are preserved — you can reactivate later without reconfiguring.</p>
        <Tip>
          Prefer <strong>deactivation</strong> over deletion when you may want to re-enable the app later.
          Deletion removes all assignments and configuration permanently.
        </Tip>
      </RevokeStep>
    </div>
  );
}
