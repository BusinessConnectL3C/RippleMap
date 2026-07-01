"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { S3FileInfo } from "@/lib/aws/s3";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);

function ext(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}
function isImage(filename: string) { return IMAGE_EXTS.has(ext(filename)); }
function isVideo(filename: string) { return VIDEO_EXTS.has(ext(filename)); }
function basename(filename: string) { return filename.split("/").pop() ?? filename; }

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function MediaGallery() {
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [files, setFiles] = useState<S3FileInfo[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Load folder list and the first page once on mount
  useEffect(() => {
    fetch("/api/media/folders")
      .then((r) => r.json())
      .then((data) => setFolders(data.folders ?? []));
    fetchPage(null, "", true);
  }, []);

  function fetchPage(cursor: string | null, prefix: string, replace: boolean) {
    setLoading(true);
    const params = new URLSearchParams({ prefix });
    if (cursor) params.set("cursor", cursor);
    fetch(`/api/media/files?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setFiles((prev) => replace ? data.files : [...prev, ...data.files]);
        setNextCursor(data.nextCursor ?? null);
      })
      .finally(() => setLoading(false));
  }

  function selectFolder(folder: string) {
    setActiveFolder(folder);
    setFiles([]);
    setNextCursor(null);
    fetchPage(null, folder === "all" ? "" : folder + "/", true);
  }

  function loadMore() {
    if (!nextCursor || loading) return;
    fetchPage(nextCursor, activeFolder === "all" ? "" : activeFolder + "/", false);
  }

  const previewable = files.filter((f) => isImage(f.filename) || isVideo(f.filename));

  function openLightbox(file: S3FileInfo) {
    const idx = previewable.findIndex((f) => f.key === file.key);
    if (idx !== -1) setLightboxIndex(idx);
  }

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(() => setLightboxIndex((i) => i !== null ? (i - 1 + previewable.length) % previewable.length : null), [previewable.length]);
  const next = useCallback(() => setLightboxIndex((i) => i !== null ? (i + 1) % previewable.length : null), [previewable.length]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, closeLightbox, prev, next]);

  return (
    <>
      {/* Folder tabs */}
      {folders.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <FolderTab label="All" active={activeFolder === "all"} onClick={() => selectFolder("all")} />
          {folders.map((f) => (
            <FolderTab key={f} label={f} active={activeFolder === f} onClick={() => selectFolder(f)} />
          ))}
        </div>
      )}

      {/* Grid */}
      {files.length === 0 && loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <p className="text-sm">Loading...</p>
        </div>
      ) : files.length === 0 ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <p className="text-sm">No files found.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {files.map((file) => (
              <MediaCard
                key={file.key}
                file={file}
                onPreview={isImage(file.filename) || isVideo(file.filename) ? () => openLightbox(file) : undefined}
              />
            ))}
          </div>

          {nextCursor && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}

          {!nextCursor && files.length > 0 && (
            <p className="mt-6 text-center text-xs text-gray-400">{files.length} file{files.length !== 1 ? "s" : ""}</p>
          )}
        </>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && previewable[lightboxIndex] && (
        <Lightbox
          file={previewable[lightboxIndex]}
          index={lightboxIndex}
          total={previewable.length}
          onClose={closeLightbox}
          onPrev={prev}
          onNext={next}
        />
      )}
    </>
  );
}

function FolderTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-[#1B4F72] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );
}

function MediaCard({ file, onPreview }: { file: S3FileInfo; onPreview?: () => void }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-square cursor-pointer overflow-hidden bg-gray-100" onClick={onPreview}>
        {isImage(file.filename) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.viewUrl} alt={basename(file.filename)} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : isVideo(file.filename) ? (
          <video src={file.viewUrl} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-2xl font-bold uppercase">{ext(file.filename) || "?"}</div>
              <div className="text-xs">file</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-800" title={file.filename}>{basename(file.filename)}</p>
          <p className="text-xs text-gray-400">{formatBytes(file.size)} · {formatDate(file.lastModified)}</p>
        </div>
        <a href={file.downloadUrl} className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors" title="Download" onClick={(e) => e.stopPropagation()}>
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function Lightbox({ file, index, total, onClose, onPrev, onNext }: {
  file: S3FileInfo; index: number; total: number;
  onClose: () => void; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={onClose}>
      <button className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors" onClick={onClose}>
        <X className="h-5 w-5" />
      </button>
      {total > 1 && (
        <button className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); onPrev(); }}>
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {total > 1 && (
        <button className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors" onClick={(e) => { e.stopPropagation(); onNext(); }}>
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
      <div className="flex max-h-screen w-full max-w-5xl flex-col items-center gap-4 px-20 py-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex min-h-0 flex-1 items-center justify-center w-full">
          {isImage(file.filename) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={file.key} src={file.viewUrl} alt={basename(file.filename)} className="max-h-[75vh] max-w-full rounded-lg object-contain" />
          ) : (
            <video key={file.key} src={file.viewUrl} className="max-h-[75vh] max-w-full rounded-lg" controls autoPlay />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4 text-white">
          <span className="text-sm opacity-60">{index + 1} / {total}</span>
          <span className="text-sm font-medium">{basename(file.filename)}</span>
          <span className="text-sm opacity-60">{formatBytes(file.size)}</span>
          <a href={file.downloadUrl} className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 transition-colors" onClick={(e) => e.stopPropagation()}>
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
