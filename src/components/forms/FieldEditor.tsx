"use client";

import { useState } from "react";
import type { FeatureServiceField } from "@/types/arcgis";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Layers, FileText } from "lucide-react";

const SAFE_FIELD_TYPES = [
  { value: "esriFieldTypeString", label: "Text" },
  { value: "esriFieldTypeInteger", label: "Integer" },
  { value: "esriFieldTypeDouble", label: "Decimal" },
  { value: "esriFieldTypeDate", label: "Date" },
];

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
          <Layers className="h-5 w-5 text-[#1B4F72]" />
        ) : (
          <FileText className="h-5 w-5 text-[#1B4F72]" />
        )}
        <Badge variant="secondary">{isFieldMaps ? "FieldMaps Layer" : "Survey123 Form"}</Badge>
        {!serviceUrl && (
          <Badge variant="destructive">No feature service URL — editing unavailable</Badge>
        )}
      </div>

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{success}</div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
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
            <div className="mb-4 rounded-lg border border-[#1B4F72]/30 bg-[#EBF5FB] p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900">New Field</p>
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
                <select
                  id="fieldType"
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4F72]"
                  value={newField.type}
                  onChange={(e) => setNewField((f) => ({ ...f, type: e.target.value }))}
                >
                  {SAFE_FIELD_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
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
            <p className="text-sm text-gray-400 py-4 text-center">No editable fields found</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {editableFields.map((field) => (
                <div key={field.name} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{field.alias || field.name}</p>
                    <p className="text-xs text-gray-400">{field.name} · {field.type.replace("esriFieldType", "")}</p>
                  </div>
                  {field.domain && (
                    <Badge variant="secondary" className="text-xs">
                      {field.domain.codedValues.length} options
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
