"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RotateCw } from "lucide-react";
import { Felt } from "@feltmaps/js-sdk";
import { Button } from "@/components/ui/button";

interface Props {
  feltMapId: string;
  title: string;
}

/** Re-mint this long before the token expires so the map never shows Felt's "refresh" prompt. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
/** Felt documents 12 h tokens; never schedule more than this out, in case of clock skew. */
const MAX_REFRESH_MS = 11 * 60 * 60 * 1000;
const MIN_REFRESH_MS = 60 * 1000;

/** Felt returns `expires_at` like "2026-10-06T21:04:11" with no zone: it's UTC. */
function parseExpiry(expiresAt: string): number {
  const hasZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(expiresAt);
  const ms = Date.parse(hasZone ? expiresAt : `${expiresAt}Z`);
  return Number.isNaN(ms) ? Date.now() + MAX_REFRESH_MS : ms;
}

type Status = "loading" | "ready" | "error" | "forbidden";

/**
 * Embeds a private Felt map using a per-user embed token from
 * /api/felt/maps/[id]/embed-token (which enforces RippleMap's permissions).
 * The token is re-minted, and the map re-embedded, shortly before it expires.
 */
export function FeltMapEmbed({ feltMapId, title }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  // Bumping this re-runs the embed effect (retry, or token refresh).
  const [generation, setGeneration] = useState(0);
  const retry = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("loading");

    (async () => {
      try {
        const res = await fetch(`/api/felt/maps/${encodeURIComponent(feltMapId)}/embed-token`, {
          method: "POST",
          cache: "no-store",
        });
        if (cancelled) return;
        if (res.status === 404 || res.status === 401) {
          setStatus("forbidden");
          return;
        }
        if (!res.ok) throw new Error(`Token request failed (${res.status})`);

        const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: string };
        if (cancelled) return;

        // Clear any previous iframe (retry/refresh, or React Strict Mode's double effect).
        container.replaceChildren();
        await Felt.embed(container, feltMapId, {
          token,
          uiControls: {
            // Felt's full-screen button opens felt.com in a new tab, where a
            // portal user has no access to this private map.
            fullScreenButton: false,
            cooperativeGestures: false,
          },
        });
        if (cancelled) return;

        setStatus("ready");

        const delay = Math.min(
          MAX_REFRESH_MS,
          Math.max(MIN_REFRESH_MS, parseExpiry(expiresAt) - Date.now() - REFRESH_MARGIN_MS)
        );
        refreshTimer = setTimeout(() => setGeneration((g) => g + 1), delay);
      } catch (err) {
        if (cancelled) return;
        console.error("Felt embed failed:", err);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      container.replaceChildren();
    };
  }, [feltMapId, generation]);

  return (
    <div className="relative w-full h-full min-h-[600px]">
      {/* The SDK inserts its iframe here; it needs an explicit height. */}
      <div ref={containerRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0" aria-label={title} />

      {status !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-page">
          {status === "loading" && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-text-muted" aria-hidden="true" />
              <p className="text-sm text-text-secondary" role="status" aria-live="polite">
                Loading map…
              </p>
            </>
          )}
          {status === "forbidden" && (
            <div className="flex flex-col items-center gap-2 px-4 text-center max-w-sm">
              <AlertCircle className="h-6 w-6 text-text-muted" aria-hidden="true" />
              <p className="text-sm font-medium text-text-primary" role="alert">
                You don&apos;t have access to this map.
              </p>
              <p className="text-sm text-text-secondary">Ask an owner or admin of your organization to share it with you.</p>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 px-4 text-center max-w-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--danger-subtle)]">
                <AlertCircle className="h-6 w-6 text-[var(--danger)]" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-text-primary" role="alert">
                This map couldn&apos;t be loaded.
              </p>
              <Button variant="outline" size="sm" onClick={retry}>
                <RotateCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
