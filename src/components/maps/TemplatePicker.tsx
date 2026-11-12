"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Map as MapIcon, LayoutDashboard, ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface TemplateOption {
  id: string;
  title: string;
  description: string | null;
  kind: "MAP" | "DASHBOARD" | "SURVEY";
  thumbnailUrl: string | null;
}

const KIND_ICON = { MAP: MapIcon, DASHBOARD: LayoutDashboard, SURVEY: ClipboardList } as const;
const KIND_LABEL = { MAP: "Map", DASHBOARD: "Dashboard", SURVEY: "Survey" } as const;

export function TemplatePicker({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(templates.length === 1 ? templates[0].id : null);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!selected || !title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/maps/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: selected, title: title.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn't create the map. Please try again.");
        setCreating(false);
        return;
      }
      router.push(`/maps/f/${data.feltMapId}`);
    } catch {
      setError("Couldn't create the map. Please try again.");
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-3 text-sm font-medium text-text-primary">1. Choose a starting point</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Templates">
          {templates.map((t) => {
            const Icon = KIND_ICON[t.kind];
            const isSelected = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(t.id)}
                className="text-left focus-visible:outline-none"
              >
                <Card
                  interactive
                  className={cn(
                    "h-full overflow-hidden transition-shadow",
                    isSelected && "ring-2 ring-[var(--brand)]"
                  )}
                >
                  {t.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- same-origin redirect to a signed S3 URL
                    <img
                      src={t.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      className="aspect-[16/10] w-full border-b border-border bg-surface-page object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[16/10] items-center justify-center border-b border-border bg-brand-subtle">
                      <Icon className="h-8 w-8 text-brand" aria-hidden="true" />
                    </div>
                  )}
                  <CardContent className="space-y-1 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="truncate font-medium text-text-primary">{t.title}</h3>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
                    </div>
                    <p className="text-xs text-text-muted">{KIND_LABEL[t.kind]}</p>
                    {t.description && <p className="text-sm text-text-secondary line-clamp-3">{t.description}</p>}
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-md space-y-2">
        <Label htmlFor="new-map-title">2. Name your map</Label>
        <Input
          id="new-map-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Volunteer sites 2027"
          maxLength={120}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
        />
        <p className="text-xs text-text-muted">
          The new map is private to your organization. Only owners and admins see it until you share it in Account →
          Map Access.
        </p>
      </div>

      {error && (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}

      <Button onClick={create} disabled={!selected || !title.trim() || creating}>
        {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        {creating ? "Creating map…" : "Create map"}
      </Button>
    </div>
  );
}
