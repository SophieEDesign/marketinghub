"use client";

import { useMemo } from "react";

interface PipelineConfig {
  title?: string;
  table: string;
  statusField: string;
  statusOptions: string[];
  colors?: Record<string, string>;
}

interface PipelineModuleProps {
  config: PipelineConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<PipelineConfig>) => void;
  isEditing?: boolean;
  data?: any[];
}

export default function PipelineModule({ config, width, height, onUpdate, isEditing = false, data = [] }: PipelineModuleProps) {
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    config.statusOptions.forEach(status => {
      counts[status] = 0;
    });
    data.forEach(record => {
      const status = record[config.statusField];
      if (status && counts.hasOwnProperty(status)) {
        counts[status]++;
      }
    });
    return counts;
  }, [data, config.statusField, config.statusOptions]);

  const total = useMemo(() => {
    return Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
  }, [statusCounts]);

  const getColor = (status: string) => {
    if (config.colors && config.colors[status]) {
      return config.colors[status];
    }
    // Default colors
    const defaultColors: Record<string, string> = {
      "Draft": "#94a3b8",
      "In Progress": "#3b82f6",
      "Review": "#f59e0b",
      "Published": "#10b981",
      "Archived": "#6b7280",
    };
    return defaultColors[status] || "#94a3b8";
  };

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
          {config.title || "Pipeline"}
        </h3>
        <div className="flex-1 space-y-3 overflow-y-auto">
          {config.statusOptions.map((status) => {
            const count = statusCounts[status] || 0;
            const percentage = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={status} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-700 dark:text-gray-300">{status}</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{count}</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: getColor(status),
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {total > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total: {total} records
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

