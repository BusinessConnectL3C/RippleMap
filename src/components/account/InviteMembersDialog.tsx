"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { InvitePanel } from "@/components/account/InvitePanel";

interface PendingInvite {
  id: string;
  email: string | null;
  role: "ADMIN" | "MEMBER";
  expiresAt: string;
}

export function InviteMembersDialog({ pendingInvites }: { pendingInvites: PendingInvite[] }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Members</DialogTitle>
        </DialogHeader>
        <InvitePanel pendingInvites={pendingInvites} />
      </DialogContent>
    </Dialog>
  );
}
