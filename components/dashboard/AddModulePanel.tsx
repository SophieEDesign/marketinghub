"use client";

import { useState } from "react";
import { X, BarChart3, Calendar, CheckSquare, Table, ExternalLink, TrendingUp, GitBranch } from "lucide-react";

interface AddModulePanelProps {
  open: boolean;
  onClose: () => void;
  onAdd: (type: string, config: any) => void;
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

  const handleAdd = () => {
    if (selectedType) {
      const moduleType = moduleTypes.find((t) => t.id === selectedType);
      onAdd(selectedType, { ...moduleType?.defaultConfig, ...config });
      setSelectedType(null);
      setConfig({});
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
                </div>
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
        {selectedType && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
            <button onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button onClick={handleAdd} className="btn-primary">
              Add Module
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

