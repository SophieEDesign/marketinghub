"use client";

import { useState, useEffect } from "react";
import { X, GripVertical, Settings, BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface KpiBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}

export default function KpiBlock({
  id,
  content,
  onUpdate,
  onDelete,
  isDragging = false,
}: KpiBlockProps) {
  const [config, setConfig] = useState({
    table: content?.table || "content",
    label: content?.label || "Total Records",
    filter: content?.filter || "",
    aggregate: content?.aggregate || "count",
  });
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load KPI value
  useEffect(() => {
    if (config.table) {
      loadKpiValue();
    }
  }, [config.table, config.filter, config.aggregate]);

  const loadKpiValue = async () => {
    setLoading(true);
    try {
      let query = supabase.from(config.table).select("*", { count: "exact", head: true });

      // Apply filter if provided
      if (config.filter) {
        try {
          const filterObj = JSON.parse(config.filter);
          Object.entries(filterObj).forEach(([key, val]) => {
            query = query.eq(key, val);
          });
        } catch {
          // Invalid filter JSON, ignore
        }
      }

      if (config.aggregate === "count") {
        const { count, error } = await query;
        if (error) throw error;
        setValue(count || 0);
      } else if (config.aggregate === "sum") {
        // For sum, we need a field to sum - default to counting for now
        const { count, error } = await query;
        if (error) throw error;
        setValue(count || 0);
      } else {
        const { count, error } = await query;
        if (error) throw error;
        setValue(count || 0);
      }
    } catch (error) {
      console.error("Error loading KPI:", error);
      setValue(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (updates: Partial<typeof config>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onUpdate?.(id, newConfig);
  };

  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
      </div>

      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={() => onDelete(id)}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600 z-10"
          title="Delete block"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Settings Button */}
      {onUpdate && (
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="absolute right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600 z-10"
          title="Configure KPI"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {/* Content */}
      <div className="p-6">
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={config.table}
                onChange={(e) => handleConfigChange({ table: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="content">Content</option>
                <option value="campaigns">Campaigns</option>
                <option value="contacts">Contacts</option>
                <option value="tasks">Tasks</option>
                <option value="sponsorships">Sponsorships</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Label
              </label>
              <input
                type="text"
                value={config.label}
                onChange={(e) => handleConfigChange({ label: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                placeholder="KPI Label"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aggregate
              </label>
              <select
                value={config.aggregate}
                onChange={(e) => handleConfigChange({ aggregate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="count">Count</option>
                <option value="sum">Sum</option>
              </select>
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="text-center">
            <BarChart3 className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {config.label}
            </div>
            {loading ? (
              <div className="text-2xl font-bold text-gray-400">...</div>
            ) : (
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {value !== null ? value.toLocaleString() : "—"}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

