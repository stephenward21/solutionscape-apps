"use client";

import * as React from "react";
import type {
  ControlMappingResult,
  ControlMappingFileResult,
  RecommendedControlMapping,
} from "@/lib/types";

// ─── Confidence config ────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<
  RecommendedControlMapping["confidence"],
  { badge: string; dot: string; label: string }
> = {
  HIGH:   { badge: "bg-green-100 text-green-700",  dot: "bg-green-500",  label: "High" },
  MEDIUM: { badge: "bg-amber-100 text-amber-700",  dot: "bg-amber-400",  label: "Medium" },
  LOW:    { badge: "bg-slate-100 text-slate-500",  dot: "bg-slate-300",  label: "Low" },
};

// ─── URL helper ───────────────────────────────────────────────────────────────

function detectSource(url: string): { label: string; icon: string } {
  if (url.includes("drive.google.com") || url.includes("docs.google.com")) {
    if (url.includes("/folders/")) return { label: "Google Drive Folder", icon: "📁" };
    if (url.includes("docs.google.com/document"))    return { label: "Google Doc",    icon: "📝" };
    if (url.includes("docs.google.com/spreadsheets")) return { label: "Google Sheet",  icon: "📊" };
    if (url.includes("docs.google.com/presentation")) return { label: "Google Slides", icon: "📽️" };
    return { label: "Google Drive", icon: "📁" };
  }
  if (url.includes("1drv.ms") || url.includes("onedrive.live.com") || url.includes("sharepoint.com")) {
    return { label: "OneDrive", icon: "☁️" };
  }
  if (url.endsWith(".zip") || url.includes(".zip?")) return { label: "Zip file", icon: "🗜️" };
  return { label: "Direct URL", icon: "🔗" };
}

