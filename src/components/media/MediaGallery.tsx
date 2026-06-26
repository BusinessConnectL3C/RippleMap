"use client";

import { useState } from "react";
import { Download, X, ZoomIn } from "lucide-react";
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

export function MediaGallery({ files }: { files: S3FileInfo[] }) {
  const [lightbox, setLightbox] = useState<S3FileInfo | null>(null);

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {files.map((file) => (
          <MediaCard
            key={file.key}
            file={file}
            onPreview={isImage(file.filename) || isVideo(file.filename) ? () => setLightbox(file) : undefined}
          />
        ))}
      </div>

      {lightbox && (
        <Lightbox file={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

function MediaCard({
  file,
  onPreview,
}: {
  file: S3FileInfo;
  onPreview?: () => void;
}) {
  const canPreview = !!onPreview;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div
        className="relative aspect-square bg-gray-100 overflow-hidden cursor-pointer"
        onClick={onPreview}
      >
        {isImage(file.filename) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.downloadUrl}
            alt={file.filename}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : isVideo(file.filename) ? (
          <video
            src={file.downloadUrl}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileIcon filename={file.filename} />
          </div>
        )}

        {canPreview && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <ZoomIn className="h-8 w-8 text-white" />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 p-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-gray-800" title={file.filename}>
            {file.filename}
          </p>
          <p className="text-xs text-gray-400">
            {formatBytes(file.size)} · {formatDate(file.lastModified)}
          </p>
        </div>
        <a
          href={file.downloadUrl}
          download={file.filename}
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

function Lightbox({ file, onClose }: { file: S3FileInfo; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <button
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      <div
        className="relative flex max-h-full max-w-5xl flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage(file.filename) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.downloadUrl}
            alt={file.filename}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />
        ) : (
          <video
            src={file.downloadUrl}
            className="max-h-[80vh] max-w-full rounded-lg"
            controls
            autoPlay
          />
        )}

        <div className="flex items-center gap-4 text-white">
          <span className="text-sm">{file.filename}</span>
          <span className="text-sm text-white/60">{formatBytes(file.size)}</span>
          <a
            href={file.downloadUrl}
            download={file.filename}
            className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20 transition-colors"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
        </div>
      </div>
    </div>
  );
}

function FileIcon({ filename }: { filename: string }) {
  const e = ext(filename);
  return (
    <div className="flex flex-col items-center gap-1 text-gray-400">
      <div className="text-2xl font-bold uppercase">{e || "?"}</div>
      <div className="text-xs">file</div>
    </div>
  );
}
