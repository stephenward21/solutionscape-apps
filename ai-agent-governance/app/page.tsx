import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-16">
          {/* Hex logo mark */}
          <div className="inline-flex items-center justify-center mb-6">
            <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="hg" x1="0" y1="0" x2="72" y2="72" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#2A8EC5" />
                  <stop offset="100%" stopColor="#2EB598" />
                </linearGradient>
              </defs>
              <polygon points="36,4 64,20 64,52 36,68 8,52 8,20" fill="url(#hg)" opacity="0.15" />
              <polygon points="36,4 64,20 64,52 36,68 8,52 8,20" fill="none" stroke="url(#hg)" strokeWidth="1.5" opacity="0.6" />
              {/* Node network */}
              <circle cx="26" cy="36" r="4.5" fill="#2A8EC5" fillOpacity="0.9" />
              <circle cx="46" cy="24" r="4.5" fill="#2EB598" fillOpacity="0.9" />
              <circle cx="46" cy="48" r="4.5" fill="#2EB598" fillOpacity="0.9" />
              <line x1="26" y1="36" x2="46" y2="24" stroke="white" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" />
              <line x1="26" y1="36" x2="46" y2="48" stroke="white" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" />
              <line x1="46" y1="24" x2="46" y2="48" stroke="white" strokeWidth="2" strokeOpacity="0.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="mb-3">
            <span className="text-sm font-semibold tracking-widest text-brand-400 uppercase">SolutionScape</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">AI Agent Governance</h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Discover every AI tool your team uses, score the risk, and enforce
            your acceptable use policy — all from your identity provider.
          </p>
        </div>

        {/* Two-path cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-12">
          <Link
            href="/dashboard"
            className="group bg-teal-500/10 hover:bg-teal-500/15 border border-teal-500/30 hover:border-teal-400/60 rounded-2xl p-6 transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">🔍</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-semibold">AI Discovery</h2>
                  <span className="text-xs bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full font-medium">Quick start</span>
                </div>
                <p className="text-xs text-slate-400">No policy needed</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Connect your directory and get an instant inventory of every AI tool in use,
              what each one does, and how risky it is for your org.
            </p>
            <div className="flex flex-wrap gap-2">
              {["AI tool inventory", "Risk scores", "Web research"].map((t) => (
                <span key={t} className="text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full">{t}</span>
              ))}
            </div>
          </Link>

          <Link
            href="/dashboard"
            className="group bg-brand-500/10 hover:bg-brand-500/15 border border-brand-500/30 hover:border-brand-400/60 rounded-2xl p-6 transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">📋</span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-white font-semibold">Policy Compliance</h2>
                  <span className="text-xs bg-brand-500/20 text-brand-300 border border-brand-500/30 px-2 py-0.5 rounded-full font-medium">3 steps</span>
                </div>
                <p className="text-xs text-slate-400">For orgs with an AI policy</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Upload your AI acceptable use policy, connect your directory, and get a
              per-user compliance report showing exactly who is in breach and why.
            </p>
            <div className="flex flex-wrap gap-2">
              {["Upload policy", "Connect directory", "Per-user report"].map((t, i) => (
                <span key={t} className="flex items-center gap-1 text-xs bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded-full">
                  <span className="text-slate-600 font-mono">{i + 1}</span>
                  {t}
                </span>
              ))}
            </div>
          </Link>
        </div>

        <div className="text-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-brand-600 to-teal-600 hover:from-brand-500 hover:to-teal-500 text-white font-semibold rounded-xl px-8 py-3.5 transition-all text-lg shadow-lg shadow-brand-900/40"
          >
            Open Dashboard
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        <footer className="mt-16 text-center text-xs text-slate-600">
          Powered by SolutionScape · AI analysis by Claude
        </footer>
      </div>
    </main>
  );
}
