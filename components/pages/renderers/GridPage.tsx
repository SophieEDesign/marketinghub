"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { GridPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import Button from "@/components/ui/Button";

interface GridPageProps {
  page: InterfacePage;
  config: GridPageConfig | null;
  isEditing?: boolean;
}

export default function GridPage({ page, config, isEditing }: GridPageProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [pageSize] = useState(50);
  const { fields: allFields } = useFields(config?.table || "");

  // Get visible fields from config or all fields
  const visibleFields = useMemo(() => {
    if (!config?.fields || config.fields.length === 0) {
      return allFields.slice(0, 10); // Default to first 10 fields
    }
    return allFields.filter((f) => config.fields.includes(f.key));
  }, [config?.fields, allFields]);

  // Load records
  useEffect(() => {
    if (!config?.table) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        let query = supabase.from(config.table).select("*");

        // Apply filters
        if (config.filters && config.filters.length > 0) {
          for (const filter of config.filters) {
            if (filter.operator === "equals") {
              query = query.eq(filter.field, filter.value);
            } else if (filter.operator === "not_equals") {
              query = query.neq(filter.field, filter.value);
            } else if (filter.operator === "contains") {
              query = query.ilike(filter.field, `%${filter.value}%`);
            } else if (filter.operator === "greater_than") {
              query = query.gt(filter.field, filter.value);
            } else if (filter.operator === "less_than") {
              query = query.lt(filter.field, filter.value);
            }
            // Add more operators as needed
          }
        }

        // Apply sorts
        if (config.sorts && config.sorts.length > 0) {
          for (const sort of config.sorts) {
            query = query.order(sort.field, { ascending: sort.direction === "asc" });
          }
        } else if (sortField) {
          query = query.order(sortField, { ascending: sortDirection === "asc" });
        }

        // Pagination
        const from = (currentPage - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);

        const { data, error } = await query;

        if (error) throw error;
        setRecords(data || []);
      } catch (error: any) {
        console.error("Error loading records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [config, currentPage, sortField, sortDirection]);

  const handleSort = (fieldKey: string) => {
    if (sortField === fieldKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(fieldKey);
      setSortDirection("asc");
    }
  };

  const formatValue = (value: any, field: any) => {
    if (value === null || value === undefined) return "-";
    
    if (field.type === "attachment" && Array.isArray(value)) {
      return `${value.length} file(s)`;
    }
    
    if (field.type === "linked_record" && Array.isArray(value)) {
      return `${value.length} record(s)`;
    }
    
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    
    return String(value);
  };

  if (!config?.table) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table and fields in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  if (loading && records.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading records...
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Grid Table */}
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
        <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {visibleFields.map((field) => (
                <th
                  key={field.key}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort(field.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{field.label || field.key}</span>
                    {sortField === field.key ? (
                      sortDirection === "asc" ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-50" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {records.length === 0 ? (
              <tr>
                <td colSpan={visibleFields.length} className="px-4 py-8 text-center text-gray-500">
                  No records found
                </td>
              </tr>
            ) : (
              records.map((record, idx) => (
                <tr
                  key={record.id || idx}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {visibleFields.map((field) => (
                    <td
                      key={field.key}
                      className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {formatValue(record[field.key], field)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {records.length >= pageSize && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {currentPage}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => p + 1)}
              disabled={records.length < pageSize}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
