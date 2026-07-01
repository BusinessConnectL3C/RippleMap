"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, X, ChevronLeft, ChevronRight } from "lucide-react";
import { S3FileInfo } from "@/lib/aws/s3";

const IMAGE_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]);
const VIDEO_EXTS = new Set(["mp4", "mov", "webm"]);

function ext(filename: string) {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(filename: string) {
  return IMAGE_EXTS.has(ext(filename));
}

function isVideo(filename: string) {
  return VIDEO_EXTS.has(ext(filename));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function basename(filename: string) {
  return filename.split("/").pop() ?? filename;
}

export function MediaGallery({ files }: { files: S3FileInfo[] }) {
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Extract unique folders sorted alphabetically
  const folders = Array.from(new Set(files.map((f) => f.folder)))
    .filter(Boolean)
    .sort();

  const filtered = activeFolder === "all"
    ? files
    : files.filter((f) => f.folder === activeFolder);

  const previewable = filtered.filter((f) => isImage(f.filename) || isVideo(f.filename));

  function openLightbox(file: S3FileInfo) {
    const idx = previewable.findIndex((f) => f.key === file.key);
    if (idx !== -1) setLightboxIndex(idx);
  }

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);

  const prev = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i - 1 + previewable.length) % previewable.length : null));
  }, [previewable.length]);

  const next = useCallback(() => {
    setLightboxIndex((i) => (i !== null ? (i + 1) % previewable.length : null));
  }, [previewable.length]);

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

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <p className="text-lg font-medium">No media files found</p>
        <p className="text-sm mt-1">Files uploaded to your media bucket will appear here.</p>
      </div>
    );
  }

  return (
    <>
      {/* Folder filter tabs */}
      {folders.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFolder("all")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeFolder === "all"
                ? "bg-[#1B4F72] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All ({files.length})
          </button>
          {folders.map((folder) => {
            const count = files.filter((f) => f.folder === folder).length;
            return (
              <button
                key={folder}
                onClick={() => setActiveFolder(folder)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeFolder === folder
                    ? "bg-[#1B4F72] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {folder} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {filtered.map((file) => (
          <MediaCard
            key={file.key}
            file={file}
            onPreview={isImage(file.filename) || isVideo(file.filename) ? () => openLightbox(file) : undefined}
          />
        ))}
      </div>

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

function MediaCard({ file, onPreview }: { file: S3FileInfo; onPreview?: () => void }) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div
        className="relative aspect-square cursor-pointer overflow-hidden bg-gray-100"
        onClick={onPreview}
      >
        {isImage(file.filename) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.viewUrl}
            alt={basename(file.filename)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : isVideo(file.filename) ? (
          <video src={file.viewUrl} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-2xl font-bold uppercase">{ext(file.filename) || "?"}</div>
              <div className="text-xs">file</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-800" title={file.filename}>
            {basename(file.filename)}
          </p>
          <p className="text-xs text-gray-400">
            {formatBytes(file.size)} · {formatDate(file.lastModified)}
          </p>
        </div>
        <a
          href={file.downloadUrl}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          title="Download"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}

function Lightbox({
  file,
  index,
  total,
  onClose,
  onPrev,
  onNext,
}: {
  file: S3FileInfo;
  index: number;
  total: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
      {total > 1 && (
        <button
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="Previous"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Next */}
      {total > 1 && (
        <button
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="Next"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Content */}
      <div
        className="flex max-h-screen w-full max-w-5xl flex-col items-center gap-4 px-20 py-16"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 flex-1 items-center justify-center w-full">
          {isImage(file.filename) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={file.key}
              src={file.viewUrl}
              alt={basename(file.filename)}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
            />
          ) : (
            <video
              key={file.key}
              src={file.viewUrl}
              className="max-h-[75vh] max-w-full rounded-lg"
              controls
              autoPlay
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center gap-4 text-white">
          <span className="text-sm opacity-60">{index + 1} / {total}</span>
          <span className="text-sm font-medium">{basename(file.filename)}</span>
          <span className="text-sm opacity-60">{formatBytes(file.size)}</span>
          <a
            href={file.downloadUrl}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}
