import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  /** The viewer can see at least one map. */
  hasMaps: boolean;
  /** Names of the org's Field Editors (people holding a Felt seat). */
  fieldEditors: string[];
  /** Only set for orgs that also use ArcGIS. */
  arcgis?: { username: string | null };
}

export function AccountStatusWidget({ hasMaps, fieldEditors, arcgis }: Props) {
  return (
    <Card>
      <CardContent className="p-6">
        <p className="rm-eyebrow mb-3">Map Workspace</p>
        <div className="space-y-2">
          <Badge variant={hasMaps ? "success" : "secondary"} dot={hasMaps}>
            {hasMaps ? "Ready" : "Being set up"}
          </Badge>
          <p className="text-xs text-text-muted">
            {fieldEditors.length > 0
              ? `Field Editor: ${fieldEditors.join(", ")}`
              : "No Field Editor assigned yet"}
          </p>
          {arcgis && (
            <p className="text-xs text-text-muted">
              ArcGIS: {arcgis.username ? `connected as ${arcgis.username}` : "not connected"}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
