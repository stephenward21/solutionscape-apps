import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-500/20 border border-brand-500/30 mb-6">
            <svg className="w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">AI Agent Governance</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Detect unauthorized AI tool usage across your organization, enforce AI policies,
            and generate compliance reports per user.
          </p>
        </div>

        {/* Three-step flow */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <StepCard
            step="1"
            icon="📄"
            title="Upload AI Policy"
            description="Upload your organization's AI usage policy (PDF or Word). Claude extracts which tools are approved, prohibited, or conditional."
            href="/dashboard?tab=policy"
          />
          <StepCard
            step="2"
            icon="🔌"
            title="Connect Directory"
            description="Connect Google Workspace, Microsoft Entra ID, or Okta to read OAuth sign-ins and audit logs for AI tool activity."
            href="/dashboard?tab=idp"
          />
          <StepCard
            step="3"
            icon="📊"
            title="View Compliance Report"
            description="See which users are breaching policy, what tools they're using, and what systems those tools can access."
            href="/dashboard?tab=report"
          />
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl px-8 py-3.5 transition-colors text-lg"
          >
            Open Dashboard
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        <footer className="mt-16 text-center text-xs text-slate-600">
          Powered by Solutionscape · AI analysis by Claude
        </footer>
      </div>
    </main>
  );
}

function StepCard({
  step, icon, title, description, href,
}: {
  step: string;
  icon: string;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group bg-white/5 hover:bg-white/8 border border-white/10 hover:border-brand-500/40 rounded-2xl p-6 transition-all"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="w-6 h-6 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-400 text-xs font-bold flex items-center justify-center">
          {step}
        </span>
        <span className="text-2xl">{icon}</span>
      </div>
      <h2 className="text-white font-semibold mb-2">{title}</h2>
      <p className="text-slate-400 text-sm leading-relaxed">{description}</p>
    </Link>
  );
}
