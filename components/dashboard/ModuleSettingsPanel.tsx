"use client";

import { useState, useEffect } from "react";
import { X, Settings } from "lucide-react";
import { getAllTables } from "@/lib/tableMetadata";
import { useFields } from "@/lib/useFields";

interface ModuleSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  module: {
    id: string;
    type: string;
    config: any;
    width: number;
    height: number;
  };
  onUpdate: (updates: { config?: any; width?: number; height?: number }) => void;
}

type ConfigSetter = (config: any | ((prev: any) => any)) => void;

function KPIConfigForm({ config, setConfig }: { config: any; setConfig: ConfigSetter }) {
  const [dataSource, setDataSource] = useState<"manual" | "table">(config.table ? "table" : "manual");
  const availableTables = getAllTables();
  const { fields, loading: fieldsLoading } = useFields(config.table || "");

  useEffect(() => {
    if (dataSource === "manual" && config.table) {
      setConfig((prev: any) => ({ ...prev, table: undefined, field: undefined, calculation: undefined }));
    } else if (dataSource === "table" && !config.table) {
      setConfig((prev: any) => ({ ...prev, value: undefined }));
    }
  }, [dataSource, config.table, setConfig]);

  const calculationTypes = [
    { value: "count", label: "Count" },
    { value: "sum", label: "Sum" },
    { value: "average", label: "Average" },
    { value: "min", label: "Minimum" },
    { value: "max", label: "Maximum" },
  ];

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Title
        </label>
        <input
          type="text"
          value={config.title || ""}
          onChange={(e) => setConfig({ ...config, title: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          placeholder="KPI Title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Data Source
        </label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="manual"
              checked={dataSource === "manual"}
              onChange={(e) => setDataSource(e.target.value as "manual" | "table")}
              className="mr-2"
            />
            Manual Value
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="table"
              checked={dataSource === "table"}
              onChange={(e) => setDataSource(e.target.value as "manual" | "table")}
              className="mr-2"
            />
            From Table
          </label>
        </div>
      </div>

      {dataSource === "manual" ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Value
          </label>
          <input
            type="number"
            value={config.value || ""}
            onChange={(e) => setConfig({ ...config, value: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
            placeholder="0"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Table
            </label>
            <select
              value={config.table || ""}
              onChange={(e) => setConfig({ ...config, table: e.target.value, field: undefined, calculation: undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select table</option>
              {availableTables.map((tableId) => (
                <option key={tableId} value={tableId}>
                  {tableId.charAt(0).toUpperCase() + tableId.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {config.table && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Calculation Type
                </label>
                <select
                  value={config.calculation || "count"}
                  onChange={(e) => setConfig({ ...config, calculation: e.target.value, field: e.target.value === "count" ? undefined : config.field })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                >
                  {calculationTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {config.calculation !== "count" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field
                  </label>
                  {fieldsLoading ? (
                    <div className="text-sm text-gray-500">Loading fields...</div>
                  ) : (
                    <select
                      value={config.field || ""}
                      onChange={(e) => setConfig({ ...config, field: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    >
                      <option value="">Select field</option>
                      {fields
                        .filter((f) => f.type === "number")
                        .map((field) => (
                          <option key={field.id} value={field.field_key}>
                            {field.label}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function ModuleSettingsPanel({ open, onClose, module, onUpdate }: ModuleSettingsPanelProps) {
  const [config, setConfig] = useState(module.config || {});
  const [width, setWidth] = useState(module.width || 4);
  const [height, setHeight] = useState(module.height || 4);

  useEffect(() => {
    setConfig(module.config || {});
    setWidth(module.width || 4);
    setHeight(module.height || 4);
  }, [module]);

  if (!open) return null;

  const handleSave = () => {
    onUpdate({ config, width, height });
    onClose();
  };

  const moduleTypeNames: Record<string, string> = {
    kpi: "KPI Card",
    pipeline: "Pipeline",
    tasks_due: "Tasks Due",
    upcoming_events: "Upcoming Events",
    calendar_mini: "Mini Calendar",
    table_preview: "Table Preview",
    custom_embed: "Custom Embed",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-blue" />
            <h2 className="text-xl font-heading text-brand-blue">
              Module Settings - {moduleTypeNames[module.type] || module.type}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Size Settings */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Size & Format</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Width (grid units)
                </label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Height (grid units)
                </label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 4)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                />
              </div>
            </div>
          </div>

          {/* Module-specific Configuration */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Configuration</h3>
            {module.type === "kpi" && (
              <KPIConfigForm config={config} setConfig={setConfig} />
            )}

            {module.type === "table_preview" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Table
                  </label>
                  <select
                    value={config.table || ""}
                    onChange={(e) => setConfig({ ...config, table: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="">Select table</option>
                    <option value="content">Content</option>
                    <option value="campaigns">Campaigns</option>
                    <option value="tasks">Tasks</option>
                    <option value="contacts">Contacts</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Limit
                  </label>
                  <input
                    type="number"
                    value={config.limit || 5}
                    onChange={(e) => setConfig({ ...config, limit: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
              </div>
            )}

            {module.type === "custom_embed" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={config.url || ""}
                    onChange={(e) => setConfig({ ...config, url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    placeholder="https://example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={config.title || ""}
                    onChange={(e) => setConfig({ ...config, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    placeholder="Module title"
                  />
                </div>
              </div>
            )}

            {!["kpi", "table_preview", "custom_embed"].includes(module.type) && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Configuration options for this module type are not yet available.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-primary">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

