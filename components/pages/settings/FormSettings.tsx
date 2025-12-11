"use client";

import { useState, useEffect } from "react";
import { FormPageConfig } from "@/lib/pages/pageConfig";
import { usePageConfig } from "@/lib/hooks/usePageConfig";
import TableSelector from "../shared/TableSelector";
import FieldSelector from "../shared/FieldSelector";
import Button from "@/components/ui/Button";
import { Save } from "lucide-react";

interface FormSettingsProps {
  pageId: string;
  onClose: () => void;
}

export default function FormSettings({ pageId, onClose }: FormSettingsProps) {
  const { config, saveConfig } = usePageConfig({ pageId, pageType: "form" });
  const [localConfig, setLocalConfig] = useState<FormPageConfig | null>(null);

  useEffect(() => {
    if (config) {
      setLocalConfig(config as FormPageConfig);
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
      <h2 className="text-xl font-semibold">Form Page Settings</h2>

      <TableSelector
        value={localConfig.table}
        onChange={(tableId) => setLocalConfig({ ...localConfig, table: tableId })}
      />

      {localConfig.table && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Form Fields
            </label>
            <FieldSelector
              tableId={localConfig.table}
              value={localConfig.fields || []}
              onChange={(fields) => setLocalConfig({ ...localConfig, fields })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Submit Action
            </label>
            <select
              value={localConfig.submitAction || "create"}
              onChange={(e) =>
                setLocalConfig({
                  ...localConfig,
                  submitAction: e.target.value as "create" | "update",
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="create">Create New Record</option>
              <option value="update">Update Existing Record</option>
            </select>
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
