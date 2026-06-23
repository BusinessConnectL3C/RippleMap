import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { Map, LayoutDashboard, ExternalLink, Layers } from "lucide-react";

function ItemIcon({ type }: { type: string }) {
  if (type === "Dashboard") return <LayoutDashboard className="h-10 w-10 text-[#1B4F72]/50 group-hover:text-[#1B4F72] transition-colors" />;
  if (type === "Web Experience") return <Layers className="h-10 w-10 text-[#1B4F72]/50 group-hover:text-[#1B4F72] transition-colors" />;
  return <Map className="h-10 w-10 text-[#1B4F72]/50 group-hover:text-[#1B4F72] transition-colors" />;
}

function externalUrl(item: ArcGISItem): string {
  if (item.url) return item.url;
  return `https://www.arcgis.com/apps/instant/${item.id}`;
}

export function MapGallery({ maps }: { maps: ArcGISItem[] }) {
  if (maps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Map className="h-14 w-14 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-700">No maps yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Maps, dashboards, and experiences shared to your group will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {maps.map((item) => {
        const isExternal = item.type === "Web Experience";
        const cardContent = (
          <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:border-[#1B4F72] transition-all cursor-pointer">
            <div className="h-36 bg-gradient-to-br from-[#1B4F72]/10 via-[#1B4F72]/15 to-[#2E86C1]/20 flex items-center justify-center relative">
              <ItemIcon type={item.type} />
              {isExternal && (
                <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-xs text-gray-500">
                  <ExternalLink className="h-3 w-3" /> New tab
                </span>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
              {item.snippet && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{item.snippet}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
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
  );
}
