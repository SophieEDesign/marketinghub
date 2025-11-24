"use client";

import { useState, useEffect } from "react";
import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { supabase } from "@/lib/supabaseClient";
import { usePageContext } from "../PageContext";
import { queryTable } from "@/lib/query/queryTable";

interface ListBlockProps {
  block: InterfacePageBlock;
}

export default function ListBlock({ block }: ListBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "";
  const fields = config.fields || [];
  const limit = config.limit || 10;
  const { getSharedFilters } = usePageContext();
  
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get shared filters from FilterBlock components
  const sharedFilters = tableName ? getSharedFilters(tableName) : [];

  useEffect(() => {
    if (tableName) {
      loadData();
    }
  }, [tableName, fields, limit, sharedFilters]);

  const loadData = async () => {
    if (!tableName) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Combine block filters with shared filters
      const allFilters = [
        ...(config.filters || []),
        ...sharedFilters
      ];

      const result = await queryTable({
        table: tableName,
        fields: fields.length > 0 ? fields : undefined,
        filters: allFilters.length > 0 ? allFilters : undefined,
        sort: config.sort || [{ field: "created_at", direction: "desc" }],
        limit: limit,
      });

      setRows(result.data || []);
    } catch (err: any) {
      console.error("Error loading list data:", err);
      setError(err.message || "Failed to load data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (!tableName) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">List Block Not Configured</p>
          <p className="text-xs">Click the settings icon to select a table</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full p-4">
        <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="w-full h-full p-4">
        <div className="text-sm text-gray-500 dark:text-gray-400">No data found</div>
      </div>
    );
  }

  // Determine which fields to display
  const displayFields = fields.length > 0 ? fields : Object.keys(rows[0] || {}).slice(0, 5);

  return (
    <div className="w-full h-full p-4 overflow-auto">
      <div className="space-y-2">
        {rows.map((row, idx) => (
          <div
            key={row.id || idx}
            className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition"
          >
            <div className="flex flex-wrap gap-2">
              {displayFields.map((field: string) => (
                <div key={field} className="flex-1 min-w-[120px]">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">
                    {field.replace(/_/g, " ")}
                  </div>
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {row[field] !== null && row[field] !== undefined
                      ? String(row[field]).slice(0, 50)
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