function fileIcon(mimeType: string, name: string): string {
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "text/csv" || name.endsWith(".csv")) return "📊";
  if (mimeType === "application/json" || name.endsWith(".json")) return "🔧";
  return "📋";
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  workspaceId: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EvidencePanel({ workspaceId }: Props) {
  const [url, setUrl] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<ControlMappingResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const source = url.trim() ? detectSource(url.trim()) : null;

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleAnalyze() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setExpanded(new Set());

    try {
      const res = await fetch(`/api/client/${workspaceId}/control-mapper`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = (await res.json()) as ControlMappingResult & { error?: string };
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (running) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <svg className="animate-spin w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm font-medium text-slate-700">Claude is reading your files…</p>
        <p className="text-xs text-slate-400 max-w-xs text-center">
          Downloading, reading content, and mapping against all Drata controls.
          Zip files may take a minute.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* URL input area */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-1">
            Map evidence files to Drata controls
          </p>
          <p className="text-xs text-slate-500">
            Paste a Google Drive, Google Doc/Sheet/Slides, or OneDrive share link — or any direct download URL.
            Zip files are extracted automatically. Claude will recommend which controls each file maps to.
          </p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAnalyze(); }}
              placeholder="https://drive.google.com/file/d/… or https://1drv.ms/…"
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {url && (
              <button
                onClick={() => { setUrl(""); setResult(null); setError(null); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => void handleAnalyze()}
            disabled={!url.trim()}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Analyze
          </button>
        </div>

        {/* Detected source type badge */}
        {source && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>{source.icon}</span>
            <span className="font-medium">{source.label} detected</span>
            {source.label === "Google Drive Folder" && (
              <span className="text-amber-600">
                — Folders are not supported. Please zip the folder and share the zip file.
              </span>
            )}
          </div>
        )}

        {/* Supported types info */}
        <div className="flex flex-wrap gap-1.5">
          {["Google Drive", "Google Docs / Sheets / Slides", "OneDrive", "Direct URL", "Zip archives"].map((t) => (
            <span key={t} className="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Error: </span>{error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span className="font-semibold text-slate-800">{result.analyzedCount} file{result.analyzedCount !== 1 ? "s" : ""} analyzed</span>
            {result.skippedCount > 0 && (
              <span className="text-slate-400">{result.skippedCount} skipped</span>
            )}
            <span className="text-slate-400">·</span>
            <span className="text-xs text-slate-400">
              {new Date(result.generatedAt).toLocaleString()}
            </span>
            <button
              onClick={() => void handleAnalyze()}
              className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              ↺ Re-analyze
            </button>
          </div>

          {/* Analyzed files */}
          {result.files.filter((f) => !f.skipped).map((file, i) => (
            <FileCard
              key={i}
              file={file}
              expanded={expanded.has(`file-${i}`)}
              onToggle={() => toggleExpanded(`file-${i}`)}
              expandedControls={expanded}
              onToggleControl={(key) => toggleExpanded(key)}
              fileIndex={i}
            />
          ))}

          {/* Skipped files */}
          {result.files.filter((f) => f.skipped).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Skipped ({result.files.filter((f) => f.skipped).length})
              </p>
              {result.files.filter((f) => f.skipped).map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3"
                >
                  <span className="text-lg">{fileIcon(file.mimeType, file.fileName)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-500 truncate">{file.fileName}</p>
                    <p className="text-xs text-slate-400">{file.skipReason}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty prompt when nothing analyzed yet */}
      {!result && !error && (
        <div className="flex flex-col items-center py-10 gap-2 text-center">
          <span className="text-4xl">🗂️</span>
          <p className="text-sm text-slate-500 max-w-sm">
            Paste a file link above and Claude will recommend which Drata controls it maps to,
            so you can upload it as evidence with the right associations.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── File card ────────────────────────────────────────────────────────────────

function FileCard({
  file,
  expanded,
  onToggle,
  expandedControls,
  onToggleControl,
  fileIndex,
}: {
  file: ControlMappingFileResult;
  expanded: boolean;
  onToggle: () => void;
  expandedControls: Set<string>;
  onToggleControl: (key: string) => void;
  fileIndex: number;
}) {
  const highCount = file.recommendedControls.filter((c) => c.confidence === "HIGH").length;
  const medCount  = file.recommendedControls.filter((c) => c.confidence === "MEDIUM").length;
  const icon = fileIcon(file.mimeType, file.fileName);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-xl mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            {highCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                {highCount} HIGH
              </span>
            )}
            {medCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                {medCount} MEDIUM
              </span>
            )}
            <span className="text-xs text-slate-400">
              {file.recommendedControls.length} control{file.recommendedControls.length !== 1 ? "s" : ""} recommended
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">{file.fileName}</p>
          {file.fileDescription && (
            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{file.fileDescription}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform shrink-0 mt-1 ${expanded ? "rotate-90" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Expanded: control recommendations */}
      {expanded && file.recommendedControls.length > 0 && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {file.recommendedControls.map((ctrl, ci) => {
            const cfg = CONFIDENCE_CONFIG[ctrl.confidence];
            const key = `file-${fileIndex}-ctrl-${ci}`;
            const ctrlExpanded = expandedControls.has(key);
            return (
              <div key={ci} className="px-4 py-3">
                {/* Control header row */}
                <button
                  onClick={() => onToggleControl(key)}
                  className="w-full text-left"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label} confidence
                    </span>
                    <span className="text-xs font-mono font-semibold text-slate-600">
                      {ctrl.controlCode}
                    </span>
                    {ctrl.frameworkTags.map((t) => (
                      <span
                        key={t}
                        className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                    <svg
                      className={`w-3.5 h-3.5 text-slate-400 ml-auto transition-transform ${ctrlExpanded ? "rotate-90" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <p className="text-xs font-semibold text-slate-800">{ctrl.controlName}</p>
                  {!ctrlExpanded && (
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{ctrl.reasoning}</p>
                  )}
                </button>

                {/* Expanded: reasoning + evidence note */}
                {ctrlExpanded && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-slate-600 leading-relaxed">{ctrl.reasoning}</p>
                    {ctrl.evidenceNote && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                        <span className="text-xs font-semibold text-blue-600">Evidence note: </span>
                        <span className="text-xs text-blue-700">{ctrl.evidenceNote}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {expanded && file.recommendedControls.length === 0 && (
        <div className="border-t border-slate-100 px-4 py-4 text-sm text-slate-400 text-center">
          No relevant controls identified for this file.
        </div>
      )}
    </div>
  );
}
