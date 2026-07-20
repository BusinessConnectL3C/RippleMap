"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  itemId: string;
  token: string;
  title: string;
}

const LOAD_TIMEOUT_MS = 15000;

export function ArcGISMapEmbed({ itemId, token, title }: Props) {
  const src = `https://www.arcgis.com/apps/mapviewer/index.html?webmap=${itemId}&token=${token}`;
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    const timeout = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 57px)" }}>
      {status !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-page">
          {status === "loading" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-secondary" role="status" aria-live="polite">
                Loading map…
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center max-w-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-subtle)]">
                <AlertCircle className="h-6 w-6 text-[var(--danger)]" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-text-primary" role="alert">
                This map couldn&apos;t be loaded.
              </p>
              <p className="text-sm text-text-secondary">
                Your ArcGIS connection may have expired.{" "}
                <Link href="/account" className="text-link hover:underline">
                  Reconnect your ArcGIS account
                </Link>
              </p>
            </div>
          )}
        </div>
      )}
      <iframe
        src={src}
        title={title}
        style={{ width: "100%", height: "100%", border: "none" }}
        allowFullScreen
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}
