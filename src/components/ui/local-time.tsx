"use client";

import { useSyncExternalStore } from "react";

const FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

const noopSubscribe = () => () => {};

/**
 * A date and time in the viewer's own time zone. The server renders in UTC,
 * so the text only appears in the browser, after hydration.
 */
export function LocalTime({ iso, className }: { iso: string; className?: string }) {
  const inBrowser = useSyncExternalStore(noopSubscribe, () => true, () => false);
  let text = " ";
  if (inBrowser) {
    const date = new Date(iso);
    const opts = date.getFullYear() === new Date().getFullYear() ? { ...FORMAT, year: undefined } : FORMAT;
    text = date.toLocaleString(undefined, opts);
  }
  return (
    <time dateTime={iso} className={className}>
      {text}
    </time>
  );
}
