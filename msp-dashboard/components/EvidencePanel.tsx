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
  { badge: string; label: string }
> = {
  HIGH:   { badge: "bg-green-100 text-green-700",  label: "High" },
  MEDIUM: { badge: "bg-amber-100 text-amber-700",  label: "Medium" },
  LOW:    { badge: "bg-slate-100 text-slate-500",  label: "Low" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ACCEPTED_EXTENSIONS =
  ".pdf,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.csv,.json,.xml,.html,.log,.docx,.xlsx,.xls,.zip";

function detectSource(url: string): string {
  if (url.includes("docs.google.com/document"))    return "Google Doc";
  if (url.includes("docs.google.com/spreadsheets")) return "Google Sheet";
  if (url.includes("docs.google.com/presentation")) return "Google Slides";
  if (url.includes("drive.google.com/drive/folders")) return "⚠️ Google Drive Folder (unsupported — zip it first)";
  if (url.includes("drive.google.com"))            return "Google Drive file";
  if (url.includes("1drv.ms") || url.includes("onedrive.live.com") || url.includes("sharepoint.com"))
    return "OneDrive file";
  if (url.endsWith(".zip") || url.includes(".zip?")) return "Zip archive";
  return "Direct URL";
}

function fileIcon(mimeType: string, name: string): string {
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) return "📄";
  if (mimeType.startsWith("image/"))  return "🖼️";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    name.endsWith(".xlsx") || name.endsWith(".xls")
  ) return "📊";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) return "📝";
  if (mimeType === "text/csv" || name.endsWith(".csv")) return "📊";
  if (mimeType === "application/json" || name.endsWith(".json")) return "🔧";
  if (name.endsWith(".zip")) return "🗜️";
  return "📋";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  workspaceId: number;
}

type InputMode = "url" | "upload";

// ─── Main component ───────────────────────────────────────────────────────────

