"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Map, FileText, HeadphonesIcon, CreditCard } from "lucide-react";
import { db } from "@/lib/db";

const features = [
  {
    icon: Map,
    title: "Maps",
    description: "View and interact with your organization's maps and spatial data.",
  },
  {
    icon: FileText,
    title: "Forms",
    description: "Create and edit Survey123 forms — add fields and manage options.",
  },
  {
    icon: HeadphonesIcon,
    title: "Support",
    description: "Submit support requests and track their status.",
  },
  {
    icon: CreditCard,
    title: "Billing",
    description: "View invoices and payment history.",
  },
];

export function ExploreStep() {
  const router = useRouter();

  const handleFinish = async () => {
    await fetch("/api/onboarding/complete", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re all set!</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="rounded-lg border border-gray-200 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[#1B4F72]" />
                  <span className="text-sm font-medium text-gray-900">{feature.title}</span>
                </div>
                <p className="text-xs text-gray-500">{feature.description}</p>
              </div>
            );
          })}
        </div>
        <Button className="w-full" onClick={handleFinish}>
          Go to Dashboard
        </Button>
      </CardContent>
    </Card>
  );
}
