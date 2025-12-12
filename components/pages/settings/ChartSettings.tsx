"use client";

import { useState, useEffect } from "react";
import { ChartPageConfig } from "@/lib/pages/pageConfig";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import { useFields } from "@/lib/useFields";
import TableSelector from "../shared/TableSelector";
import FilterBuilder from "../shared/FilterBuilder";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface ChartSettingsProps {
  pageId: string;
  onClose: () => void;
}

export default function ChartSettings({ pageId, onClose }: ChartSettingsProps) {
  const { config, saveConfig } = usePageConfig({ pageId, pageType: "chart" });
  const [localConfig, setLocalConfig] = useState<ChartPageConfig | null>(null);
  const { fields } = useFields(localConfig?.table || "");

  useEffect(() => {
    if (config) {
      setLocalConfig(config as ChartPageConfig);
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
      <h2 className="text-xl font-semibold">Chart Page Settings</h2>

      <TableSelector
        value={localConfig.table}
        onChange={(tableId) => setLocalConfig({ ...localConfig, table: tableId })}
      />

      {localConfig.table && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Chart Type
            </label>
            <select
              value={localConfig.chartType}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  chartType: e.target.value as "bar" | "line" | "pie",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="bar">Bar Chart</option>
              <option value="line">Line Chart</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              X Axis Field
            </label>
            <select
              value={localConfig.xField}
              onChange={(e) => setLocalConfig({ ...localConfig, xField: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select a field...</option>
              {fields.map((field) => (
                <option key={field.field_key} value={field.field_key}>
                  {field.label || field.field_key} ({field.type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Y Axis Field (numeric)
            </label>
            <select
              value={localConfig.yField}
              onChange={(e) => setLocalConfig({ ...localConfig, yField: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select a numeric field...</option>
              {fields.filter((f) => f.type === "number").map((field) => (
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
