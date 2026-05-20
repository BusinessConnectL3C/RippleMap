import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle } from "lucide-react";

interface Props {
  arcgisUsername: string | null;
  orgId: string | null;
  tokenExpiry: Date | null;
}

export function AccountStatusWidget({ arcgisUsername, orgId, tokenExpiry }: Props) {
  const isLinked = !!arcgisUsername;
  const isExpired = tokenExpiry ? new Date(tokenExpiry) < new Date() : false;

  return (
    <Card>
      <CardContent className="p-6">
        <p className="text-sm font-medium text-gray-500 mb-3">ArcGIS Connection</p>
        {isLinked ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {isExpired ? (
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
              <Badge variant={isExpired ? "warning" : "success"}>
                {isExpired ? "Token Expired" : "Connected"}
              </Badge>
            </div>
            <p className="text-sm text-gray-700 font-medium">{arcgisUsername}</p>
            <p className="text-xs text-gray-400">{orgId}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <Badge variant="secondary">Not Connected</Badge>
            <p className="text-xs text-gray-400">
              Complete onboarding to link your ArcGIS account.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
