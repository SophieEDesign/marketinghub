"use client";

import { useState, useEffect } from "react";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import BlockHeader from "./BlockHeader";
import { getDefaultContent } from "@/lib/utils/dashboardBlockContent";

interface CalendarBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function CalendarBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: CalendarBlockProps) {
  const { openRecord } = useRecordDrawer();
  
  // Normalize content with defaults for backwards compatibility
  const defaults = getDefaultContent("calendar");
  const normalizedContent = { ...defaults, ...content };
  
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Get display limit - default to 10 events
  const displayLimit = normalizedContent.limit || 10;
  const limit = expanded ? Infinity : displayLimit;
  const visibleEvents = events.slice(0, limit);
  const hasMore = events.length > displayLimit;

  // Load upcoming events
  useEffect(() => {
    if (normalizedContent.table && normalizedContent.dateField) {
      loadEvents();
    }
  }, [normalizedContent.table, normalizedContent.dateField, normalizedContent.filters]);

  const loadEvents = async () => {
    if (!normalizedContent.table || !normalizedContent.dateField) {
      return;
    }

    setLoading(true);
    try {
      // Filter out invalid/non-existent columns
      const INVALID_COLUMNS = new Set([
        'track',
        'content_name',
        'date_to',
        'date_due',
        'content_folder_canva',
        'briefings',
        'documents',
      ]);
      
      const validFields = (normalizedContent.fields || []).filter(
        (field: string) => !INVALID_COLUMNS.has(field)
      );
      
      const fieldsToSelect = validFields.length > 0 
        ? `id, ${normalizedContent.dateField}, ${validFields.join(", ")}`
        : `id, ${normalizedContent.dateField}`;
      
      const today = new Date().toISOString().split("T")[0];
      let query: any = supabase
        .from(normalizedContent.table)
        .select(fieldsToSelect)
        .gte(normalizedContent.dateField, today)
        .order(normalizedContent.dateField, { ascending: true });

      // Apply filters if provided
      if (normalizedContent.filters && Array.isArray(normalizedContent.filters)) {
        normalizedContent.filters.forEach((filter: any) => {
          if (filter.field && filter.operator && filter.value !== undefined) {
            switch (filter.operator) {
              case "eq":
                query = query.eq(filter.field, filter.value);
                break;
              case "neq":
                query = query.neq(filter.field, filter.value);
                break;
              case "gt":
                query = query.gt(filter.field, filter.value);
                break;
              case "lt":
                query = query.lt(filter.field, filter.value);
                break;
              case "gte":
                query = query.gte(filter.field, filter.value);
                break;
              case "lte":
                query = query.lte(filter.field, filter.value);
                break;
            }
          }
        });
      }

      const { data, error } = await query.limit(100); // Load more than display limit

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error loading events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEventClick = (event: any) => {
    if (event.id && normalizedContent.table) {
      openRecord(normalizedContent.table, event.id);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const title = normalizedContent.title || "Calendar Block";

  return (
    <>
      <BlockHeader
        title={title}
        editing={editing}
        onOpenSettings={onOpenSettings || (() => {})}
        onDelete={onDelete ? () => onDelete(id) : undefined}
        isDragging={isDragging}
      />
      <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: '400px' }}>
        {!normalizedContent.table ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No table selected</p>
            <p className="text-xs mt-1">Configure in settings</p>
          </div>
        ) : loading ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">No upcoming events</div>
        ) : (
          <>
            <div className="space-y-2">
              {visibleEvents.map((event, idx) => (
                <div
                  key={event.id || idx}
                  onClick={() => handleEventClick(event)}
                  className="p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border border-gray-100 dark:border-gray-800"
                >
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(event[normalizedContent.dateField])}
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {event.title || event.name || "Untitled"}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full mt-3 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md flex items-center justify-center gap-1"
              >
                Show more ({events.length - displayLimit} more)
                <ChevronDown className="w-4 h-4" />
              </button>
            )}
            {expanded && hasMore && (
              <button
                onClick={() => setExpanded(false)}
                className="w-full mt-3 px-3 py-2 text-sm text-gray-600 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md"
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
}
