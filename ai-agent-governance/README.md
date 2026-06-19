# AI Agent Governance

A Next.js application that helps organizations detect unauthorized AI tool usage, enforce AI usage policies, and generate per-user compliance reports.

Part of the [Solutionscape](https://solutionscape.ai) compliance automation platform.

## What it does

### 1. AI Policy Analyzer
Upload your organization's AI usage policy (PDF, Word, or plain text). Claude reads the document and extracts:
- Which AI tools and vendors are **approved**, **prohibited**, or **conditional**
- Conditions attached to approved/conditional tools
- **Policy gaps** — categories of AI tools the policy doesn't address

### 2. Directory Connection (IdP)
Connect your identity provider to detect which AI tools users have authorized and what systems those tools can access:

| Provider | Method |
|---|---|
| Google Workspace | Admin SDK Reports API — OAuth app authorizations + audit logs |
| Microsoft Entra ID | Microsoft Graph API — enterprise app sign-ins + role assignments |
| Okta | System Log API + Application Users API |
| Manual | CSV upload for any other IdP or SSO provider |

### 3. Compliance Report
Cross-references the policy rules against detected user activity. For each user:
- **Compliance status**: Compliant / Breach / Conditional / Unknown
- **Breach details**: which tool, why it's a breach, what systems it accessed
- **Risk score**: 0–100 based on severity and scope
- **Remediation recommendation**: specific action to take per breach
- **AI executive narrative**: Claude summarizes the organization's overall risk posture

---

## Getting started

### Prerequisites
- Node.js 18+
- An Anthropic API key

### Install & run

```bash
cd ai-agent-governance
npm install
cp .env.local.example .env.local   # add your ANTHROPIC_API_KEY
npm run dev                         # starts on http://localhost:3005
```

### Environment variables

```env
ANTHROPIC_API_KEY=sk-ant-...

# Google Workspace (optional — see setup guide below)
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
GOOGLE_ADMIN_EMAIL=admin@yourdomain.com

# Microsoft Entra ID (optional — see setup guide below)
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Okta (optional — see setup guide below)
OKTA_DOMAIN=yourcompany.okta.com
OKTA_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## IdP Setup Guides

### Google Workspace

The connector uses a **service account** with domain-wide delegation to read OAuth token grants and Admin SDK audit logs. You need Google Workspace Super Admin access.

**Step 1 — Create a Google Cloud project**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click **Select a project → New Project**
3. Name it (e.g. `solutionscape-governance`) and click **Create**

**Step 2 — Enable required APIs**

In your new project, go to **APIs & Services → Library** and enable:
- `Admin SDK API`
- `Google Workspace Audit and Investigation API` (if available on your plan)

**Step 3 — Create a service account**

1. Go to **IAM & Admin → Service Accounts → Create Service Account**
2. Name it (e.g. `ai-governance-reader`) and click **Create and Continue**
3. Skip role assignment — click **Done**
4. Click the service account → **Keys tab → Add Key → Create new key → JSON**
5. Download the JSON file — this is your `GOOGLE_SERVICE_ACCOUNT_JSON` value

**Step 4 — Enable domain-wide delegation**

1. On the service account page, click **Edit** → check **Enable Google Workspace Domain-wide Delegation**
2. Note the **Client ID** shown (a large number)
3. Go to your **Google Workspace Admin Console** → **Security → API Controls → Domain-wide Delegation**
4. Click **Add new** and enter:
   - **Client ID**: the number from step 2
   - **OAuth Scopes** (comma-separated):
     ```
     https://www.googleapis.com/auth/admin.reports.audit.readonly,
     https://www.googleapis.com/auth/admin.directory.user.readonly,
     https://www.googleapis.com/auth/admin.reports.usage.readonly
     ```
5. Click **Authorize**

**Step 5 — Set environment variables**

```env
# Paste the entire contents of the downloaded JSON file as a single line
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"ai-governance-reader@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token"}

