"use client";

import { useState, useEffect } from "react";
import { GridPageConfig } from "@/lib/pages/pageConfig";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import TableSelector from "../shared/TableSelector";
import FieldSelector from "../shared/FieldSelector";
import FilterBuilder from "../shared/FilterBuilder";
import SortBuilder from "../shared/SortBuilder";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface GridSettingsProps {
  pageId: string;
  onClose: () => void;
}

export default function GridSettings({ pageId, onClose }: GridSettingsProps) {
  const { config, saveConfig } = usePageConfig({ pageId, pageType: "grid" });
  const [localConfig, setLocalConfig] = useState<GridPageConfig | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config as GridPageConfig);
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
      <h2 className="text-xl font-semibold">Grid Page Settings</h2>

      <TableSelector
        value={localConfig.table}
        onChange={(tableId) => setLocalConfig({ ...localConfig, table: tableId })}
      />

      {localConfig.table && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Visible Fields
            </label>
            <FieldSelector
              tableId={localConfig.table}
              value={localConfig.fields || []}
              onChange={(fields) => setLocalConfig({ ...localConfig, fields })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Row Height
            </label>
            <select
              value={localConfig.rowHeight || "medium"}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  rowHeight: e.target.value as "short" | "medium" | "tall",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="tall">Tall</option>
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
