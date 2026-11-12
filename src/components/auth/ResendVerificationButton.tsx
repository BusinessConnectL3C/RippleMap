"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResendVerificationButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-email/resend", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (data?.verified) {
        router.refresh();
        return;
      }
      if (!res.ok) {
        setError(data?.error ?? "We couldn't send the email. Please try again shortly.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("We couldn't send the email. Please try again shortly.");
      setState("idle");
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={resend} disabled={state !== "idle"}>
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {state === "sent" ? "Email sent" : "Send a new link"}
      </Button>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
