"use client";

import { useState, useEffect } from "react";
import { X, GripVertical, Settings, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import { useTables } from "@/lib/hooks/useTables";

interface CalendarBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
}

export default function CalendarBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
}: CalendarBlockProps) {
  const { openRecord } = useRecordDrawer();
  const { tables } = useTables();
  const [config, setConfig] = useState({
    table: content?.table || "content",
    dateField: content?.dateField || "publish_date",
    limit: content?.limit || 5,
  });
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load upcoming events
  useEffect(() => {
    if (config.table && config.dateField) {
      loadEvents();
    }
  }, [config.table, config.dateField, config.limit]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from(config.table)
        .select(`id, ${config.dateField}, title, name`)
        .gte(config.dateField, today)
        .order(config.dateField, { ascending: true })
        .limit(config.limit);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (updates: Partial<typeof config>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onUpdate?.(id, newConfig);
  };

  const handleEventClick = (event: any) => {
    if (event.id) {
      openRecord(config.table, event.id);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
      {onOpenSettings && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenSettings();
          }}
          className="absolute right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-600 z-10"
          title="Configure Calendar"
          type="button"
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
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Field
              </label>
              <input
                type="text"
                value={config.dateField}
                onChange={(e) => handleConfigChange({ dateField: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                placeholder="publish_date"
              />
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
              <CalendarIcon className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Upcoming Events
              </h3>
            </div>
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">No upcoming events</div>
            ) : (
              <div className="space-y-2">
                {events.map((event, idx) => (
                  <div
                    key={event.id || idx}
                    onClick={() => handleEventClick(event)}
                    className="p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-gray-100 dark:border-gray-800"
                  >
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(event[config.dateField])}
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                      {event.title || event.name || "Untitled"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

