"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Camera, Check, Loader2, Maximize2, Minimize2, RotateCw } from "lucide-react";
import { Felt, type FeltController } from "@feltmaps/js-sdk";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  feltMapId: string;
  title: string;
  /** Org owners/admins and BC staff can save the current view as the map's thumbnail. */
  canSetThumbnail?: boolean;
}

/** Must match THUMBNAIL_SIZE in src/lib/felt/thumbnails.ts. */
const THUMBNAIL_W = 800;
const THUMBNAIL_H = 500;

type ThumbStatus = "idle" | "saving" | "saved" | "error";

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
export function FeltMapEmbed({ feltMapId, title, canSetThumbnail = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  // Browser fullscreen where supported; otherwise (e.g. iPhone Safari) the map
  // is pinned over the whole window instead.
  const [fullscreen, setFullscreen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const expanded = fullscreen || pinned;

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!pinned) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPinned(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pinned]);

  async function toggleFullscreen() {
    const frame = frameRef.current;
    if (!frame) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }
    if (pinned) {
      setPinned(false);
      return;
    }
    if (document.fullscreenEnabled && frame.requestFullscreen) {
      try {
        await frame.requestFullscreen();
        return;
      } catch {
        // fall through to the in-window version
      }
    }
    setPinned(true);
  }

  const [status, setStatus] = useState<Status>("loading");
  const controllerRef = useRef<FeltController | null>(null);
  const [thumb, setThumb] = useState<ThumbStatus>("idle");
  const [thumbError, setThumbError] = useState<string | null>(null);

  async function saveThumbnailView() {
    const felt = controllerRef.current;
    const container = containerRef.current;
    if (!felt || !container) return;
    setThumb("saving");
    setThumbError(null);
    try {
      const { center, zoom } = await felt.getViewport();
      // The thumbnail canvas is smaller than this viewer. Lower the zoom by the
      // size ratio so the thumbnail frames about the same area you see now.
      const scale = Math.min(THUMBNAIL_W / container.clientWidth, THUMBNAIL_H / container.clientHeight);
      const thumbZoom = Math.min(23, Math.max(1, zoom + Math.log2(scale)));
      const res = await fetch(`/api/felt/maps/${encodeURIComponent(feltMapId)}/thumbnail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: center.latitude, longitude: center.longitude, zoom: thumbZoom }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Thumbnail update failed");
      }
      setThumb("saved");
      setTimeout(() => setThumb("idle"), 4000);
    } catch (err) {
      setThumb("error");
      setThumbError(err instanceof Error ? err.message : "Thumbnail update failed");
    }
  }
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
        controllerRef.current = null;
        const felt = await Felt.embed(container, feltMapId, {
          token,
          uiControls: {
            // Felt's full-screen button opens felt.com in a new tab, where a
            // portal user has no access to this private map.
            fullScreenButton: false,
            cooperativeGestures: false,
          },
        });
        if (cancelled) return;

        controllerRef.current = felt;
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
    <div
      ref={frameRef}
      className={cn(
        "relative w-full bg-surface-page",
        pinned ? "fixed inset-0 z-[60] h-dvh" : fullscreen ? "h-full" : "h-full min-h-[600px]"
      )}
    >
      {/* The SDK inserts its iframe here; it needs an explicit height. */}
      <div ref={containerRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0" aria-label={title} />

      {status === "ready" && (
        <div className="absolute right-3 top-3 z-10 flex max-w-xs flex-col items-end gap-1">
          <TooltipProvider delayDuration={200}>
            <div className="flex gap-2">
              {canSetThumbnail && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 w-9 p-0 bg-surface-card shadow-sm"
                      disabled={thumb === "saving"}
                      onClick={saveThumbnailView}
                      aria-label={
                        thumb === "saving"
                          ? "Saving preview image"
                          : thumb === "saved"
                            ? "Preview image updated"
                            : "Use this view as the map's preview image"
                      }
                    >
                      {thumb === "saving" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : thumb === "saved" ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={expanded ? "bottom" : "left"} className="max-w-[16rem]">
                    {thumb === "saving"
                      ? "Saving the preview image…"
                      : thumb === "saved"
                        ? "Preview image updated"
                        : "Use this view as the map's preview image. Pan and zoom first, then click."}
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-9 p-0 bg-surface-card shadow-sm"
                    onClick={toggleFullscreen}
                    aria-label={expanded ? "Exit full screen" : "Full screen"}
                    aria-pressed={expanded}
                  >
                    {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side={expanded ? "bottom" : "left"}>
                  {expanded ? "Exit full screen (Esc)" : "Full screen"}
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          {thumb === "saving" && (
            <p className="rounded bg-surface-card px-2 py-1 text-xs text-text-secondary shadow-sm">This can take up to a minute.</p>
          )}
          {thumb === "error" && thumbError && (
            <p className="rounded bg-surface-card px-2 py-1 text-xs text-[var(--danger)] shadow-sm" role="alert">
              {thumbError}
            </p>
          )}
        </div>
      )}

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
