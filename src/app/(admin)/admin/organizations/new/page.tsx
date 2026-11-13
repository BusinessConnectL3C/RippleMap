import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { NewOrgForm } from "@/components/admin/NewOrgForm";
import { isFeltConfigured } from "@/lib/felt/client";

export default function NewOrganizationPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="New organization" />
      <div className="flex-1 max-w-2xl space-y-4 p-6">
        <Link href="/admin/organizations" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
          <ChevronLeft className="h-4 w-4" /> All organizations
        </Link>
        <Card>
          <CardContent className="p-6">
            <NewOrgForm feltConfigured={isFeltConfigured()} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
