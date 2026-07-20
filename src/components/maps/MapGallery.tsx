"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { Map, LayoutDashboard, ExternalLink, Layers, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ItemIcon({ type }: { type: string }) {
  if (type === "Dashboard") return <LayoutDashboard className="h-6 w-6 text-brand" aria-hidden="true" />;
  if (type === "Web Experience") return <Layers className="h-6 w-6 text-brand" aria-hidden="true" />;
  return <Map className="h-6 w-6 text-brand" aria-hidden="true" />;
}

function externalUrl(item: ArcGISItem): string {
  if (item.url) return item.url;
  return `https://www.arcgis.com/apps/instant/${item.id}`;
}

export function MapGallery({ maps }: { maps: ArcGISItem[] }) {
  const [query, setQuery] = useState("");

  if (maps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-brand-subtle">
          <Map className="h-7 w-7 text-brand" aria-hidden="true" />
        </div>
        <p className="text-lg font-medium text-text-primary">No maps yet</p>
        <p className="text-sm text-text-secondary mt-1">
          Maps, dashboards, and experiences shared to your group will appear here.
        </p>
      </div>
    );
  }

  const filtered = query.trim()
    ? maps.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
    : maps;

  return (
    <div>
      {maps.length > 6 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search maps and apps…"
            className="pl-9"
            aria-label="Search maps and apps"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-secondary">No maps match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const isExternal = item.type === "Web Experience";
            const cardContent = (
              <Card interactive className="h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-subtle">
                      <ItemIcon type={item.type} />
                    </div>
                    {isExternal && (
                      <Badge variant="outline">
                        <ExternalLink className="h-3 w-3" /> New tab
                      </Badge>
                    )}
                  </div>
                  <h3 className="mt-3 font-medium text-text-primary truncate">{item.title}</h3>
                  {item.snippet && (
                    <p className="text-sm text-text-secondary mt-1 line-clamp-2">{item.snippet}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <Badge variant="secondary">{item.type}</Badge>
                    <span className="text-xs text-text-muted">
                      {new Date(item.modified).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );

            if (isExternal) {
              return (
                <a key={item.id} href={externalUrl(item)} target="_blank" rel="noopener noreferrer">
                  {cardContent}
                </a>
              );
            }

            return (
              <Link key={item.id} href={`/maps/${item.id}`}>
                {cardContent}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
