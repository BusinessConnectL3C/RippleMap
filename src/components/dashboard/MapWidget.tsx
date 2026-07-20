import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, ArrowRight } from "lucide-react";

export function MapWidget({ maps }: { maps: ArcGISItem[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Maps</CardTitle>
        <Link href="/maps">
          <Button variant="ghost" size="sm" className="gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {maps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Map className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm text-text-secondary">No maps available yet</p>
            <p className="text-xs text-text-muted">Maps will appear here once added to your group</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {maps.map((map) => (
              <Link key={map.id} href={`/maps/${map.id}`}>
                <Card interactive className="group overflow-hidden">
                  <div className="h-20 bg-gradient-to-br from-brand/10 to-brand/20 flex items-center justify-center">
                    <Map className="h-6 w-6 text-brand/60 group-hover:text-brand transition-colors" />
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-text-primary truncate">{map.title}</p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
