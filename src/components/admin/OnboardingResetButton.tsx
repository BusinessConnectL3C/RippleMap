"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export function OnboardingResetButton({ orgId }: { orgId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!confirm("Reset onboarding for this org? They will need to complete it again.")) return;
    setLoading(true);
    await fetch(`/api/admin/organizations/${orgId}/onboarding`, { method: "POST" });
    setLoading(false);
    setDone(true);
    router.refresh();
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleReset}
      disabled={loading}
      className="text-red-600 border-red-200 hover:bg-red-50"
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
      {done ? "Reset" : "Reset onboarding"}
    </Button>
  );
}
