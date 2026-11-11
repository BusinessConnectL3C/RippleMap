"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Props {
  orgId: string;
  orgName: string;
  userCount: number;
}

export function DeleteOrgButton({ orgId, orgName, userCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/admin/organizations/${orgId}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast({
        variant: "danger",
        title: "Could not delete organization",
        description: data?.error ?? "Please try again.",
      });
      return;
    }
    toast({ variant: "success", title: "Organization deleted" });
    router.push("/admin/organizations");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setConfirmText("");
      }}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-red-600 border-red-200 hover:bg-red-50"
      >
        Delete organization
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {orgName}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the organization, all {userCount} user account
            {userCount === 1 ? "" : "s"}, and all support tickets for this org. It does not
            remove their ArcGIS group or ClickUp list. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="confirm-org-name">
            Type <span className="font-mono font-semibold">{orgName}</span> to confirm
          </Label>
          <Input
            id="confirm-org-name"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={deleting || confirmText !== orgName}
          >
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Delete organization
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
