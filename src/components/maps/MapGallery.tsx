"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { Map, LayoutDashboard, ExternalLink, Layers, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

function ItemIcon({ type }: { type: string }) {
  if (type === "Dashboard") return <LayoutDashboard className="h-10 w-10 text-brand/50 group-hover:text-brand transition-colors" />;
  if (type === "Web Experience") return <Layers className="h-10 w-10 text-brand/50 group-hover:text-brand transition-colors" />;
  return <Map className="h-10 w-10 text-brand/50 group-hover:text-brand transition-colors" />;
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
        <Map className="h-14 w-14 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-700">No maps yet</p>
        <p className="text-sm text-gray-600 mt-1">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
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
        <p className="py-10 text-center text-sm text-gray-600">No maps match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => {
            const isExternal = item.type === "Web Experience";
            const cardContent = (
              <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:border-brand transition-all cursor-pointer">
                <div className="h-36 bg-gradient-to-br from-brand/10 via-brand/15 to-accent/20 flex items-center justify-center relative">
                  <ItemIcon type={item.type} />
                  {isExternal && (
                    <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs text-gray-600">
                      <ExternalLink className="h-3 w-3" /> New tab
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
                  {item.snippet && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{item.snippet}</p>
                  )}
                  <p className="text-xs text-gray-600 mt-2">
                    {item.type} · {new Date(item.modified).toLocaleDateString()}
                  </p>
                </div>
              </div>
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
