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
  email: string;
}

export function ProfileForm({ initialName, email }: Props) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setName(initialName);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setIsEditing(false);
  }

  async function handleSave() {
    setError(null);

    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        ...(newPassword && { currentPassword, newPassword }),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Save failed");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setIsEditing(false);
    toast({ variant: "success", title: "Profile saved" });
    router.refresh();
  }

  return (
    <>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Profile</CardTitle>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={startEditing} className="gap-1.5">
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!isEditing ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <span className="rm-eyebrow">Name</span>
            <span className="font-medium text-text-primary">{initialName}</span>
            <span className="rm-eyebrow">Email</span>
            <span className="font-medium text-text-primary">{email}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email} disabled className="bg-surface-sunken text-text-muted" />
            </div>

            <div className="space-y-2 border-t border-border pt-4">
              <p className="rm-eyebrow">Change password</p>
              <Label htmlFor="currentPassword">Current password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Min. 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
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
