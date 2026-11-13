"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type FeltChoice = "NEW" | "EXISTING" | "NONE";

interface Created {
  id: string;
  inviteUrl: string | null;
  emailSent: boolean;
  warnings: string[];
}

/** RM Staff: create an organization by hand, with its Felt project and optional Owner invite. */
export function NewOrgForm({ feltConfigured }: { feltConfigured: boolean }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"NONPROFIT" | "CORPORATE">("NONPROFIT");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [felt, setFelt] = useState<FeltChoice>(feltConfigured ? "NEW" : "NONE");
  const [existing, setExisting] = useState("");
  const [clickup, setClickup] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        type,
        ownerEmail,
        felt,
        existingFeltProject: felt === "EXISTING" ? existing : undefined,
        createClickUpList: clickup,
      }),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);
    if (!res.ok) {
      setError({ message: data?.error ?? "Couldn't create the organization.", field: data?.field });
      return;
    }
    if (!data.inviteUrl && data.warnings.length === 0) {
      router.push(`/admin/organizations/${data.id}`);
      return;
    }
    setCreated(data);
  }

  if (created) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-medium text-gray-900">
          <Check className="h-5 w-5 text-[var(--success)]" /> {name} was created.
        </p>
        {created.inviteUrl && (
          <div className="space-y-1.5">
            <p className="text-sm text-gray-700">
              {created.emailSent
                ? `An Owner invite was emailed to ${ownerEmail}. The link is valid for 7 days:`
                : `Send this Owner invite link to ${ownerEmail}. It's valid for 7 days:`}
            </p>
            <div className="flex gap-2">
              <Input readOnly value={created.inviteUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={async () => {
                  await navigator.clipboard.writeText(created.inviteUrl!);
                  setCopied(true);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy
              </Button>
            </div>
          </div>
        )}
        {created.warnings.map((w) => (
          <p key={w} className="rounded-md bg-[var(--warning-subtle)] p-3 text-sm text-gray-800">
            {w}
          </p>
        ))}
        <Button onClick={() => router.push(`/admin/organizations/${created.id}`)}>Open the organization</Button>
      </div>
    );
  }

  const fieldError = (f: string) => (error?.field === f ? error.message : null);

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
        <div className="space-y-1.5">
          <Label htmlFor="org-name">Organization name *</Label>
          <Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} aria-invalid={!!fieldError("name")} />
          {fieldError("name") && <p className="text-xs text-[var(--danger)]">{fieldError("name")}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="org-type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="org-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONPROFIT">Nonprofit</SelectItem>
              <SelectItem value="CORPORATE">Corporate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="owner-email">Owner&apos;s email</Label>
        <Input
          id="owner-email"
          type="email"
          value={ownerEmail}
          onChange={(e) => setOwnerEmail(e.target.value)}
          placeholder="Optional: they'll get an invite to set up their account"
          aria-invalid={!!fieldError("ownerEmail")}
        />
        {fieldError("ownerEmail") ? (
          <p className="text-xs text-[var(--danger)]">{fieldError("ownerEmail")}</p>
        ) : (
          <p className="text-xs text-gray-500">Leave empty to invite people later from the org page.</p>
        )}
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-gray-900">Felt project</legend>
        {!feltConfigured && <p className="text-xs text-gray-500">Felt isn&apos;t configured (FELT_API_TOKEN), so no project can be set up.</p>}
        <RadioGroup value={felt} onValueChange={(v) => setFelt(v as FeltChoice)} disabled={!feltConfigured}>
          <label className="flex items-start gap-2 text-sm">
            <RadioGroupItem value="NEW" className="mt-0.5" />
            <span>
              <span className="font-medium text-gray-900">Create a new private project</span>
              <span className="block text-xs text-gray-500">Recommended. Named &ldquo;RippleMap · {name || "Organization"} · …&rdquo; in Felt.</span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <RadioGroupItem value="EXISTING" className="mt-0.5" />
            <span>
              <span className="font-medium text-gray-900">Connect a project already made in Felt</span>
              <span className="block text-xs text-gray-500">
                It must be private, and the portal&apos;s Felt account must be a member of it.
              </span>
            </span>
          </label>
          {felt === "EXISTING" && (
            <div className="space-y-1.5 pl-7">
              <Input
                value={existing}
                onChange={(e) => setExisting(e.target.value)}
                placeholder="Felt project link or id"
                aria-label="Existing Felt project"
                aria-invalid={!!fieldError("existingFeltProject")}
              />
              {fieldError("existingFeltProject") && <p className="text-xs text-[var(--danger)]">{fieldError("existingFeltProject")}</p>}
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <RadioGroupItem value="NONE" className="mt-0.5" />
            <span className="font-medium text-gray-900">Not now</span>
          </label>
        </RadioGroup>
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-gray-800">
        <input type="checkbox" checked={clickup} onChange={(e) => setClickup(e.target.checked)} />
        Create the organization&apos;s ClickUp support list
      </label>

      {error && !error.field && <p className="text-sm text-[var(--danger)]" role="alert">{error.message}</p>}

      <Button type="submit" disabled={saving || name.trim().length < 2 || (felt === "EXISTING" && !existing.trim())}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Create organization
      </Button>
    </form>
  );
}
