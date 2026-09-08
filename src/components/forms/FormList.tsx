"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArcGISItem, FormKind } from "@/types/arcgis";
import { classifyFormItem } from "@/lib/arcgis/formKind";
import { FileText, Map as MapIcon, Layers, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  items: ArcGISItem[];
}

const KIND_BADGES: Record<FormKind, { label: string; icon: React.ElementType }> = {
  survey123: { label: "Survey123", icon: FileText },
  "fieldmaps-webmap": { label: "Field Maps", icon: MapIcon },
  "fieldmaps-layer": { label: "Field Maps", icon: Layers },
  unknown: { label: "Form", icon: FileText },
};

function ItemRow({ item }: { item: ArcGISItem }) {
  const { label, icon: Icon } = KIND_BADGES[classifyFormItem(item)];

  return (
    <Link href={`/forms/${item.id}`}>
      <Card interactive className="flex items-center gap-4 p-4 group">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-subtle">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-text-primary truncate">{item.title}</h3>
            <Badge variant="secondary" className="shrink-0">{label}</Badge>
          </div>
          {item.snippet && (
            <p className="text-sm text-text-secondary truncate">{item.snippet}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-brand transition-colors" />
      </Card>
    </Link>
  );
}

export function FormList({ items }: Props) {
  const [query, setQuery] = useState("");

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-sunken mb-3">
          <FileText className="h-7 w-7 text-text-muted" />
        </div>
        <p className="text-text-secondary font-medium">No forms yet</p>
        <p className="text-sm text-text-muted mt-1 max-w-sm">
          Survey123 forms and Field Maps web maps shared to your group will appear here.
        </p>
      </div>
    );
  }

  const filtered = query.trim()
    ? items.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div>
      {items.length > 6 && (
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search forms and surveys…"
            className="pl-9"
            aria-label="Search forms and surveys"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">No forms match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
