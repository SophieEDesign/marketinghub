"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useSettings } from "@/lib/useSettings";

type FieldType = "text" | "number" | "select" | "date" | "multi-select" | "checkbox" | "file";

interface FieldDefinition {
  name: string;
  type: FieldType;
  label: string;
  options?: string[]; // For select/multi-select
  required?: boolean;
  default_value?: any;
}

export default function FieldManager() {
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [newField, setNewField] = useState<FieldDefinition>({
    name: "",
    type: "text",
    label: "",
    required: false,
  });
  const [selectOptions, setSelectOptions] = useState("");

  const customFields = settings.custom_fields || [];

  const handleAddField = async () => {
    if (!newField.name || !newField.label) {
      alert("Please fill in field name and label");
      return;
    }

    // Validate field name (must be valid SQL identifier)
    const fieldName = newField.name.toLowerCase().replace(/\s+/g, "_");
    if (!/^[a-z][a-z0-9_]*$/.test(fieldName)) {
      alert("Field name must start with a letter and contain only lowercase letters, numbers, and underscores");
      return;
    }

    setSaving(true);

    try {
      // Prepare field definition
      const fieldDef: FieldDefinition = {
        ...newField,
        name: fieldName,
        options: newField.type === "select" || newField.type === "multi-select"
          ? selectOptions.split(",").map(o => o.trim()).filter(Boolean)
          : undefined,
      };

      // Add field to Supabase table using RPC
      const { error: rpcError } = await supabase.rpc("add_content_field", {
        field_name: fieldName,
        field_type: getPostgresType(fieldDef.type),
      });

      if (rpcError) {
        // If RPC doesn't exist, try direct SQL (requires admin access)
        console.warn("RPC not available, field may need to be added manually:", rpcError);
        alert(`Field definition saved. Note: You may need to manually add the column to the content table in Supabase.\n\nSQL: ALTER TABLE content ADD COLUMN ${fieldName} ${getPostgresType(fieldDef.type)}`);
      }

      // Save field definition to settings
      const updatedFields = [...customFields, fieldDef];
      await updateSettings({ custom_fields: updatedFields });

      // Reset form
      setNewField({ name: "", type: "text", label: "", required: false });
      setSelectOptions("");
      alert("Field added successfully!");
    } catch (error) {
      console.error("Error adding field:", error);
      alert("Failed to add field");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveField = async (fieldName: string) => {
    if (!confirm(`Remove field "${fieldName}"? This will also remove the column from the database.`)) {
      return;
    }

    setSaving(true);
    try {
      // Remove from settings
      const updatedFields = customFields.filter((f: FieldDefinition) => f.name !== fieldName);
      await updateSettings({ custom_fields: updatedFields });

      // Try to remove column (may require admin access)
      const { error } = await supabase.rpc("remove_content_field", {
        field_name: fieldName,
      });

      if (error) {
        console.warn("Could not remove column automatically:", error);
        alert(`Field removed from settings. You may need to manually drop the column:\n\nSQL: ALTER TABLE content DROP COLUMN ${fieldName}`);
      } else {
        alert("Field removed successfully!");
      }
    } catch (error) {
      console.error("Error removing field:", error);
      alert("Failed to remove field");
    } finally {
      setSaving(false);
    }
  };

  const getPostgresType = (type: FieldType): string => {
    switch (type) {
      case "text":
      case "select":
        return "TEXT";
      case "number":
        return "NUMERIC";
      case "date":
        return "DATE";
      case "multi-select":
      case "file":
        return "TEXT[]"; // Array of text
      case "checkbox":
        return "BOOLEAN";
      default:
        return "TEXT";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Custom Fields</h3>

      {/* Add new field form */}
      <div className="p-4 border border-gray-300 dark:border-gray-700 rounded-lg">
        <h4 className="text-sm font-medium mb-3">Add New Field</h4>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs opacity-70 block mb-1">Field Name (lowercase, underscores)</label>
            <input
              type="text"
              value={newField.name}
              onChange={(e) => setNewField({ ...newField, name: e.target.value })}
              placeholder="field_name"
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
            />
          </div>

          <div>
            <label className="text-xs opacity-70 block mb-1">Label</label>
            <input
              type="text"
              value={newField.label}
              onChange={(e) => setNewField({ ...newField, label: e.target.value })}
              placeholder="Field Label"
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
            />
          </div>

          <div>
            <label className="text-xs opacity-70 block mb-1">Type</label>
            <select
              value={newField.type}
              onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select</option>
              <option value="multi-select">Multi-Select</option>
              <option value="date">Date</option>
              <option value="checkbox">Checkbox</option>
              <option value="file">File</option>
            </select>
          </div>

          {(newField.type === "select" || newField.type === "multi-select") && (
            <div>
              <label className="text-xs opacity-70 block mb-1">Options (comma-separated)</label>
              <input
                type="text"
                value={selectOptions}
                onChange={(e) => setSelectOptions(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newField.required || false}
              onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              className="rounded"
            />
            <label className="text-xs">Required</label>
          </div>

          <button
            onClick={handleAddField}
            disabled={saving || !newField.name || !newField.label}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saving ? "Adding..." : "Add Field"}
          </button>
        </div>
      </div>

      {/* Existing fields */}
      <div>
        <h4 className="text-sm font-medium mb-2">Existing Custom Fields</h4>
        {customFields.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">No custom fields yet</div>
        ) : (
          <div className="flex flex-col gap-2">
            {customFields.map((field: FieldDefinition) => (
              <div
                key={field.name}
                className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-800"
              >
                <div>
                  <span className="text-sm font-medium">{field.label}</span>
                  <span className="text-xs text-gray-500 ml-2">({field.name})</span>
                  <span className="text-xs text-gray-400 ml-2">{field.type}</span>
                </div>
                <button
                  onClick={() => handleRemoveField(field.name)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

