import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { Map } from "lucide-react";

export function MapGallery({ maps }: { maps: ArcGISItem[] }) {
  if (maps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Map className="h-14 w-14 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-700">No maps yet</p>
        <p className="text-sm text-gray-400 mt-1">
          Maps shared to your group will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {maps.map((map) => (
        <Link key={map.id} href={`/maps/${map.id}`}>
          <div className="group rounded-xl border border-gray-200 bg-white overflow-hidden hover:shadow-md hover:border-[#1B4F72] transition-all cursor-pointer">
            <div className="h-36 bg-gradient-to-br from-[#1B4F72]/10 via-[#1B4F72]/15 to-[#2E86C1]/20 flex items-center justify-center">
              <Map className="h-10 w-10 text-[#1B4F72]/50 group-hover:text-[#1B4F72] transition-colors" />
            </div>
            <div className="p-4">
              <h3 className="font-medium text-gray-900 truncate">{map.title}</h3>
              {map.snippet && (
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{map.snippet}</p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {new Date(map.modified).toLocaleDateString()}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
