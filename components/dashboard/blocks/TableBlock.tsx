"use client";

import { useState, useEffect } from "react";
import { X, GripVertical, Settings, Table as TableIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";

interface TableBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}

export default function TableBlock({
  id,
  content,
  onUpdate,
  onDelete,
  isDragging = false,
}: TableBlockProps) {
  const { openRecord } = useRecordDrawer();
  const [config, setConfig] = useState({
    table: content?.table || "content",
    fields: content?.fields || ["title", "status", "created_at"],
    limit: content?.limit || 5,
  });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load table data
  useEffect(() => {
    if (config.table) {
      loadTableData();
    }
  }, [config.table, config.fields, config.limit]);

  const loadTableData = async () => {
    setLoading(true);
    try {
      const columns = config.fields.join(", ");
      const { data, error } = await supabase
        .from(config.table)
        .select(columns)
        .limit(config.limit)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      console.error("Error loading table data:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (updates: Partial<typeof config>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onUpdate?.(id, newConfig);
  };

  const handleRowClick = (row: any) => {
    if (row.id) {
      openRecord(config.table, row.id);
    }
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
          title="Configure Table"
        >
          <Settings className="w-4 h-4" />
        </button>
      )}

      {/* Content */}
      <div className="p-4">
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
                Limit
              </label>
              <input
                type="number"
                value={config.limit}
                onChange={(e) => handleConfigChange({ limit: parseInt(e.target.value) || 5 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                min="1"
                max="20"
              />
            </div>
            <button
              onClick={() => setIsEditing(false)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
            >
              Done
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TableIcon className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {config.table}
              </h3>
            </div>
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No data</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      {config.fields.slice(0, 3).map((field: string) => (
                        <th
                          key={field}
                          className="px-2 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase"
                        >
                          {field.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr
                        key={row.id || idx}
                        onClick={() => handleRowClick(row)}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                      >
                        {config.fields.slice(0, 3).map((field: string) => (
                          <td key={field} className="px-2 py-2 text-gray-900 dark:text-gray-100">
                            {row[field] ? String(row[field]).slice(0, 30) : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