# A Super Admin email in your Workspace org (used to impersonate for API calls)
GOOGLE_ADMIN_EMAIL=admin@yourdomain.com
```

---

### Microsoft Entra ID (formerly Azure AD)

The connector uses an **app registration** with application-level permissions (no user login required) to read sign-in logs and service principal assignments via Microsoft Graph.

You need Global Administrator or Application Administrator access in your Azure tenant.

**Step 1 — Register an application**

1. Go to [portal.azure.com](https://portal.azure.com) → **Azure Active Directory → App registrations → New registration**
2. Name it (e.g. `Solutionscape AI Governance`)
3. Set **Supported account types** to `Accounts in this organizational directory only`
4. Leave Redirect URI blank → click **Register**
5. Copy the **Application (client) ID** → this is `MICROSOFT_CLIENT_ID`
6. Copy the **Directory (tenant) ID** → this is `MICROSOFT_TENANT_ID`

**Step 2 — Add API permissions**

1. Go to **API permissions → Add a permission → Microsoft Graph → Application permissions**
2. Add all of the following permissions:
   - `AuditLog.Read.All` — read sign-in and audit logs
   - `Directory.Read.All` — read users and groups
   - `Application.Read.All` — read enterprise app assignments
   - `Policy.Read.All` — read conditional access policies
3. Click **Add permissions**
4. Click **Grant admin consent for [your org]** and confirm

**Step 3 — Create a client secret**

1. Go to **Certificates & secrets → New client secret**
2. Add a description (e.g. `ai-governance`) and set an expiry (24 months recommended)
3. Click **Add**
4. **Copy the secret Value immediately** — it won't be shown again
5. This is `MICROSOFT_CLIENT_SECRET`

**Step 4 — Set environment variables**

```env
MICROSOFT_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note:** Microsoft Graph sign-in logs require an **Entra ID P1 or P2** license. Basic directory and app assignment data is available on all plans.

---

### Okta

The connector uses an **API token** scoped to a read-only admin role to pull system log events and application user assignments.

You need Okta Super Administrator access to create API tokens.

**Step 1 — Create a read-only admin service account (recommended)**

Rather than using a Super Admin token, create a minimal-permission account:

1. Go to **Directory → People → Add Person**
2. Create a service user (e.g. `solutionscape-governance@yourcompany.com`)
3. Go to **Security → Administrators → Add Administrator**
4. Assign the `Read-Only Administrator` role to this user

**Step 2 — Generate an API token**

1. Log in as the service account user (or a Super Admin)
2. Go to **Security → API → Tokens → Create Token**
3. Name it (e.g. `Solutionscape AI Governance`)
4. Click **Create Token**
5. **Copy the token value immediately** — it won't be shown again
6. This is `OKTA_API_TOKEN`

**Step 3 — Find your Okta domain**

Your Okta domain is shown at the top of every Okta admin page:
- Format: `yourcompany.okta.com` or `yourcompany.oktapreview.com` (sandbox)
- Do **not** include `https://`

**Step 4 — Set environment variables**

```env
OKTA_DOMAIN=yourcompany.okta.com
OKTA_API_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> **Note:** Okta API tokens inherit the permissions of the user who created them. Using a Read-Only Administrator account limits blast radius if the token is ever compromised. Tokens expire after 30 days of inactivity.

---

## Project structure

```
ai-agent-governance/
├── app/
│   ├── api/
│   │   ├── analyze-policy/    — PDF/Word → Claude → structured policy rules
│   │   ├── idp/               — IdP connector (Google, Microsoft, Okta, CSV)
│   │   └── report/            — Policy × user activity → compliance report
│   ├── dashboard/             — Main three-tab dashboard
│   └── page.tsx               — Landing page
├── components/
│   ├── Dashboard.tsx          — Tab shell
│   ├── PolicyPanel.tsx        — Policy upload and analysis results
│   ├── IdPPanel.tsx           — Provider selection and connection form
│   └── ReportPanel.tsx        — Per-user compliance table and AI narrative
├── lib/
│   └── types.ts               — Full type model
└── data/                      — Local cache (gitignored)
```

---

## Implementation status

| Feature | Status |
|---|---|
| Policy analysis (PDF/Word/txt) | ✅ Complete |
| Dashboard UI (all three tabs) | ✅ Complete |
| Compliance report UI | ✅ Complete |
| AI executive narrative | ✅ Complete |
| Google Workspace connector | 🔧 Scaffolded — needs service account credentials |
| Microsoft Entra connector | 🔧 Scaffolded — needs Graph API credentials |
| Okta connector | 🔧 Scaffolded — needs API token |
| Manual CSV upload | 🔧 Scaffolded |

---

## Deployment

Designed to deploy on [Railway](https://railway.app) alongside the other Solutionscape apps.

```
Railway service: ai-agent-governance
Root directory:  ai-agent-governance/
Port:            3005
```

See the platform-level README for Railway setup and the shared Postgres migration guide.

---

## Security notes

- Drata and Anthropic API keys are never stored in git — use `.env.local` locally and Railway environment variables in production
- IdP credentials entered in the UI are used only for the current session
- The `data/` directory (local cache) is gitignored
