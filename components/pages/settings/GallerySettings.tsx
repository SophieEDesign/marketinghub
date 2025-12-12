"use client";

import { useState, useEffect } from "react";
import { GalleryPageConfig } from "@/lib/pages/pageConfig";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import { useFields } from "@/lib/useFields";
import TableSelector from "../shared/TableSelector";
import FilterBuilder from "../shared/FilterBuilder";
import SortBuilder from "../shared/SortBuilder";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface GallerySettingsProps {
  pageId: string;
  onClose: () => void;
}

export default function GallerySettings({ pageId, onClose }: GallerySettingsProps) {
  const { config, saveConfig } = usePageConfig({ pageId, pageType: "gallery" });
  const [localConfig, setLocalConfig] = useState<GalleryPageConfig | null>(null);
  const { fields } = useFields(localConfig?.table || "");

  useEffect(() => {
    if (config) {
      setLocalConfig(config as GalleryPageConfig);
    }
  }, [config]);

  const handleSave = async () => {
    if (!localConfig) return;
    try {
      await saveConfig(localConfig);
      onClose();
    } catch (error: any) {
      alert("Failed to save settings: " + error.message);
    }
  };

  if (!localConfig) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-semibold">Gallery Page Settings</h2>

      <TableSelector
        value={localConfig.table}
        onChange={(tableId) => setLocalConfig({ ...localConfig, table: tableId })}
      />

      {localConfig.table && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Image Field
            </label>
            <select
              value={localConfig.imageField}
              onChange={(e) => setLocalConfig({ ...localConfig, imageField: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select a field...</option>
              {fields.filter((f) => f.type === "attachment" || f.type === "text").map((field) => (
                <option key={field.field_key} value={field.field_key}>
                  {field.label || field.field_key} ({field.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Title Field (optional)
            </label>
            <select
              value={localConfig.titleField || ""}
              onChange={(e) => setLocalConfig({ ...localConfig, titleField: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">None</option>
              {fields.map((field) => (
                <option key={field.field_key} value={field.field_key}>
                  {field.label || field.field_key}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subtitle Field (optional)
            </label>
            <select
              value={localConfig.subtitleField || ""}
              onChange={(e) => setLocalConfig({ ...localConfig, subtitleField: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">None</option>
              {fields.map((field) => (
                <option key={field.field_key} value={field.field_key}>
                  {field.label || field.field_key}
                </option>
              ))}
            </select>
          </div>

          <FilterBuilder
            tableId={localConfig.table}
            filters={localConfig.filters || []}
            onChange={(filters) => setLocalConfig({ ...localConfig, filters })}
          />

          <SortBuilder
            tableId={localConfig.table}
            sorts={localConfig.sorts || []}
            onChange={(sorts) => setLocalConfig({ ...localConfig, sorts })}
          />
        </>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="w-4 h-4 mr-2" />
          Save Settings
        </Button>
      </div>
    </div>
  );
}
