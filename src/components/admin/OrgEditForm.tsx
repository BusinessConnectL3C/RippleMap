"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  orgId: string;
  initialName: string;
  initialType: "NONPROFIT" | "CORPORATE";
  initialArcgisGroupId: string | null;
  initialClickupListId: string | null;
}

export function OrgEditForm({
  orgId,
  initialName,
  initialType,
  initialArcgisGroupId,
  initialClickupListId,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialType);
  const [arcgisGroupId, setArcgisGroupId] = useState(initialArcgisGroupId ?? "");
  const [clickupListId, setClickupListId] = useState(initialClickupListId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeChanged = type !== initialType;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        arcgisGroupId: arcgisGroupId.trim() || null,
        clickupListId: clickupListId.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Save failed");
    } else {
      toast({ variant: "success", title: "Organization saved" });
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Organization Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Organization Type</Label>
        <Select value={type} onValueChange={(value) => setType(value as "NONPROFIT" | "CORPORATE")}>
          <SelectTrigger id="type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONPROFIT">Nonprofit</SelectItem>
            <SelectItem value="CORPORATE">Corporate</SelectItem>
          </SelectContent>
        </Select>
        {typeChanged && (
          <p className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
            Changing the org type will reset this org&apos;s onboarding progress.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="arcgisGroupId">ArcGIS Group ID</Label>
        <Input
          id="arcgisGroupId"
          value={arcgisGroupId}
          onChange={(e) => setArcgisGroupId(e.target.value)}
          placeholder="Paste group ID from ArcGIS Online"
          className="font-mono text-xs"
        />
        <p className="text-xs text-gray-600">
          Found in ArcGIS Online → Groups → [Group] → Overview URL.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="clickupListId">ClickUp List ID</Label>
        <Input
          id="clickupListId"
          value={clickupListId}
          onChange={(e) => setClickupListId(e.target.value)}
          placeholder="Paste list ID from ClickUp"
          className="font-mono text-xs"
        />
        <p className="text-xs text-gray-600">
          Support tickets for this org are sent here. Found in ClickUp → List → Settings.
        </p>
      </div>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Button onClick={handleSave} disabled={saving || !name.trim()}>
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Save changes
      </Button>
    </div>
  );
}
