"use client";

import { useState, useEffect } from "react";
import { CalendarPageConfig } from "@/lib/pages/pageConfig";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import { useFields } from "@/lib/useFields";
import TableSelector from "../shared/TableSelector";
import FilterBuilder from "../shared/FilterBuilder";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface CalendarSettingsProps {
  pageId: string;
  onClose: () => void;
}

export default function CalendarSettings({ pageId, onClose }: CalendarSettingsProps) {
  const { config, saveConfig } = usePageConfig({ pageId, pageType: "calendar" });
  const [localConfig, setLocalConfig] = useState<CalendarPageConfig | null>(null);
  const { fields } = useFields(localConfig?.table || "");

  useEffect(() => {
    if (config) {
      setLocalConfig(config as CalendarPageConfig);
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
      <h2 className="text-xl font-semibold">Calendar Page Settings</h2>

      <TableSelector
        value={localConfig.table}
        onChange={(tableId) => setLocalConfig({ ...localConfig, table: tableId })}
      />

      {localConfig.table && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Date Field
            </label>
            <select
              value={localConfig.dateField}
              onChange={(e) => setLocalConfig({ ...localConfig, dateField: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select a date field...</option>
              {fields.filter((f) => f.type === "date").map((field) => (
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
