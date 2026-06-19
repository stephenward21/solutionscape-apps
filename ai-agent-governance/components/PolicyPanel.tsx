"use client";

import { useState, useRef } from "react";
import type { PolicyAnalysisResult, AIToolPolicy } from "@/lib/types";

const STATUS_CONFIG: Record<AIToolPolicy["status"], { label: string; badge: string; dot: string }> = {
  APPROVED:    { label: "Approved",    badge: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  PROHIBITED:  { label: "Prohibited",  badge: "bg-rose-100 text-rose-700",       dot: "bg-rose-500" },
  CONDITIONAL: { label: "Conditional", badge: "bg-amber-100 text-amber-700",     dot: "bg-amber-500" },
  UNREVIEWED:  { label: "Unreviewed",  badge: "bg-slate-100 text-slate-500",     dot: "bg-slate-300" },
};

interface PolicyPanelProps {
  onAnalysisComplete?: (result: PolicyAnalysisResult) => void;
}

export default function PolicyPanel({ onAnalysisComplete }: PolicyPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PolicyAnalysisResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setError(null);
    setResult(null);
  }

  async function analyze() {
    if (!file) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/analyze-policy", { method: "POST", body: form });
      const data = await res.json() as PolicyAnalysisResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
      onAnalysisComplete?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">AI Policy Analyzer</h2>
        <p className="text-sm text-slate-500">
          Upload your organization's AI usage policy. Claude will extract which AI tools and vendors
          are approved, prohibited, or conditional — and flag any gaps.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-brand-500 bg-brand-50"
            : file
            ? "border-emerald-400 bg-emerald-50"
            : "border-slate-200 hover:border-brand-400 hover:bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {file ? (
          <div>
            <p className="text-2xl mb-2">{file.name.endsWith(".pdf") ? "📄" : "📝"}</p>
            <p className="text-sm font-semibold text-slate-700">{file.name}</p>
            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
          </div>
        ) : (
          <div>
            <p className="text-3xl mb-3">📄</p>
            <p className="text-sm font-semibold text-slate-700">Drop your policy file here</p>
            <p className="text-xs text-slate-400 mt-1">PDF, Word (.docx), or plain text · up to 20 MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {file && !result && (
        <button
          onClick={() => { void analyze(); }}
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-3 transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              Claude is analyzing your policy…
            </>
          ) : (
            "Analyze Policy"
          )}
        </button>
      )}

      {result && <PolicyResults result={result} onReset={() => { setResult(null); setFile(null); }} />}
    </div>
  );
}

function PolicyResults({ result, onReset }: { result: PolicyAnalysisResult; onReset: () => void }) {
  const allTools = [
    ...result.approvedTools,
    ...result.conditionalTools,
    ...result.prohibitedTools,
  ];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-gradient-to-r from-brand-50 to-purple-50 border border-brand-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide mb-1">Policy Summary</p>
        {result.organizationName && (
          <p className="text-sm font-semibold text-slate-800 mb-1">{result.organizationName}</p>
        )}
        <p className="text-sm text-slate-600 leading-relaxed">{result.summary}</p>
        <p className="text-xs text-slate-400 mt-2">
          Analyzed {new Date(result.analyzedAt).toLocaleString()} · {result.policyFilename}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Approved"    value={result.approvedTools.length}    color="text-emerald-600" bg="bg-emerald-50" />
        <StatBox label="Conditional" value={result.conditionalTools.length} color="text-amber-600"   bg="bg-amber-50" />
        <StatBox label="Prohibited"  value={result.prohibitedTools.length}  color="text-rose-600"    bg="bg-rose-50" />
      </div>

      {/* Tool list */}
      {allTools.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Tools & Vendors Found in Policy</h3>
          <div className="space-y-2">
            {allTools.map((tool, i) => {
              const cfg = STATUS_CONFIG[tool.status];
              return (
                <div key={i} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-sm font-semibold text-slate-800">{tool.tool}</span>
                    <span className="text-xs text-slate-400">{tool.vendor}</span>
                  </div>
                  {tool.conditions && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 mt-1">{tool.conditions}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{tool.reasoning}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Policy gaps */}
      {result.policyGaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">Policy Gaps Detected</p>
          <ul className="space-y-1">
            {result.policyGaps.map((gap, i) => (
              <li key={i} className="flex gap-2 text-xs text-amber-800">
                <span className="shrink-0 mt-0.5">•</span>{gap}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onReset}
        className="text-sm text-slate-500 hover:text-slate-700 underline"
      >
        Upload a different policy
      </button>
    </div>
  );
}

function StatBox({ label, value, color, bg }: { label: string; value: number; color: string; bg: string }) {
  return (
    <div className={`${bg} rounded-xl p-3 text-center`}>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
