"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { RecordPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface RecordPageProps {
  page: InterfacePage;
  config: RecordPageConfig | null;
  isEditing?: boolean;
}

export default function RecordPage({ page, config, isEditing }: RecordPageProps) {
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedRecord, setEditedRecord] = useState<any>({});
  const { fields: allFields } = useFields(config?.table || "");

  // Get visible fields from config
  const visibleFields = config?.fields && config.fields.length > 0
    ? allFields.filter((f) => config.fields.includes(f.field_key))
    : allFields;

  // Load record
  useEffect(() => {
    if (!config?.table) return;

    const loadRecord = async () => {
      if (!config.recordId) {
        // No specific record - show empty form or first record
        setRecord(null);
        setEditedRecord({});
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from(config.table)
          .select("*")
          .eq("id", config.recordId)
          .single();

        if (error) throw error;
        setRecord(data);
        setEditedRecord(data || {});
      } catch (error: any) {
        console.error("Error loading record:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecord();
  }, [config?.table, config?.recordId]);

  const handleSave = async () => {
    if (!config?.table) return;

    setSaving(true);
    try {
      if (record?.id) {
        // Update existing record
        const { error } = await supabase
          .from(config.table)
          .update(editedRecord)
          .eq("id", record.id);

        if (error) throw error;
        setRecord({ ...record, ...editedRecord });
      } else {
        // Create new record
        const { data, error } = await supabase
          .from(config.table)
          .insert(editedRecord)
          .select()
          .single();

        if (error) throw error;
        setRecord(data);
        setEditedRecord(data);
      }
    } catch (error: any) {
      console.error("Error saving record:", error);
      alert("Failed to save record: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: any) => {
    const value = editedRecord[field.field_key] || "";

    if (field.type === "long_text" || field.type === "text") {
      return (
        <textarea
          value={value}
          onChange={(e) => setEditedRecord({ ...editedRecord, [field.field_key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          rows={4}
        />
      );
    }

    if (field.type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => setEditedRecord({ ...editedRecord, [field.field_key]: e.target.checked })}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      );
    }

    if (field.type === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setEditedRecord({ ...editedRecord, [field.field_key]: parseFloat(e.target.value) || 0 })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        />
      );
    }

    if (field.type === "date") {
      return (
        <input
          type="date"
          value={value ? new Date(value).toISOString().split("T")[0] : ""}
          onChange={(e) => setEditedRecord({ ...editedRecord, [field.field_key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        />
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setEditedRecord({ ...editedRecord, [field.field_key]: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
      />
    );
  };

  if (!config?.table) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table and record ID in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading record...
      </div>
    );
  }

  const layoutClass = config.layout === "twoColumn" ? "grid grid-cols-2 gap-6" : "space-y-6";

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className={layoutClass}>
        {visibleFields.map((field) => (
          <div key={field.field_key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label || field.field_key}
            </label>
            {isEditing ? (
              renderField(field)
            ) : (
              <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md">
                {editedRecord[field.field_key] || "-"}
              </div>
            )}
          </div>
        ))}
      </div>

      {isEditing && (
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : record?.id ? "Update Record" : "Create Record"}
          </Button>
        </div>
      )}
    </div>
  );
}
