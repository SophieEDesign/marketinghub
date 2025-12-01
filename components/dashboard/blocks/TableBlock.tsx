"use client";

import { useState, useEffect } from "react";
import { Table as TableIcon, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import BlockHeader from "./BlockHeader";
import { getDefaultContent } from "@/lib/utils/dashboardBlockContent";

interface TableBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function TableBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: TableBlockProps) {
  const { openRecord } = useRecordDrawer();
  
  // Normalize content with defaults for backwards compatibility
  const defaults = getDefaultContent("table");
  const normalizedContent = { ...defaults, ...content };
  
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Get display limit - default to 3 rows
  const displayLimit = normalizedContent.limit || 3;
  const limit = expanded ? Infinity : displayLimit;
  const visibleRows = rows.slice(0, limit);
  const hasMore = rows.length > displayLimit;

  // Load table data
  useEffect(() => {
    if (normalizedContent.table && normalizedContent.fields && normalizedContent.fields.length > 0) {
      loadTableData();
    }
  }, [normalizedContent.table, normalizedContent.fields, normalizedContent.filters]);

  const loadTableData = async () => {
    if (!normalizedContent.table || !normalizedContent.fields || normalizedContent.fields.length === 0) {
      return;
    }

    setLoading(true);
    try {
      let query: any = supabase
        .from(normalizedContent.table)
        .select(normalizedContent.fields.join(", "));

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

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(100); // Load more than display limit

      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      console.error("Error loading table data:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (row: any) => {
    if (row.id && normalizedContent.table) {
      openRecord(normalizedContent.table, row.id);
    }
  };

  const title = normalizedContent.title || normalizedContent.table || "Table Block";

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
            <TableIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No table selected</p>
            <p className="text-xs mt-1">Configure in settings</p>
          </div>
        ) : loading ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">No data</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {normalizedContent.fields.slice(0, 3).map((field: string) => (
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
                  {visibleRows.map((row, idx) => (
                    <tr
                      key={row.id || idx}
                      onClick={() => handleRowClick(row)}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      {normalizedContent.fields.slice(0, 3).map((field: string) => (
                        <td key={field} className="px-2 py-2 text-gray-900 dark:text-gray-100">
                          {row[field] ? String(row[field]).slice(0, 30) : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full mt-3 px-3 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md flex items-center justify-center gap-1"
              >
                Show more ({rows.length - displayLimit} more)
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
