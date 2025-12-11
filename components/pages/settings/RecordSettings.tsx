"use client";

import { useState, useEffect } from "react";
import { RecordPageConfig } from "@/lib/pages/pageConfig";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import TableSelector from "../shared/TableSelector";
import FieldSelector from "../shared/FieldSelector";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface RecordSettingsProps {
  pageId: string;
  onClose: () => void;
}

export default function RecordSettings({ pageId, onClose }: RecordSettingsProps) {
  const { config, saveConfig } = usePageConfig({ pageId, pageType: "record" });
  const [localConfig, setLocalConfig] = useState<RecordPageConfig | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config as RecordPageConfig);
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
      <h2 className="text-xl font-semibold">Record Page Settings</h2>

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
              Layout
            </label>
            <select
              value={localConfig.layout || "auto"}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  layout: e.target.value as "auto" | "twoColumn",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="auto">Auto</option>
              <option value="twoColumn">Two Column</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Record ID (optional - leave empty to show form)
            </label>
            <input
              type="text"
              value={localConfig.recordId || ""}
              onChange={(e) => setLocalConfig({ ...localConfig, recordId: e.target.value })}
              placeholder="UUID of record to display"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            />
          </div>
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
