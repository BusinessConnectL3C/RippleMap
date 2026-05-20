"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { TopBar } from "@/components/layout/TopBar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const schema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(10, "Please provide more detail (min 10 chars)"),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
});

type FormData = z.infer<typeof schema>;

export default function NewTicketPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { priority: "NORMAL" as const },
  });

  const onSubmit = async (data: FormData) => {
    setError(null);
    const res = await fetch("/api/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to submit ticket. Please try again.");
      return;
    }

    router.push("/support");
  };

  return (
    <div className="flex flex-col h-full">
      <TopBar title="New Support Ticket" />
      <div className="flex-1 p-6">
        <div className="max-w-xl">
          <Card>
            <CardHeader>
              <CardTitle>Submit a support request</CardTitle>
              <CardDescription>
                Our team will respond via email, typically within 1 business day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Subject</Label>
                  <Input id="title" placeholder="Brief description of the issue" {...register("title")} />
                  {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={5}
                    placeholder="Describe the issue in detail — steps to reproduce, what you expected, what happened..."
                    {...register("description")}
                  />
                  {errors.description && <p className="text-xs text-red-600">{errors.description.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                    {...register("priority")}
                  >
                    <option value="LOW">Low — general question</option>
                    <option value="NORMAL">Normal — something isn&apos;t working right</option>
                    <option value="HIGH">High — blocking my work</option>
                    <option value="URGENT">Urgent — critical data or access issue</option>
                  </select>
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
                )}

                <div className="flex gap-3">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Submitting..." : "Submit Ticket"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.back()}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
