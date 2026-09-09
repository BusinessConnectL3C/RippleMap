import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  arcgisUsername: string | null;
  orgId: string | null;
}

export function AccountStatusWidget({ arcgisUsername, orgId }: Props) {
  const isLinked = !!arcgisUsername;

  return (
    <Card>
      <CardContent className="p-6">
        <p className="rm-eyebrow mb-3">ArcGIS Connection</p>
        {isLinked ? (
          <div className="space-y-2">
            <Badge variant="success" dot>
              Connected
            </Badge>
            <p className="text-sm text-text-primary font-medium">{arcgisUsername}</p>
            <p className="text-xs text-text-muted">{orgId}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="secondary">Not Connected</Badge>
            <p className="text-xs text-text-muted">
              Complete onboarding to link your ArcGIS account.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
