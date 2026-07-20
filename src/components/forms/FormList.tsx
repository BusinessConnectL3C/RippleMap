"use client";

import { useState } from "react";
import Link from "next/link";
import type { ArcGISItem } from "@/types/arcgis";
import { FileText, Map as MapIcon, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  items: ArcGISItem[];
}

const TYPE_BADGES: Record<string, { label: string; icon: React.ElementType }> = {
  Form: { label: "Survey123", icon: FileText },
  "Web Map": { label: "Web Map", icon: MapIcon },
};

function ItemRow({ item }: { item: ArcGISItem }) {
  const { label, icon: Icon } = TYPE_BADGES[item.type] ?? { label: item.type, icon: FileText };

  return (
    <Link href={`/forms/${item.id}`}>
      <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 hover:border-brand hover:shadow-sm transition-all group">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-subtle">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-medium text-gray-900 truncate">{item.title}</h3>
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
              {label}
            </span>
          </div>
          {item.snippet && (
            <p className="text-sm text-gray-600 truncate">{item.snippet}</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-brand transition-colors" />
      </div>
    </Link>
  );
}

export function FormList({ items }: Props) {
  const [query, setQuery] = useState("");

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-14 w-14 text-gray-300 mb-3" />
        <p className="text-lg font-medium text-gray-700">No forms yet</p>
        <p className="text-sm text-gray-600 mt-1">
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" />
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
        <p className="py-10 text-center text-sm text-gray-600">No forms match &ldquo;{query}&rdquo;.</p>
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
