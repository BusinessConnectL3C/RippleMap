"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ProfileStep() {
  const router = useRouter();

  const handleContinue = () => {
    router.push("/onboarding/arcgis-connect");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome aboard!</CardTitle>
        <CardDescription>
          Your account has been created. Next, we&apos;ll connect your ArcGIS account so you can
          access your maps and data.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-[#EBF5FB] p-4 text-sm text-[#1B4F72]">
          <p className="font-medium mb-1">What you&apos;ll set up:</p>
          <ul className="list-disc list-inside space-y-1 text-[#1B4F72]/80">
            <li>Connect your ArcGIS Online account</li>
            <li>Join your organization&apos;s RippleMap group</li>
            <li>Access your maps, forms, and data</li>
          </ul>
        </div>
        <Button className="w-full" onClick={handleContinue}>
          Get Started
        </Button>
      </CardContent>
    </Card>
  );
}
