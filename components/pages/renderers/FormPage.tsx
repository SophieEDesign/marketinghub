"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { FormPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface FormPageProps {
  page: InterfacePage;
  config: FormPageConfig | null;
  isEditing?: boolean;
}

export default function FormPage({ page, config, isEditing }: FormPageProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { fields: allFields } = useFields(config?.table || "");

  // Get visible fields from config
  const visibleFields = config?.fields && config.fields.length > 0
    ? allFields.filter((f) => config.fields.includes(f.key))
    : allFields;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!config?.table) return;

    setSaving(true);
    try {
      if (config.submitAction === "update" && formData.id) {
        // Update existing record
        const { id, ...updateData } = formData;
        const { error } = await supabase
          .from(config.table)
          .update(updateData)
          .eq("id", id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from(config.table)
          .insert(formData);

        if (error) throw error;
      }

      setSubmitted(true);
      setFormData({});
      
      // Reset form after 3 seconds
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error: any) {
      console.error("Error submitting form:", error);
      alert("Failed to submit form: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: any) => {
    const value = formData[field.key] || "";

    if (field.type === "long_text" || field.type === "text") {
      return (
        <textarea
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          rows={4}
          required={field.required}
        />
      );
    }

    if (field.type === "boolean") {
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
          className="rounded border-gray-300 dark:border-gray-600"
        />
      );
    }

    if (field.type === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: parseFloat(e.target.value) || 0 })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          required={field.required}
        />
      );
    }

    if (field.type === "date") {
      return (
        <input
          type="date"
          value={value ? new Date(value).toISOString().split("T")[0] : ""}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          required={field.required}
        />
      );
    }

    if (field.type === "single_select" && field.options) {
      return (
        <select
          value={value}
          onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          required={field.required}
        >
          <option value="">Select...</option>
          {field.options.map((option: string) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    // Default text input
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        required={field.required}
      />
    );
  };

  if (!config?.table) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table and fields in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      {submitted && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200">
            Form submitted successfully!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {visibleFields.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {field.label || field.key}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderField(field)}
          </div>
        ))}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Submitting..." : config.submitAction === "update" ? "Update" : "Submit"}
          </Button>
        </div>
      </form>
    </div>
  );
}
