"use client";

import { useRef, useState } from "react";
import { formatFileSize, isAllowedType, getMimeType } from "@/lib/file-utils";

interface DropZoneProps {
  files: File[];
  onFilesAdded: (files: File[]) => void;
  onFileRemoved: (index: number) => void;
}

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "📄",
  "image/png": "🖼",
  "image/jpeg": "🖼",
  "image/gif": "🖼",
  "image/webp": "🖼",
  "text/csv": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/msword": "📝",
  "application/zip": "🗜",
};

export default function DropZone({ files, onFilesAdded, onFileRemoved }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const newFiles = Array.from(e.dataTransfer.files).filter((f) =>
      isAllowedType(getMimeType(f.name))
    );
    if (newFiles.length > 0) onFilesAdded(newFiles);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []).filter((f) =>
      isAllowedType(getMimeType(f.name))
    );
    if (newFiles.length > 0) onFilesAdded(newFiles);
    // Reset input so the same file can be re-added if removed
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-blue-400 bg-blue-50"
            : "border-slate-300 hover:border-blue-300 hover:bg-slate-50"
        }`}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-sm font-medium text-slate-700">
          {files.length > 0 ? "Drop more files or click to browse" : "Drop evidence files here"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          PDF, PNG, JPG, GIF, WEBP, DOCX, XLSX, CSV, ZIP
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.xlsx,.csv,.zip"
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((file, idx) => {
            const mime = getMimeType(file.name);
            const icon = FILE_ICONS[mime] ?? "📎";
            return (
              <li
                key={`${file.name}-${idx}`}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2"
              >
                <span className="text-lg">{icon}</span>
                <span className="flex-1 text-sm text-slate-800 truncate">{file.name}</span>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {formatFileSize(file.size)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemoved(idx);
                  }}
                  className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
