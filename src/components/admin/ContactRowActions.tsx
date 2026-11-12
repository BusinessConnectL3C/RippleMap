"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconButton } from "@/components/ui/icon-button";
import { toast } from "@/hooks/use-toast";

type Status = "NEW" | "CONTACTED" | "CLOSED";

export function ContactRowActions({ id, status, name }: { id: string; status: Status; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call(method: "PATCH" | "DELETE", body?: object) {
    setBusy(true);
    const res = await fetch(`/api/admin/contacts/${id}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast({ variant: "danger", title: "That didn't work. Try again." });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Select value={status} disabled={busy} onValueChange={(v) => call("PATCH", { status: v })}>
        <SelectTrigger className="h-9 w-[130px]" aria-label={`Status for ${name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="NEW">New</SelectItem>
          <SelectItem value="CONTACTED">Contacted</SelectItem>
          <SelectItem value="CLOSED">Closed</SelectItem>
        </SelectContent>
      </Select>
      <IconButton
        label="Delete message"
        variant="ghost"
        disabled={busy}
        className="text-[var(--danger)]"
        icon={<Trash2 className="h-4 w-4" />}
        onClick={() => {
          if (confirm(`Delete the message from ${name}? This can't be undone.`)) call("DELETE");
        }}
      />
    </div>
  );
}
