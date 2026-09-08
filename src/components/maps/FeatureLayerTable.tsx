"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FeatureServiceField } from "@/types/arcgis";

const PAGE_SIZE = 100;

function formatCell(value: unknown, field: FeatureServiceField): string {
  if (value === null || value === undefined) return "";
  if (field.type === "esriFieldTypeDate" && typeof value === "number") {
    return new Date(value).toLocaleString();
  }
  return String(value);
}

export function FeatureLayerTable({ itemId, layerId }: { itemId: string; layerId: string }) {
  const [fields, setFields] = useState<FeatureServiceField[] | null>(null);
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/api/arcgis/maps/${itemId}/layers/${layerId}`;

  const loadPage = useCallback(
    async (offset: number) => {
      const res = await fetch(`${basePath}/data?offset=${offset}&limit=${PAGE_SIZE}`);
      if (!res.ok) throw new Error("Failed to load feature data");
      return res.json() as Promise<{ features: Record<string, unknown>[]; hasMore: boolean }>;
    },
    [basePath]
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [fieldsRes, page] = await Promise.all([
          fetch(`${basePath}/fields`).then((r) => {
            if (!r.ok) throw new Error("Failed to load layer schema");
            return r.json() as Promise<{ fields: FeatureServiceField[] }>;
          }),
          loadPage(0),
        ]);
        if (cancelled) return;
        setFields(fieldsRes.fields);
        setRecords(page.features);
        setHasMore(page.hasMore);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [basePath, loadPage]);

  async function handleLoadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const page = await loadPage(records.length);
      setRecords((prev) => [...prev, ...page.features]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load more rows");
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-text-secondary">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading feature data…
      </div>
    );
  }

  if (error && !fields) {
    return <p className="py-10 text-sm text-red-600">{error}</p>;
  }

  if (!fields || fields.length === 0) {
    return <p className="py-10 text-sm text-text-secondary">No fields found for this layer.</p>;
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-text-secondary">
            {records.length.toLocaleString()} row{records.length === 1 ? "" : "s"} loaded
            {hasMore ? " (more available)" : ""}
          </p>
          <div className="flex gap-2">
            <a href={`${basePath}/export?format=csv`}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> CSV
              </Button>
            </a>
            <a href={`${basePath}/export?format=xlsx`}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> Excel
              </Button>
            </a>
            <a href={`${basePath}/export?format=json`}>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4" /> JSON
              </Button>
            </a>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-surface-card">
              <tr>
                {fields.map((field) => (
                  <th
                    key={field.name}
                    className="whitespace-nowrap border-b border-border px-3 py-2 text-left font-medium text-text-primary"
                  >
                    {field.alias || field.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((record, i) => (
                <tr key={i} className="border-b border-border last:border-0 even:bg-surface-hover/40">
                  {fields.map((field) => (
                    <td key={field.name} className="whitespace-nowrap px-3 py-2 text-text-secondary">
                      {formatCell(record[field.name], field)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && fields && <p className="mt-2 text-sm text-red-600">{error}</p>}

        {hasMore && (
          <div className="mt-3 flex justify-center">
            <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load more
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
