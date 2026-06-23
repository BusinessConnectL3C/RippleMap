"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

interface Props {
  orgId: string;
  initialName: string;
  initialType: "NONPROFIT" | "CORPORATE";
  initialArcgisGroupId: string | null;
}

export function OrgEditForm({ orgId, initialName, initialType, initialArcgisGroupId }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialType);
  const [arcgisGroupId, setArcgisGroupId] = useState(initialArcgisGroupId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const typeChanged = type !== initialType;

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    const res = await fetch(`/api/admin/organizations/${orgId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        type,
        arcgisGroupId: arcgisGroupId.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Save failed");
    } else {
      setSuccess(true);
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
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as "NONPROFIT" | "CORPORATE")}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
        >
          <option value="NONPROFIT">Nonprofit</option>
          <option value="CORPORATE">Corporate</option>
        </select>
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
        <p className="text-xs text-gray-500">
          Found in ArcGIS Online → Groups → [Group] → Overview URL.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-600">Saved.</p>
      )}

      <Button
        onClick={handleSave}
        disabled={saving || !name.trim()}
        className="bg-[#1B4F72] hover:bg-[#154060]"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Save changes
      </Button>
    </div>
  );
}
