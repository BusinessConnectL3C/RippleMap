"use client";

import { useEffect, useState } from "react";
import type { FeatureServiceField } from "@/types/arcgis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Layers, FileText, CheckCircle2, AlertCircle, Calendar, Hash, Type as TypeIcon } from "lucide-react";

const SAFE_FIELD_TYPES = [
  { value: "esriFieldTypeString", label: "Text" },
  { value: "esriFieldTypeInteger", label: "Integer" },
  { value: "esriFieldTypeDouble", label: "Decimal" },
  { value: "esriFieldTypeDate", label: "Date" },
];

function fieldIcon(type: string) {
  if (type.includes("Date")) return Calendar;
  if (type.includes("Integer") || type.includes("Double") || type.includes("Single")) return Hash;
  return TypeIcon;
}

interface Props {
  surveyId: string;
  serviceUrl: string;
  initialFields: FeatureServiceField[];
  itemType: string;
}

export function FieldEditor({ surveyId, serviceUrl, initialFields, itemType }: Props) {
  const [fields, setFields] = useState<FeatureServiceField[]>(initialFields);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newField, setNewField] = useState({ name: "", alias: "", type: "esriFieldTypeString" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isFieldMaps = itemType === "Feature Service";
  const hasUnsavedField = showAddForm && !!(newField.name || newField.alias);

  useEffect(() => {
    if (!hasUnsavedField) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedField]);

  const handleAddField = async () => {
    if (!newField.name || !newField.alias) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    const fieldName = newField.name.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");

    try {
      const res = await fetch(`/api/arcgis/forms/${surveyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "addField",
          serviceUrl,
          field: {
            name: fieldName,
            alias: newField.alias,
            type: newField.type,
            nullable: true,
            editable: true,
            length: newField.type === "esriFieldTypeString" ? 255 : undefined,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to add field");
      }

      setFields((prev) => [
        ...prev,
        { name: fieldName, alias: newField.alias, type: newField.type, nullable: true, editable: true },
      ]);
      setNewField({ name: "", alias: "", type: "esriFieldTypeString" });
      setShowAddForm(false);
      setSuccess("Field added successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add field");
    } finally {
      setSaving(false);
    }
  };

  const systemFields = fields.filter((f) => f.name.startsWith("objectid") || f.name === "OBJECTID" || f.name === "GlobalID" || f.name === "Shape");
  const editableFields = fields.filter((f) => !systemFields.includes(f));

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        {isFieldMaps ? (
          <Layers className="h-5 w-5 text-brand" />
        ) : (
          <FileText className="h-5 w-5 text-brand" />
        )}
        <Badge variant="brand">{isFieldMaps ? "FieldMaps Layer" : "Survey123 Form"}</Badge>
        {!serviceUrl && (
          <Badge variant="destructive">No feature service URL — editing unavailable</Badge>
        )}
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-md bg-[var(--success-subtle)] p-3 text-sm text-[var(--success)]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-md bg-[var(--danger-subtle)] p-3 text-sm text-[var(--danger)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">Fields ({editableFields.length})</CardTitle>
          {serviceUrl && (
            <Button size="sm" className="gap-1" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
              <Plus className="h-3 w-3" /> Add Field
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {showAddForm && (
            <div className="mb-4 rounded-lg border border-brand/30 bg-brand-subtle p-4 space-y-3">
              <p className="rm-eyebrow">New Field</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="fieldAlias" className="text-xs">Display Name</Label>
                  <Input
                    id="fieldAlias"
                    placeholder="e.g. Organization Type"
                    value={newField.alias}
                    onChange={(e) => setNewField((f) => ({ ...f, alias: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fieldName" className="text-xs">Field Name (no spaces)</Label>
                  <Input
                    id="fieldName"
                    placeholder="e.g. org_type"
                    value={newField.name}
                    onChange={(e) => setNewField((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="fieldType" className="text-xs">Type</Label>
                <Select
                  value={newField.type}
                  onValueChange={(value) => setNewField((f) => ({ ...f, type: value }))}
                >
                  <SelectTrigger id="fieldType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAFE_FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddField} disabled={saving || !newField.name || !newField.alias}>
                  {saving ? "Adding..." : "Add Field"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {editableFields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken mb-2">
                <Layers className="h-6 w-6 text-text-muted" />
              </div>
              <p className="text-sm text-text-secondary">No editable fields found</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {editableFields.map((field) => {
                const FieldIcon = fieldIcon(field.type);
                return (
                  <div
                    key={field.name}
                    className="flex items-center gap-3 py-3 px-2 -mx-2 rounded-md hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-subtle">
                      <FieldIcon className="h-4 w-4 text-brand" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary">{field.alias || field.name}</p>
                      <p className="text-xs text-text-muted">{field.name} · {field.type.replace("esriFieldType", "")}</p>
                    </div>
                    {field.domain && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {field.domain.codedValues.length} options
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
