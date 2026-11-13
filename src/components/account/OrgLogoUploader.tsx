"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 2 * 1024 * 1024;

/** Upload, replace or remove an organization's logo (owners/admins of the org, or RM Staff). */
export function OrgLogoUploader({ orgId, logoUrl }: { orgId: string; logoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  async function upload(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      toast({ variant: "danger", title: "Use a PNG, JPG or WebP image" });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ variant: "danger", title: "Logos can be up to 2 MB" });
      return;
    }
    setBusy("upload");
    try {
      const start = await fetch(`/api/orgs/${orgId}/logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: file.type, sizeBytes: file.size }),
      });
      const data = await start.json().catch(() => null);
      if (!start.ok) throw new Error(data?.error ?? "Couldn't start the upload");
      const put = await fetch(data.putUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("The upload failed. Try again.");
      const done = await fetch(`/api/orgs/${orgId}/logo/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: data.key }),
      });
      if (!done.ok) throw new Error((await done.json().catch(() => null))?.error ?? "Couldn't save the logo");
      toast({ variant: "success", title: "Logo updated" });
      router.refresh();
    } catch (err) {
      toast({ variant: "danger", title: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!confirm("Remove the organization's logo?")) return;
    setBusy("remove");
    const res = await fetch(`/api/orgs/${orgId}/logo`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) {
      toast({ variant: "danger", title: "Couldn't remove the logo" });
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-16 w-28 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-page p-1.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- same-origin redirect to a signed URL
          <img src={logoUrl} alt="Organization logo" className="max-h-full max-w-full object-contain" />
        ) : (
          <Building2 className="h-6 w-6 text-text-muted" aria-hidden="true" />
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy !== null}
            onClick={() => input.current?.click()}
          >
            {busy === "upload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {logoUrl ? "Replace logo" : "Upload logo"}
          </Button>
          {logoUrl && (
            <Button type="button" size="sm" variant="ghost" className="gap-1.5" disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-text-muted">PNG, JPG or WebP, up to 2 MB. A wide logo on a transparent background works best.</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        aria-label="Logo file"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
        }}
      />
    </div>
  );
}
