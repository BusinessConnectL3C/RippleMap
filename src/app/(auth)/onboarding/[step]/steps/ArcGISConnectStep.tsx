"use client";

import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export function ArcGISConnectStep() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect your ArcGIS account</CardTitle>
        <CardDescription>
          We&apos;ll redirect you to ArcGIS Online to authorize access. This lets RippleMap display
          your maps and manage your group membership.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            Something went wrong connecting your ArcGIS account. Please try again.
          </div>
        )}

        <div className="rounded-lg border border-gray-200 p-4 space-y-2 text-sm text-gray-600">
          <p className="font-medium text-gray-900">What we&apos;ll access:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>View your maps and feature services</li>
            <li>Add you to your organization&apos;s group</li>
            <li>Read your ArcGIS profile information</li>
          </ul>
          <p className="text-xs text-gray-400 mt-2">
            We never store your ArcGIS password. Access can be revoked at any time.
          </p>
        </div>

        <a href="/api/onboarding/link-arcgis" className="block">
          <Button className="w-full gap-2">
            <ExternalLink className="h-4 w-4" />
            Connect with ArcGIS Online
          </Button>
        </a>
      </CardContent>
    </Card>
  );
}
