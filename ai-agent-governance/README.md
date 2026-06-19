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

# Google Workspace (optional)
GOOGLE_SERVICE_ACCOUNT_JSON=...
GOOGLE_ADMIN_EMAIL=admin@yourdomain.com

# Microsoft Entra ID (optional)
MICROSOFT_TENANT_ID=...
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...

# Okta (optional)
OKTA_DOMAIN=yourcompany.okta.com
OKTA_API_TOKEN=...
```

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
