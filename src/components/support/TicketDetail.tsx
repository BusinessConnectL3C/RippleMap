"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupportTicketWithComments } from "@/types/portal";
import { ticketStatusLabel } from "@/types/portal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

const STATUS_VARIANTS: Record<string, "default" | "warning" | "success" | "secondary"> = {
  OPEN: "default",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
};

const PRIORITY_VARIANTS: Record<string, "secondary" | "warning" | "destructive" | "outline"> = {
  LOW: "secondary",
  NORMAL: "outline",
  HIGH: "warning",
  URGENT: "destructive",
};

interface Props {
  ticket: SupportTicketWithComments;
}

export function TicketDetail({ ticket }: Props) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReply() {
    if (!reply.trim()) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/support/tickets/${ticket.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: reply.trim() }),
    });

    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to send reply. Please try again.");
      return;
    }

    setReply("");
    toast({ variant: "success", title: "Reply sent" });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <p className="text-sm text-gray-500 whitespace-pre-wrap">{ticket.description}</p>
            <p className="text-xs text-gray-400 mt-2">
              Submitted {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end shrink-0">
            <Badge variant={STATUS_VARIANTS[ticket.status]}>{ticketStatusLabel(ticket)}</Badge>
            <Badge variant={PRIORITY_VARIANTS[ticket.priority]}>{ticket.priority}</Badge>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {ticket.comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No replies yet.</p>
        ) : (
          ticket.comments.map((comment) => (
            <div
              key={comment.id}
              className={`max-w-[85%] rounded-lg border p-3 ${
                comment.source === "CLIENT"
                  ? "ml-auto bg-[#1B4F72]/5 border-[#1B4F72]/20"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-1">
                <span className="text-xs font-medium text-gray-700">
                  {comment.source === "CLIENT" ? comment.authorName : `${comment.authorName} · Business Connect`}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{comment.body}</p>
            </div>
          ))
        )}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <Textarea
            rows={3}
            placeholder="Write a reply..."
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <Button onClick={handleReply} disabled={submitting || !reply.trim()}>
            {submitting ? "Sending..." : "Send Reply"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