export default function EvidencePanel({ workspaceId }: Props) {
  const [mode, setMode] = React.useState<InputMode>("url");

  // URL mode state
  const [url, setUrl] = React.useState("");

  // Upload mode state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Shared state
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<ControlMappingResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // ── File drop handlers ────────────────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setSelectedFile(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }

  // ── Analyze ───────────────────────────────────────────────────────────────
  async function handleAnalyze() {
    if (mode === "url" && !url.trim()) return;
    if (mode === "upload" && !selectedFile) return;

    setRunning(true);
    setError(null);
    setResult(null);
    setExpanded(new Set());

    try {
      let res: Response;

      if (mode === "url") {
        res = await fetch(`/api/client/${workspaceId}/control-mapper`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim() }),
        });
      } else {
        const formData = new FormData();
        formData.append("file", selectedFile!);
        res = await fetch(`/api/client/${workspaceId}/control-mapper`, {
          method: "POST",
          body: formData,
          // Do NOT set Content-Type — browser sets it with the correct boundary
        });
      }

      const data = (await res.json()) as ControlMappingResult & { error?: string };
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const canAnalyze = mode === "url" ? !!url.trim() : !!selectedFile;
  const isFolder = mode === "url" && url.includes("/folders/");

  // ── Loading ───────────────────────────────────────────────────────────────
  if (running) {
    return (
      <div className="flex flex-col items-center py-16 gap-4">
        <svg className="animate-spin w-7 h-7 text-blue-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-sm font-medium text-slate-700">Claude is reading your files…</p>
        <p className="text-xs text-slate-400 max-w-xs text-center">
          {mode === "upload"
            ? "Uploading and analyzing content against Drata controls."
            : "Downloading, reading content, and mapping against Drata controls."}
          {" "}Zip files may take a minute.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Input panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-0.5">Map evidence files to Drata controls</p>
          <p className="text-xs text-slate-500">
            Claude reads your file(s) and recommends which controls they provide evidence for —
            so you know exactly what to associate when uploading to Drata.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit">
          {(["url", "upload"] as InputMode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null); }}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                mode === m
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "url" ? "🔗 Paste Link" : "⬆️ Upload File"}
            </button>
          ))}
        </div>

        {/* URL mode */}
        {mode === "url" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !isFolder) void handleAnalyze(); }}
                  placeholder="https://drive.google.com/file/d/… or https://1drv.ms/…"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 pr-8 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {url && (
                  <button
                    onClick={() => { setUrl(""); setResult(null); setError(null); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => void handleAnalyze()}
                disabled={!canAnalyze || isFolder}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Analyze
              </button>
            </div>

            {/* Source type hint */}
            {url.trim() && (
              <p className={`text-xs ${isFolder ? "text-amber-600" : "text-slate-400"}`}>
                {detectSource(url.trim())}
                {isFolder && " — zip the folder and paste the zip link instead"}
              </p>
            )}

            {/* Supported link types */}
            <div className="flex flex-wrap gap-1.5">
              {["Google Drive", "Google Docs / Sheets / Slides", "OneDrive", "Direct URL", "Zip / DOCX / XLSX"].map((t) => (
                <span key={t} className="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Upload mode */}
        {mode === "upload" && (
          <div className="space-y-2">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? "border-blue-400 bg-blue-50"
                  : selectedFile
                  ? "border-green-300 bg-green-50"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={handleFileInput}
              />
              {selectedFile ? (
                <div className="space-y-1">
                  <p className="text-2xl">{fileIcon(selectedFile.type, selectedFile.name)}</p>
                  <p className="text-sm font-semibold text-slate-800">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(selectedFile.size)}</p>
                  <p className="text-xs text-slate-400">Click to change file</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-3xl">📂</p>
                  <p className="text-sm font-medium text-slate-600">
                    Drop a file here, or <span className="text-blue-600">click to browse</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    PDF, images, text files, or a zip archive containing multiple files
                  </p>
                </div>
              )}
            </div>

            {/* Supported types */}
            <div className="flex flex-wrap gap-1.5">
              {["PDF", "DOCX", "XLSX / XLS / CSV", "PNG / JPG / WEBP", "TXT / MD / JSON", "ZIP (multi-file)"].map((t) => (
                <span key={t} className="text-xs bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded-full">
                  {t}
                </span>
              ))}
            </div>

            <button
              onClick={() => void handleAnalyze()}
              disabled={!canAnalyze}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Analyze {selectedFile?.name ? `"${selectedFile.name.slice(0, 30)}${selectedFile.name.length > 30 ? "…" : ""}"` : "file"}
            </button>
          </div>
        )}
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
          {/* Summary bar */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-slate-800">
              {result.analyzedCount} file{result.analyzedCount !== 1 ? "s" : ""} analyzed
            </span>
            {result.skippedCount > 0 && (
              <span className="text-slate-400">{result.skippedCount} skipped</span>
            )}
            <span className="text-slate-300">·</span>
            <span className="text-xs text-slate-400">{new Date(result.generatedAt).toLocaleString()}</span>
            <button
              onClick={() => void handleAnalyze()}
              className="ml-auto text-xs text-blue-600 hover:text-blue-700 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              ↺ Re-analyze
            </button>
          </div>

          {/* Analyzed file cards */}
          {result.files.filter((f) => !f.skipped).map((file, i) => (
            <FileCard
              key={i}
              file={file}
              expanded={expanded.has(`f${i}`)}
              onToggle={() => toggleExpanded(`f${i}`)}
              expandedControls={expanded}
              onToggleControl={toggleExpanded}
              fileIndex={i}
            />
          ))}

          {/* Skipped files */}
          {result.files.some((f) => f.skipped) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Skipped ({result.files.filter((f) => f.skipped).length})
              </p>
              {result.files.filter((f) => f.skipped).map((file, i) => (
                <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
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

      {/* Empty state */}
      {!result && !error && !running && (
        <div className="flex flex-col items-center py-10 gap-2 text-center">
          <span className="text-4xl">🗂️</span>
          <p className="text-sm text-slate-500 max-w-sm">
            Paste a share link or upload a file above. Claude will tell you which Drata controls
            it maps to so you can associate it as evidence with the right controls.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── File result card ─────────────────────────────────────────────────────────

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
  const highCount   = file.recommendedControls.filter((c) => c.confidence === "HIGH").length;
  const medCount    = file.recommendedControls.filter((c) => c.confidence === "MEDIUM").length;
  const icon = fileIcon(file.mimeType, file.fileName);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
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
              {file.recommendedControls.length} control{file.recommendedControls.length !== 1 ? "s" : ""}
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

      {/* Expanded control list */}
      {expanded && (
        <div className="border-t border-slate-100">
          {file.recommendedControls.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-400 text-center">
              No relevant controls identified for this file.
            </p>
          ) : (
            <div className="divide-y divide-slate-50">
              {file.recommendedControls.map((ctrl, ci) => {
                const cfg = CONFIDENCE_CONFIG[ctrl.confidence];
                const key = `f${fileIndex}-c${ci}`;
                const ctrlExpanded = expandedControls.has(key);
                return (
                  <div key={ci} className="px-4 py-3">
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
                          <span key={t} className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
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
        </div>
      )}
    </div>
  );
}
