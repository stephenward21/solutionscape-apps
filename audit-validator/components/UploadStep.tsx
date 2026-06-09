"use client";

import { useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import type { UploadedFile } from "@/lib/types";

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function fileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.startsWith("image/")) return "🖼️";
  return "📎";
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URL prefix (data:mime/type;base64,)
      resolve(result.split(",")[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadStep({
  files,
  onFilesChange,
  onBack,
  onNext,
}: {
  files: UploadedFile[];
  onFilesChange: (f: UploadedFile[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const newErrors: string[] = [];
    const newFiles: UploadedFile[] = [];

    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        newErrors.push(`${file.name}: unsupported type (use PNG, JPG, GIF, WEBP, or PDF)`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        newErrors.push(`${file.name}: exceeds 20MB limit`);
        continue;
      }
      const base64 = await readFileAsBase64(file);
      newFiles.push({ id: uuidv4(), name: file.name, size: file.size, mimeType: file.type, base64 });
    }

    setErrors(newErrors);
    onFilesChange([...files, ...newFiles]);
  }

  function removeFile(id: string) {
    onFilesChange(files.filter((f) => f.id !== id));
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-1">Upload Evidence Files</h2>
        <p className="text-sm text-slate-500 mb-6">
          Upload screenshots, PDFs, or images that demonstrate compliance. Supported: PNG, JPG, GIF,
          WEBP, PDF (max 20MB each).
        </p>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-4 ${
            dragging
              ? "border-brand-400 bg-brand-50"
              : "border-slate-200 hover:border-brand-300 hover:bg-slate-50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm font-medium text-slate-700">
            Drop files here or <span className="text-brand-600">click to browse</span>
          </p>
          <p className="text-xs text-slate-400 mt-1">PNG, JPG, GIF, WEBP, PDF · Max 20MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); }}
          />
        </div>

        {errors.length > 0 && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700 mb-4">
            {errors.map((e, i) => <p key={i}>{e}</p>)}
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              {files.length} file{files.length !== 1 ? "s" : ""} ready
            </p>
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3"
              >
                <span className="text-xl">{fileIcon(f.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{f.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(f.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(f.id)}
                  className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                  title="Remove"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-between mt-4">
        <button
          onClick={onBack}
          className="text-slate-500 hover:text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={files.length === 0}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-xl px-6 py-2.5 text-sm transition-colors"
        >
          Continue → ({files.length} file{files.length !== 1 ? "s" : ""})
        </button>
      </div>
    </div>
  );
}
