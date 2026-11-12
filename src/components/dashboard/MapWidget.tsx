import Link from "next/link";
import { ArrowRight, LayoutDashboard, Map } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LocalTime } from "@/components/ui/local-time";

export interface MapWidgetItem {
  key: string;
  title: string;
  href: string;
  kind: "map" | "dashboard";
  thumbnailUrl?: string;
  /** ISO time and what it means; see src/lib/felt/activity.ts. */
  activity?: { at: string; kind: "data" | "added" | "modified" };
}

const ACTIVITY_LABEL = { data: "Data updated", added: "Added", modified: "Updated" } as const;

export function MapWidget({ maps }: { maps: MapWidgetItem[] }) {
  return (
    <section aria-labelledby="recent-maps" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="recent-maps" className="font-display text-xl font-bold text-text-primary">
          Recent maps
        </h2>
        <Link href="/maps" className="inline-flex items-center gap-1 text-sm font-medium text-link hover:underline">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {maps.length === 0 ? (
        <Card className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-subtle">
            <Map className="h-6 w-6 text-brand" aria-hidden="true" />
          </div>
          <p className="font-medium text-text-primary">No maps yet</p>
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            Maps shared with you will appear here. If you expected one, ask an owner or admin of your organization.
          </p>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {maps.map((map) => {
            const Icon = map.kind === "dashboard" ? LayoutDashboard : Map;
            return (
              <li key={map.key}>
                <Link href={map.href} className="group block h-full rounded-lg text-inherit hover:text-inherit hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <Card interactive className="flex h-full flex-col overflow-hidden">
                    {map.thumbnailUrl ? (
                      // Plain <img>: same-origin redirect to a short-lived signed S3 URL.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={map.thumbnailUrl}
                        alt=""
                        loading="lazy"
                        className="aspect-[16/10] w-full border-b border-border bg-surface-page object-cover"
                      />
                    ) : (
                      <div className="flex aspect-[16/10] w-full items-center justify-center border-b border-border bg-brand-subtle">
                        <Icon className="h-8 w-8 text-brand/60 transition-colors group-hover:text-brand" aria-hidden="true" />
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-1 p-4">
                      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-text-primary">{map.title}</h3>
                      <p className="mt-auto flex flex-wrap items-center gap-x-1.5 text-xs text-text-muted">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>{map.kind === "dashboard" ? "Dashboard" : "Map"}</span>
                        {map.activity && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {ACTIVITY_LABEL[map.activity.kind]} <LocalTime iso={map.activity.at} />
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
