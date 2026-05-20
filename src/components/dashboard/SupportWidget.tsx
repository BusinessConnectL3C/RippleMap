import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

export function SupportWidget({ openCount }: { openCount: number }) {
  return (
    <Card>
      <CardContent className="p-6 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-medium text-gray-500">Open Tickets</p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{openCount}</p>
        <p className="text-xs text-gray-400 mb-4">
          {openCount === 1 ? "ticket needs attention" : "tickets need attention"}
        </p>
        <div className="flex gap-2 mt-auto">
          <Link href="/support" className="flex-1">
            <Button variant="outline" size="sm" className="w-full">View All</Button>
          </Link>
          <Link href="/support/new" className="flex-1">
            <Button size="sm" className="w-full">New Ticket</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
