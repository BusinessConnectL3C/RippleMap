"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

interface Props {
  initialName: string;
  orgType: string;
}

export function OrganizationForm({ initialName, orgType }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setName(initialName);
    setError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/account/organization", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
      return;
    }
    setIsEditing(false);
    toast({ variant: "success", title: "Organization saved" });
    router.refresh();
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Organization</CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!isEditing ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="rm-eyebrow">Organization</span>
            <span className="font-medium text-text-primary">{initialName || "—"}</span>
            <span className="rm-eyebrow">Org Type</span>
            <span className="font-medium text-text-primary">{orgType || "—"}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input id="orgName" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {error && <div className="rounded-md bg-[var(--danger-subtle)] p-3 text-sm text-[var(--danger)]">{error}</div>}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving || !name.trim()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save changes
              </Button>
              <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </>
  );
}
