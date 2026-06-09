"use client";

import { useState, useRef } from "react";
import type { DrataControl, SyncLogEntry } from "@/lib/types";

interface BulkImportProps {
  workspace: string;
  controls: DrataControl[];
  onClose: () => void;
  onComplete: (results: SyncLogEntry[]) => void;
}

type BulkResult = {
  results: SyncLogEntry[];
  successCount: number;
  errorCount: number;
  skippedCount: number;
};

export default function BulkImport({ workspace, controls, onClose, onComplete }: BulkImportProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const header = "fileName,controlId,description,collectedAt";
    const exampleRows = controls.slice(0, 3).map(
      (c) =>
        `example-${c.code.replace(".", "-").toLowerCase()}.pdf,${c.id},"Evidence for ${c.name}",${new Date().toISOString().split("T")[0]}`
    );
    const csv = [header, ...exampleRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!csvFile || !zipFile) return;
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("workspace", workspace);
      formData.append("csvFile", csvFile);
      formData.append("zipFile", zipFile);

      const res = await fetch("/api/evidence/bulk", {
        method: "POST",
        body: formData,
      });

      const data = (await res.json()) as BulkResult & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "Import failed");
        return;
      }

      setResult(data);
      onComplete(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white w-full max-w-xl h-full shadow-2xl overflow-y-auto">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Bulk Import</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-1">How it works</h3>
            <ol className="text-xs text-blue-800 space-y-1 list-decimal list-inside">
              <li>Download the CSV template and fill in your file mappings</li>
              <li>Zip all your evidence files into a single ZIP archive</li>
              <li>Upload both the CSV and ZIP below</li>
              <li>Click Import — files will be matched by fileName</li>
            </ol>
          </div>

          {/* CSV Template */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-800">1. CSV Mapping File</h3>
              <button
                onClick={downloadTemplate}
                className="text-xs text-blue-600 hover:underline"
              >
                Download Template
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-2">
              Required columns: <code className="bg-slate-100 px-1 rounded">fileName</code>,{" "}
              <code className="bg-slate-100 px-1 rounded">controlId</code>. Optional:{" "}
              <code className="bg-slate-100 px-1 rounded">description</code>,{" "}
              <code className="bg-slate-100 px-1 rounded">collectedAt</code>
            </p>

            {/* Controls reference */}
            {controls.length > 0 && (
              <div className="mb-3 border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 border-b border-slate-200">
                  Available Control IDs
                </div>
                <div className="max-h-32 overflow-y-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {controls.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-1.5 font-mono text-slate-700">{c.id}</td>
                          <td className="px-3 py-1.5 font-semibold text-slate-600">{c.code}</td>
                          <td className="px-3 py-1.5 text-slate-600 truncate max-w-0 w-full">
                            {c.name}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button
              onClick={() => csvRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {csvFile ? `✓ ${csvFile.name}` : "Click to select CSV file"}
            </button>
            <input
              ref={csvRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* ZIP file */}
          <div>
            <h3 className="text-sm font-semibold text-slate-800 mb-2">2. ZIP Archive</h3>
            <p className="text-xs text-slate-500 mb-2">
              ZIP containing all evidence files. File names must match the{" "}
              <code className="bg-slate-100 px-1 rounded">fileName</code> column in your CSV.
            </p>
            <button
              onClick={() => zipRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-sm text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors"
            >
              {zipFile ? `✓ ${zipFile.name}` : "Click to select ZIP file"}
            </button>
            <input
              ref={zipRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex gap-4 text-sm font-semibold mb-3">
                <span className="text-green-700">✅ {result.successCount} succeeded</span>
                <span className="text-red-700">❌ {result.errorCount} failed</span>
                <span className="text-slate-600">⏭ {result.skippedCount} skipped</span>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {result.results.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 text-xs">
                    <span>{r.status === "success" ? "✅" : r.status === "error" ? "❌" : "⏭"}</span>
                    <span className="font-medium truncate">{r.fileName}</span>
                    {r.errorMessage && (
                      <span className="text-red-600 truncate">— {r.errorMessage}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={!csvFile || !zipFile || importing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {importing ? "Importing..." : "Import Files"}
          </button>
        </div>
      </div>
    </div>
  );
}
