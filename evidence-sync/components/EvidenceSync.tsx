"use client";

import { useState, useEffect, useCallback } from "react";
import WorkspacePicker from "./WorkspacePicker";
import ControlBrowser from "./ControlBrowser";
import DropZone from "./DropZone";
import MetadataForm from "./MetadataForm";
import BulkImport from "./BulkImport";
import SyncLogPanel from "./SyncLogPanel";
import type {
  DrataFramework,
  DrataControl,
  DrataEvidence,
  SyncLogEntry,
  UploadProgress,
} from "@/lib/types";

interface EvidenceSyncProps {
  hasTenants: boolean;
  hasEnvKey: boolean;
}

function todayISO(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

export default function EvidenceSync({ hasEnvKey }: EvidenceSyncProps) {
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [workspace, setWorkspace] = useState<string>("");
  const [frameworks, setFrameworks] = useState<DrataFramework[]>([]);
  const [selectedControl, setSelectedControl] = useState<DrataControl | null>(null);
  const [allControls, setAllControls] = useState<DrataControl[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const [collectedAt, setCollectedAt] = useState(todayISO);
  const [phase, setPhase] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [existingEvidence, setExistingEvidence] = useState<DrataEvidence[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [showBulk, setShowBulk] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: { workspaces?: Array<{ name: string }> }) => {
        const names = (data.workspaces ?? []).map((w) => w.name);
        setWorkspaces(names);
        if (names.length > 0) setWorkspace(names[0] ?? "");
      })
      .catch(() => {});
  }, []);

  // Load frameworks when workspace changes
  useEffect(() => {
    if (!workspace) {
      setFrameworks([]);
      return;
    }
    const params = new URLSearchParams({ workspace });
    fetch(`/api/frameworks?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { frameworks?: DrataFramework[] }) => {
        setFrameworks(data.frameworks ?? []);
      })
      .catch(() => setFrameworks([]));

    setSelectedControl(null);
    setExistingEvidence([]);
  }, [workspace]);

  // Load sync log on mount
  const loadSyncLog = useCallback(() => {
    fetch("/api/sync-log")
      .then((r) => r.json())
      .then((data: { entries?: SyncLogEntry[] }) => setSyncLog(data.entries ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSyncLog();
  }, [loadSyncLog]);

  // Load existing evidence when control changes
  useEffect(() => {
    if (!selectedControl || !workspace) {
      setExistingEvidence([]);
      return;
    }
    const params = new URLSearchParams({
      workspace,
      controlId: String(selectedControl.id),
    });
    fetch(`/api/evidence?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { evidence?: DrataEvidence[] }) => setExistingEvidence(data.evidence ?? []))
      .catch(() => setExistingEvidence([]));
  }, [selectedControl, workspace]);

  function handleFilesAdded(newFiles: File[]) {
    setFiles((prev) => [...prev, ...newFiles]);
  }

  function handleFileRemoved(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleUpload() {
    if (!selectedControl || files.length === 0 || !workspace) return;

    setPhase("uploading");
    const progressInit: UploadProgress[] = files.map((f) => ({
      fileName: f.name,
      status: "pending",
    }));
    setUploadProgress(progressInit);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      setUploadProgress((prev) =>
        prev.map((p, idx) => (idx === i ? { ...p, status: "uploading" } : p))
      );

      try {
        const formData = new FormData();
        formData.append("workspace", workspace);
        formData.append("controlId", String(selectedControl.id));
        formData.append("controlName", selectedControl.name);
        formData.append("controlCode", selectedControl.code);
        formData.append("description", description);
        formData.append("collectedAt", collectedAt);
        formData.append("file", file);

        const res = await fetch("/api/evidence", {
          method: "POST",
          body: formData,
        });

        const data = (await res.json()) as {
          success?: boolean;
          entry?: SyncLogEntry;
          error?: string;
        };

        if (!res.ok || !data.success) {
          setUploadProgress((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status: "error", error: data.error ?? "Upload failed" }
                : p
            )
          );
        } else {
          const status =
            data.entry?.status === "skipped"
              ? "skipped"
              : data.entry?.status === "error"
              ? "error"
              : "done";
          setUploadProgress((prev) =>
            prev.map((p, idx) =>
              idx === i
                ? { ...p, status, error: data.entry?.errorMessage }
                : p
            )
          );
        }
      } catch (err) {
        setUploadProgress((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? { ...p, status: "error", error: err instanceof Error ? err.message : "Upload failed" }
              : p
          )
        );
      }
    }

    setPhase("done");

    // Refresh evidence list and sync log
    const params = new URLSearchParams({
      workspace,
      controlId: String(selectedControl.id),
    });
    fetch(`/api/evidence?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { evidence?: DrataEvidence[] }) => setExistingEvidence(data.evidence ?? []))
      .catch(() => {});

    loadSyncLog();

    // Clear files after upload
    setFiles([]);
  }

  async function handleDeleteEvidence(evidenceId: number) {
    if (!workspace) return;
    const params = new URLSearchParams({ workspace });
    try {
      await fetch(`/api/evidence/${evidenceId}?${params.toString()}`, {
        method: "DELETE",
      });
      setExistingEvidence((prev) => prev.filter((e) => e.id !== evidenceId));
    } catch {
      // ignore
    }
  }

  async function handleClearLog() {
    // We'll just call sync-log with a clear action via a DELETE method—
    // but the spec only has GET. We'll refresh from empty by clearing server-side.
    // For now clear locally; a DELETE endpoint can be added later.
    setSyncLog([]);
  }

  const canUpload =
    !!workspace && !!selectedControl && files.length > 0 && phase !== "uploading";

  const uploadProgressStatusIcon = (s: UploadProgress["status"]) => {
    if (s === "done") return "✅";
    if (s === "error") return "❌";
    if (s === "skipped") return "⏭";
    if (s === "uploading") return "⏳";
    return "○";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">🗂</span>
          <h1 className="text-lg font-bold text-slate-900">Evidence Sync</h1>
          <span className="text-xs text-slate-500 hidden sm:block">Drata GRC Toolkit</span>
        </div>

        <div className="flex items-center gap-4">
          <WorkspacePicker
            workspaces={workspaces}
            selected={workspace}
            onChange={(ws) => {
              setWorkspace(ws);
              setSelectedControl(null);
              setFiles([]);
              setUploadProgress([]);
              setPhase("idle");
            }}
          />
          <button
            onClick={() => setShowBulk(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <span>⚡</span>
            <span>Bulk Import</span>
          </button>
        </div>
      </header>

      {/* No credentials warning */}
      {!hasEnvKey && (
        <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-900">No API credentials configured</p>
          <p className="text-xs text-amber-700 mt-1">
            Set <code className="bg-amber-100 px-1 rounded">DRATA_API_KEY</code> or{" "}
            <code className="bg-amber-100 px-1 rounded">DRATA_TENANTS</code> in your{" "}
            <code className="bg-amber-100 px-1 rounded">.env.local</code> file and restart the
            server.
          </p>
        </div>
      )}

      {/* Main layout */}
      <div className="flex h-[calc(100vh-57px)] overflow-hidden">
        {/* Left panel — Controls */}
        <div className="w-80 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Controls
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
            <ControlBrowser
              workspace={workspace}
              frameworks={frameworks}
              selectedControl={selectedControl}
              onSelectControl={(ctrl) => {
                setSelectedControl(ctrl);
                setUploadProgress([]);
                setPhase("idle");
              }}
              onControlsLoaded={setAllControls}
            />
          </div>
        </div>

        {/* Right panel — Upload + Evidence */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selected control indicator */}
          {selectedControl ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="font-mono font-bold text-blue-800 text-sm">
                {selectedControl.code}
              </span>
              <span className="text-sm text-blue-900">{selectedControl.name}</span>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-500">
              Select a control on the left to begin uploading evidence
            </div>
          )}

          {/* Drop zone + metadata */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <DropZone
              files={files}
              onFilesAdded={handleFilesAdded}
              onFileRemoved={handleFileRemoved}
            />

            <MetadataForm
              description={description}
              collectedAt={collectedAt}
              onDescriptionChange={setDescription}
              onCollectedAtChange={setCollectedAt}
              disabled={phase === "uploading"}
            />

            {/* Upload progress */}
            {uploadProgress.length > 0 && (
              <div className="space-y-1.5">
                {uploadProgress.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span>{uploadProgressStatusIcon(p.status)}</span>
                    <span className="truncate flex-1">{p.fileName}</span>
                    {p.error && <span className="text-red-600 text-xs truncate">{p.error}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!canUpload}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {phase === "uploading" ? (
                <>
                  <span className="animate-pulse">⏳</span>
                  Uploading...
                </>
              ) : (
                <>
                  <span>↑</span>
                  {files.length > 1
                    ? `Upload ${files.length} Files`
                    : files.length === 1
                    ? "Upload 1 File"
                    : "Upload Files"}
                </>
              )}
            </button>
          </div>

          {/* Existing evidence for this control */}
          {selectedControl && (
            <div className="bg-white border border-slate-200 rounded-xl">
              <div className="px-4 py-3 border-b border-slate-200">
                <h3 className="text-sm font-semibold text-slate-800">
                  Existing Evidence — {selectedControl.code}
                </h3>
              </div>
              {existingEvidence.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-slate-500">
                  No evidence uploaded for this control yet
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {existingEvidence.map((ev) => (
                    <li
                      key={ev.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {ev.fileName}
                        </p>
                        <p className="text-xs text-slate-500">
                          {ev.description && `${ev.description} — `}
                          Collected:{" "}
                          {ev.collectedAt
                            ? new Date(ev.collectedAt).toLocaleDateString()
                            : "—"}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteEvidence(ev.id)}
                        className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 transition-colors"
                        aria-label={`Delete ${ev.fileName}`}
                      >
                        🗑 Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Sync Log */}
          <SyncLogPanel entries={syncLog} onClear={handleClearLog} />
        </div>
      </div>

      {/* Bulk Import modal */}
      {showBulk && (
        <BulkImport
          workspace={workspace}
          controls={allControls}
          onClose={() => setShowBulk(false)}
          onComplete={(results) => {
            loadSyncLog();
            // Show results — BulkImport handles internal display
            console.log(`Bulk import complete: ${results.length} items`);
          }}
        />
      )}
    </div>
  );
}
