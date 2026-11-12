"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  orgId: string;
  initialName: string;
  initialType: "NONPROFIT" | "CORPORATE";
  initialArcgisGroupId: string | null;
  initialClickupListId: string | null;
  initialFeltProjectId: string | null;
  initialArcgisEnabled: boolean;
  initialMedia: { enabled: boolean; s3Bucket: string | null; s3Prefix: string | null };
  /** Shown as the placeholder for "shared bucket". */
  sharedBucketName: string;
  /** Why the current media setting is refused, if it is. */
  mediaProblem: string | null;
}

export function OrgEditForm({
  orgId,
  initialName,
  initialType,
  initialArcgisGroupId,
  initialClickupListId,
  initialFeltProjectId,
  initialArcgisEnabled,
  initialMedia,
  sharedBucketName,
  mediaProblem,
}: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [type, setType] = useState(initialType);
  const [arcgisGroupId, setArcgisGroupId] = useState(initialArcgisGroupId ?? "");
  const [clickupListId, setClickupListId] = useState(initialClickupListId ?? "");
  const [feltProjectId, setFeltProjectId] = useState(initialFeltProjectId ?? "");
  const [arcgisEnabled, setArcgisEnabled] = useState(initialArcgisEnabled);
  const [mediaEnabled, setMediaEnabled] = useState(initialMedia.enabled);
  const [s3Bucket, setS3Bucket] = useState(initialMedia.s3Bucket ?? "");
  const [s3Prefix, setS3Prefix] = useState(initialMedia.s3Prefix ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        feltProjectId: feltProjectId.trim() || null,
        arcgisEnabled,
        media: { enabled: mediaEnabled, s3Bucket: s3Bucket.trim() || null, s3Prefix: s3Prefix.trim() || null },
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
      </div>

      <div className="space-y-2">
        <Label htmlFor="feltProjectId">Felt Project ID</Label>
        <Input
          id="feltProjectId"
          value={feltProjectId}
          onChange={(e) => setFeltProjectId(e.target.value)}
          placeholder="Created automatically at registration"
          className="font-mono text-xs"
        />
        <p className="text-xs text-gray-600">
          Must be a <strong>private</strong> project. Found in Felt → project → settings, or created from the Felt maps
          card below.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-md border border-gray-200 p-3">
        <div>
          <Label htmlFor="arcgisEnabled">ArcGIS / Esri features</Label>
          <p className="text-xs text-gray-600">For orgs still using Survey123, Field Maps, or hosted feature services.</p>
        </div>
        <Switch id="arcgisEnabled" checked={arcgisEnabled} onCheckedChange={setArcgisEnabled} />
      </div>

      <div className="space-y-3 rounded-md border border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="mediaEnabled">Media page (S3)</Label>
            <p className="text-xs text-gray-600">Shows this org the files in its own S3 folder.</p>
          </div>
          <Switch id="mediaEnabled" checked={mediaEnabled} onCheckedChange={setMediaEnabled} />
        </div>
        {mediaProblem && (
          <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            Media is switched off for this org until fixed: {mediaProblem}
          </p>
        )}
        {mediaEnabled && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="s3Bucket">Bucket</Label>
              <Input
                id="s3Bucket"
                value={s3Bucket}
                onChange={(e) => setS3Bucket(e.target.value)}
                placeholder={`Shared: ${sharedBucketName}`}
                className="font-mono text-xs"
              />
              <p className="text-xs text-gray-600">Leave blank for the shared bucket, or enter this org&apos;s own bucket.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="s3Prefix">Folder (prefix)</Label>
              <Input
                id="s3Prefix"
                value={s3Prefix}
                onChange={(e) => setS3Prefix(e.target.value)}
                placeholder="orgs/goodjustice/"
                className="font-mono text-xs"
              />
              <p className="text-xs text-gray-600">Required in the shared bucket. The org sees only files under it.</p>
            </div>
          </div>
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
