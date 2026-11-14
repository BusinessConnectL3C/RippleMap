"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type ColumnType = "INTEGER" | "REAL" | "TEXT" | "BOOLEAN" | "DATE" | "DATETIME";
type NewColumnType = "TEXT" | "REAL" | "DATE" | "BOOLEAN";

interface Column {
  name: string;
  type: ColumnType;
  readOnly: boolean;
  isNew?: boolean;
}

interface EditorData {
  columns: Column[];
  rows: Record<string, unknown>[];
  snapshot: string;
  layerName: string;
}

interface NewColumn {
  name: string;
  type: NewColumnType;
  defaultValue: string | boolean;
}

type CellValue = string | boolean | null;

type SaveState =
  | { step: "idle" }
  | { step: "saving" }
  | { step: "done" }
  | { step: "error"; message: string; conflict?: boolean };

const PAGE_SIZE = 50;
const POLL_MS = 3000;
const NEW_TYPE_LABEL: Record<NewColumnType, string> = { TEXT: "Text", REAL: "Number", DATE: "Date", BOOLEAN: "Yes / no" };

const cellKey = (row: number, column: string) => `${row}\u0000${column}`;

function display(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface Props {
  /** /api/felt/maps/{id}/uploads */
  base: string;
  layer: { uploadId: string; layerName: string } | null;
  onClose: () => void;
  onSaved: (layerName: string) => void;
}

/** Spreadsheet-style editor for a portal-uploaded layer: edit values, delete records, add columns, then save once. */
export function DataEditorDialog(props: Props) {
  // Remounting the editor (new layer, or "Reload table") starts it fresh.
  const [reloadKey, setReloadKey] = useState(0);
  if (!props.layer) return null;
  return (
    <Editor
      key={`${props.layer.uploadId}:${reloadKey}`}
      {...props}
      layer={props.layer}
      onReload={() => setReloadKey((k) => k + 1)}
    />
  );
}

function Editor({
  base,
  layer,
  onClose,
  onSaved,
  onReload,
}: Props & { layer: { uploadId: string; layerName: string }; onReload: () => void }) {
  const [data, setData] = useState<EditorData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Map<string, CellValue>>(new Map());
  const [deleted, setDeleted] = useState<Set<number>>(new Set());
  const [newColumns, setNewColumns] = useState<NewColumn[]>([]);
  const [draftColumn, setDraftColumn] = useState<NewColumn>({ name: "", type: "TEXT", defaultValue: "" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [save, setSave] = useState<SaveState>({ step: "idle" });
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableBox = useRef<HTMLDivElement>(null);


  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current);
  }, []);

  // Load the layer's current data.
  useEffect(() => {
    let cancelled = false;
    fetch(`${base}?for=edit&layer=${encodeURIComponent(layer.uploadId)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Couldn't load the layer's data.");
        if (!cancelled) setData(json);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : "Couldn't load the layer's data."));
    return () => {
      cancelled = true;
    };
  }, [base, layer]);

  const columns: Column[] = useMemo(
    () => [
      ...(data?.columns ?? []),
      ...newColumns.map((c) => ({ name: c.name, type: c.type as ColumnType, readOnly: false, isNew: true })),
    ],
    [data, newColumns]
  );

  const valueOf = (row: number, column: Column): CellValue => {
    const key = cellKey(row, column.name);
    if (edits.has(key)) return edits.get(key)!;
    if (column.isNew) return newColumns.find((c) => c.name === column.name)?.defaultValue ?? "";
    const raw = data?.rows[row]?.[column.name];
    if (column.type === "BOOLEAN") return raw === true || raw === "true";
    return display(raw);
  };

  const visibleRows = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const all = data.rows.map((_, i) => i);
    if (!term) return all;
    return all.filter((i) => columns.some((c) => display(valueOf(i, c)).toLowerCase().includes(term)));
    // valueOf depends on edits/newColumns, already covered by columns/edits deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, search, columns, edits]);

  const pageCount = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pageRows = visibleRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const changedCells = [...edits.keys()].length;
  const hasChanges = changedCells > 0 || deleted.size > 0 || newColumns.length > 0;
  const saving = save.step === "saving";

  function setCell(row: number, column: Column, value: CellValue) {
    setEdits((prev) => {
      const next = new Map(prev);
      const original = column.isNew
        ? newColumns.find((c) => c.name === column.name)?.defaultValue ?? ""
        : column.type === "BOOLEAN"
          ? data?.rows[row]?.[column.name] === true || data?.rows[row]?.[column.name] === "true"
          : display(data?.rows[row]?.[column.name]);
      if (value === original) next.delete(cellKey(row, column.name));
      else next.set(cellKey(row, column.name), value);
      return next;
    });
  }

  function addColumn() {
    const name = draftColumn.name.trim();
    if (!name || columns.some((c) => c.name.toLowerCase() === name.toLowerCase())) return;
    setNewColumns((prev) => [...prev, { ...draftColumn, name }]);
    setDraftColumn({ name: "", type: "TEXT", defaultValue: "" });
    // New columns go at the end: bring it into view.
    requestAnimationFrame(() => tableBox.current?.scrollTo({ left: tableBox.current.scrollWidth, behavior: "smooth" }));
  }

  function removeNewColumn(name: string) {
    setNewColumns((prev) => prev.filter((c) => c.name !== name));
    setEdits((prev) => {
      const next = new Map(prev);
      for (const key of next.keys()) if (key.endsWith(`\u0000${name}`)) next.delete(key);
      return next;
    });
  }

  function poll(uploadId: string, layerName: string) {
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${base}/${uploadId}`, { cache: "no-store" });
        const json = await res.json().catch(() => null);
        const status = json?.upload?.status;
        if (status === "COMPLETED") {
          setSave({ step: "done" });
          onSaved(layerName);
          return;
        }
        if (status === "FAILED") {
          setSave({ step: "error", message: json.upload.error ?? "Couldn't save the changes." });
          return;
        }
      } catch {
        /* keep polling */
      }
      poll(uploadId, layerName);
    }, POLL_MS);
  }

  async function saveChanges() {
    if (!data || !hasChanges || !confirmed) return;
    setSave({ step: "saving" });
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "EDIT",
          originUploadId: layer.uploadId,
          confirmed,
          snapshot: data.snapshot,
          cells: [...edits.entries()]
            .map(([key, value]) => {
              const [row, column] = key.split("\u0000");
              return { row: Number(row), column, value };
            })
            .filter((c) => !deleted.has(c.row)),
          deleteRows: [...deleted],
          addColumns: newColumns.map((c) => ({ name: c.name, type: c.type, defaultValue: c.defaultValue === "" ? null : c.defaultValue })),
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setSave({ step: "error", message: json?.error ?? "Couldn't save the changes.", conflict: res.status === 409 });
        return;
      }
      if (json.upload.status === "FAILED") {
        setSave({ step: "error", message: json.upload.error ?? "Couldn't save the changes." });
        return;
      }
      poll(json.upload.id, layer.layerName);
    } catch {
      setSave({ step: "error", message: "Couldn't reach the server. Check your connection and try again." });
    }
  }

  function close() {
    if (saving) return;
    if (hasChanges && save.step !== "done" && !confirm("Discard your unsaved changes?")) return;
    onClose();
  }

  return (
    <Dialog open onOpenChange={(next) => !next && close()}>
      <DialogContent className="flex h-[88vh] max-w-6xl flex-col gap-3 p-5">
        <DialogHeader>
          <DialogTitle>Edit data: {layer.layerName}</DialogTitle>
          <DialogDescription>
            Change values, delete records or add columns. Nothing changes on the map until you save.
          </DialogDescription>
        </DialogHeader>

        {loadError ? (
          <p className="flex items-start gap-2 text-sm text-[var(--danger)]" role="alert">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}
          </p>
        ) : !data ? (
          <p className="flex items-center gap-2 py-10 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading the layer&apos;s current data… this can take up to half a minute.
          </p>
        ) : save.step === "done" ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-[var(--success)]" />
            <p className="font-medium text-text-primary">Saved. The map now shows the updated data.</p>
            <Button onClick={onClose}>Close</Button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search records"
                  className="pl-8"
                  aria-label="Search records"
                />
              </div>
              <div className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2">
                <Input
                  value={draftColumn.name}
                  onChange={(e) => setDraftColumn((d) => ({ ...d, name: e.target.value }))}
                  placeholder="New column name"
                  maxLength={63}
                  className="h-9 w-40"
                  aria-label="New column name"
                  disabled={saving}
                />
                <Select
                  value={draftColumn.type}
                  onValueChange={(v) => setDraftColumn((d) => ({ ...d, type: v as NewColumnType, defaultValue: v === "BOOLEAN" ? false : "" }))}
                  disabled={saving}
                >
                  <SelectTrigger className="h-9 w-28" aria-label="New column type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(NEW_TYPE_LABEL) as NewColumnType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {NEW_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {draftColumn.type === "BOOLEAN" ? (
                  <label className="flex h-9 items-center gap-1.5 px-1 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={draftColumn.defaultValue === true}
                      onChange={(e) => setDraftColumn((d) => ({ ...d, defaultValue: e.target.checked }))}
                    />
                    Default yes
                  </label>
                ) : (
                  <Input
                    value={String(draftColumn.defaultValue)}
                    onChange={(e) => setDraftColumn((d) => ({ ...d, defaultValue: e.target.value }))}
                    placeholder="Default value (optional)"
                    type={draftColumn.type === "DATE" ? "date" : draftColumn.type === "REAL" ? "number" : "text"}
                    className="h-9 w-44"
                    aria-label="Default value"
                    disabled={saving}
                  />
                )}
                <Button size="sm" variant="outline" className="h-9 gap-1.5" onClick={addColumn} disabled={saving || !draftColumn.name.trim()}>
                  <Plus className="h-3.5 w-3.5" /> Add column
                </Button>
              </div>
              <span className="ml-auto text-xs text-text-muted">
                {visibleRows.length.toLocaleString()} of {data.rows.length.toLocaleString()} records
              </span>
            </div>

            {/* Table */}
            <div ref={tableBox} className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
              <table className="w-max min-w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-surface-page">
                  <tr>
                    <th className="w-12 border-b border-border px-2 py-2 text-right text-xs font-medium text-text-muted">#</th>
                    {columns.map((c) => (
                      <th key={c.name} className="border-b border-l border-border px-2 py-2 text-left text-xs font-semibold text-text-secondary">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          {c.name}
                          {c.isNew && <Badge variant="brand">New</Badge>}
                          {c.readOnly && <span className="font-normal text-text-muted">(location)</span>}
                          {c.isNew && (
                            <button
                              type="button"
                              aria-label={`Remove new column ${c.name}`}
                              className="rounded p-0.5 text-text-muted hover:bg-gray-200"
                              onClick={() => removeNewColumn(c.name)}
                              disabled={saving}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className="w-10 border-b border-l border-border" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row) => {
                    const isDeleted = deleted.has(row);
                    return (
                      <tr key={row} className={cn("border-b border-border", isDeleted && "bg-[var(--danger-subtle)] text-text-muted line-through")}>
                        <td className="px-2 py-1 text-right text-xs text-text-muted">{row + 1}</td>
                        {columns.map((c) => {
                          const value = valueOf(row, c);
                          const changed = edits.has(cellKey(row, c.name));
                          const editable = !c.readOnly && !isDeleted && !saving;
                          return (
                            <td key={c.name} className={cn("border-l border-border p-0", changed && "bg-[var(--warning-subtle)]")}>
                              {c.type === "BOOLEAN" ? (
                                <div className="flex h-8 items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={value === true}
                                    disabled={!editable}
                                    onChange={(e) => setCell(row, c, e.target.checked)}
                                    aria-label={`${c.name}, record ${row + 1}`}
                                  />
                                </div>
                              ) : editable ? (
                                <input
                                  className="h-8 w-full min-w-28 bg-transparent px-2 outline-none focus:bg-white focus:ring-2 focus:ring-inset focus:ring-brand"
                                  type={c.type === "DATE" ? "date" : c.type === "INTEGER" || c.type === "REAL" ? "number" : "text"}
                                  step={c.type === "REAL" ? "any" : undefined}
                                  value={String(value ?? "")}
                                  maxLength={2000}
                                  onChange={(e) => setCell(row, c, e.target.value)}
                                  aria-label={`${c.name}, record ${row + 1}`}
                                />
                              ) : (
                                <span className="block h-8 truncate px-2 leading-8 text-text-muted">{String(value ?? "")}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="border-l border-border px-1 text-center">
                          <button
                            type="button"
                            disabled={saving}
                            className="rounded p-1 text-text-muted hover:bg-gray-100 hover:text-[var(--danger)]"
                            aria-label={isDeleted ? `Keep record ${row + 1}` : `Delete record ${row + 1}`}
                            title={isDeleted ? "Keep this record" : "Delete this record"}
                            onClick={() =>
                              setDeleted((prev) => {
                                const next = new Set(prev);
                                if (next.has(row)) next.delete(row);
                                else next.add(row);
                                return next;
                              })
                            }
                          >
                            {isDeleted ? <RotateCcw className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <span className="text-xs text-text-muted">
                  Page {page + 1} of {pageCount}
                </span>
                <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
              <span className="text-xs text-text-secondary">
                {hasChanges
                  ? [
                      changedCells && `${changedCells} ${changedCells === 1 ? "value" : "values"} changed`,
                      deleted.size && `${deleted.size} ${deleted.size === 1 ? "record" : "records"} to delete`,
                      newColumns.length && `${newColumns.length} new ${newColumns.length === 1 ? "column" : "columns"}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "No changes yet"}
              </span>
            </div>

            {save.step === "error" && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-[var(--danger)]" role="alert">
                <AlertCircle className="h-4 w-4 shrink-0" /> {save.message}
                {save.conflict && (
                  <Button size="sm" variant="outline" onClick={onReload}>
                    Reload table
                  </Button>
                )}
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-3 sm:flex-row sm:items-center">
              <label className="flex flex-1 items-start gap-2 text-xs text-text-secondary">
                <input type="checkbox" className="mt-0.5" checked={confirmed} disabled={saving} onChange={(e) => setConfirmed(e.target.checked)} />
                <span>
                  This data contains no personal or sensitive information. Saving reloads the whole layer (about a minute);
                  changes made to it in Felt meanwhile may be lost.
                </span>
              </label>
              <div className="flex gap-2">
                <Button variant="outline" onClick={close} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveChanges} disabled={!hasChanges || !confirmed || saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
