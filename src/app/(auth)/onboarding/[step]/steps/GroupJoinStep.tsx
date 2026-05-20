"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export function GroupJoinStep() {
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          ArcGIS Account Connected
        </CardTitle>
        <CardDescription>
          Your ArcGIS account has been linked and you&apos;ve been added to your
          organization&apos;s RippleMap group.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-800">
          <p className="font-medium mb-1">Setup complete:</p>
          <ul className="list-disc list-inside space-y-1 text-green-700">
            <li>ArcGIS account linked</li>
            <li>Added to your RippleMap group</li>
            <li>Maps and forms are now available</li>
          </ul>
        </div>
        <Button className="w-full" onClick={() => router.push("/onboarding/explore")}>
          Continue to Tour
        </Button>
      </CardContent>
    </Card>
  );
}
