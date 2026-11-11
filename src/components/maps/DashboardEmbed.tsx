"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, AlertCircle } from "lucide-react";

interface Props {
  itemId: string;
  /**
   * The signed-in user's own ArcGIS token (getUserToken). It ends up in the
   * iframe URL, visible to the user — never pass BC's app/admin tokens.
   */
  token: string;
  title: string;
}

const LOAD_TIMEOUT_MS = 15000;

export function DashboardEmbed({ itemId, token, title }: Props) {
  const src = `https://www.arcgis.com/apps/dashboards/${itemId}?token=${token}`;
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    const timeout = setTimeout(() => setStatus((s) => (s === "loading" ? "error" : s)), LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="relative w-full h-full min-h-[600px]">
      {status !== "loaded" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-page">
          {status === "loading" ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-secondary" role="status" aria-live="polite">
                Loading dashboard…
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 px-4 text-center max-w-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-subtle)]">
                <AlertCircle className="h-6 w-6 text-[var(--danger)]" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-text-primary" role="alert">
                This dashboard couldn&apos;t be loaded.
              </p>
              <p className="text-sm text-text-secondary">
                Your ArcGIS connection may have expired, or your ArcGIS account may not have been added to your
                organization&apos;s group yet.{" "}
                <Link href="/account" className="text-link hover:underline">
                  Reconnect your ArcGIS account
                </Link>{" "}
                or{" "}
                <Link href="/support/new" className="text-link hover:underline">
                  contact support
                </Link>
                .
              </p>
            </div>
          )}
        </div>
      )}
      <iframe
        src={src}
        title={title}
        className="w-full h-full border-0"
        allowFullScreen
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </div>
  );
}
