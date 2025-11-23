"use client";

import { useState, useEffect } from "react";
import { X, BarChart3, Calendar, CheckSquare, Table, ExternalLink, TrendingUp, GitBranch } from "lucide-react";
import { getAllTables } from "@/lib/tableMetadata";
import { useFields } from "@/lib/useFields";

interface AddModulePanelProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: string, config: any) => void;
}

// KPI Configuration Form Component
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

const moduleTypes = [
  {
    id: "kpi",
    name: "KPI Card",
    icon: TrendingUp,
    description: "Display a key performance indicator",
    defaultConfig: { title: "KPI", value: 0 },
  },
  {
    id: "pipeline",
    name: "Pipeline",
    icon: GitBranch,
    description: "Show status distribution",
    defaultConfig: { table: "content", statusField: "status", statusOptions: [] },
  },
  {
    id: "tasks_due",
    name: "Tasks Due",
    icon: CheckSquare,
    description: "List upcoming tasks",
    defaultConfig: { table: "tasks", dueDateField: "due_date", limit: 10 },
  },
  {
    id: "upcoming_events",
    name: "Upcoming Events",
    icon: Calendar,
    description: "Show upcoming events",
    defaultConfig: { table: "content", dateField: "publish_date", limit: 10 },
  },
  {
    id: "calendar_mini",
    name: "Mini Calendar",
    icon: Calendar,
    description: "Compact calendar view",
    defaultConfig: { table: "content", dateField: "publish_date" },
  },
  {
    id: "table_preview",
    name: "Table Preview",
    icon: Table,
    description: "Preview records from a table",
    defaultConfig: { table: "content", limit: 5, fields: [] },
  },
  {
    id: "custom_embed",
    name: "Custom Embed",
    icon: ExternalLink,
    description: "Embed external content",
    defaultConfig: { url: "", title: "" },
  },
];

export default function AddModulePanel({ open, onClose, onAdd }: AddModulePanelProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [config, setConfig] = useState<any>({});

  if (!open) return null;

  const handleAdd = async () => {
    if (!selectedType) {
      alert("Please select a module type");
      return;
    }

    try {
      const moduleType = moduleTypes.find((t) => t.id === selectedType);
      if (!moduleType) {
        alert("Invalid module type selected");
        return;
      }

      const finalConfig = { ...moduleType.defaultConfig, ...config };
      
        // Validate KPI config if needed
        if (selectedType === "kpi") {
          if (!finalConfig.title || finalConfig.title.trim() === "") {
            alert("Please enter a title for the KPI");
            return;
          }
          // If using table data source, ensure calculation is set
          if (finalConfig.table && !finalConfig.calculation) {
            finalConfig.calculation = "count"; // Default to count if table is selected
          }
          // If using manual value, ensure value is set (allow 0 as valid value)
          if (!finalConfig.table && (finalConfig.value === undefined || finalConfig.value === null || finalConfig.value === "" || isNaN(Number(finalConfig.value)))) {
            alert("Please enter a valid numeric value for the KPI");
            return;
          }
          // Ensure value is a number
          if (!finalConfig.table && finalConfig.value !== undefined && finalConfig.value !== null) {
            finalConfig.value = Number(finalConfig.value);
          }
        }

      // Validate other module types
      if (selectedType === "table_preview" && !finalConfig.table) {
        alert("Please select a table for the preview");
        return;
      }

      if (selectedType === "custom_embed" && (!finalConfig.url || finalConfig.url.trim() === "")) {
        alert("Please enter a URL for the embed");
        return;
      }
      
      await onAdd(selectedType, finalConfig);
      // Reset form but keep panel open to allow adding more modules
      setSelectedType(null);
      setConfig({});
      // Don't close - allow adding multiple modules
    } catch (error) {
      console.error("Error adding module:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to add module: ${errorMessage}\n\nPlease check the browser console for details.`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-heading text-brand-blue">Add Module</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selectedType ? (
            <div className="grid grid-cols-2 gap-4">
              {moduleTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-brand-blue hover:bg-brand-blue/5 transition-all text-left"
                  >
                    <Icon className="w-6 h-6 text-brand-blue mb-2" />
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {type.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-sm text-brand-blue hover:text-brand-red mb-4"
                >
                  ← Back to module types
                </button>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Configure {moduleTypes.find((t) => t.id === selectedType)?.name}
                </h3>
              </div>

              {/* Configuration form based on type */}
              {selectedType === "kpi" && (
                <KPIConfigForm config={config} setConfig={setConfig} />
              )}

              {selectedType === "table_preview" && (
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

              {selectedType === "custom_embed" && (
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

              {/* For other types, use default config */}
              {!["kpi", "table_preview", "custom_embed"].includes(selectedType) && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  This module will use default settings. You can configure it after adding.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">
            {selectedType ? "Cancel" : "Close"}
          </button>
          {selectedType && (
            <button onClick={handleAdd} className="btn-primary">
              Add Module
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

