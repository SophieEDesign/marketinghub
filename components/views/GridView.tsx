"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useDrawer } from "@/lib/drawerState";
import { useFields } from "@/lib/useFields";
import { useViewSettings } from "@/lib/useViewSettings";
import { applyFiltersAndSort } from "@/lib/query/applyFiltersAndSort";
import FieldRenderer from "../fields/FieldRenderer";
import InlineFieldEditor from "../fields/InlineFieldEditor";
import FilterPanel from "../filters/FilterPanel";
import SortPanel from "../sorting/SortPanel";
import FilterBadges from "../filters/FilterBadges";
import { Filter, Sort } from "@/lib/types/filters";
import { Filter as FilterIcon, ArrowUpDown } from "lucide-react";

interface GridViewProps {
  tableId: string;
}

export default function GridView({ tableId }: GridViewProps) {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const viewId = pathParts[1] || "grid";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showSortPanel, setShowSortPanel] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    fieldId: string;
  } | null>(null);
  const { fields, loading: fieldsLoading } = useFields(tableId);
  const { setOpen, setRecordId, setTableId } = useDrawer();
  const {
    settings,
    getViewSettings,
    saveFilters,
    saveSort,
  } = useViewSettings(tableId, viewId);

  const filters = settings?.filters || [];
  const sort = settings?.sort || [];

  // Load view settings on mount (only once)
  useEffect(() => {
    if (tableId && viewId) {
      getViewSettings();
    }
  }, [tableId, viewId]); // Remove getViewSettings from deps to avoid infinite loop

  // Load records with filters and sort
  useEffect(() => {
    if (!tableId) return;
    
    async function load() {
      setLoading(true);

      let query = supabase.from(tableId).select("*");

      // Apply filters and sort
      query = applyFiltersAndSort(query, filters, sort);

      // Default sort if no sort specified
      if (sort.length === 0) {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error } = await query;

      if (!error && data) {
        setRows(data);
      } else if (error) {
        console.error("Error loading records:", error);
      }
      setLoading(false);
    }
    load();
  }, [tableId, filters, sort]);

  const handleFiltersChange = async (newFilters: Filter[]) => {
    await saveFilters(newFilters);
    setShowFilterPanel(false);
  };

  const handleSortChange = async (newSort: Sort[]) => {
    await saveSort(newSort);
    setShowSortPanel(false);
  };

  const handleRemoveFilter = async (filterId: string) => {
    const newFilters = filters.filter((f) => f.id !== filterId);
    await saveFilters(newFilters);
  };

  if (loading || fieldsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">No records found</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Filter/Sort Buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <FilterBadges
            filters={filters}
            fields={fields}
            onRemoveFilter={handleRemoveFilter}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilterPanel(true)}
            className={`btn-secondary flex items-center gap-2 ${filters.length > 0 ? "bg-brand-red/10 text-brand-red border-brand-red" : ""}`}
          >
            <FilterIcon className="w-4 h-4" />
            Filters {filters.length > 0 && `(${filters.length})`}
          </button>
          <button
            onClick={() => setShowSortPanel(true)}
            className={`btn-secondary flex items-center gap-2 ${sort.length > 0 ? "bg-brand-red/10 text-brand-red border-brand-red" : ""}`}
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort {sort.length > 0 && `(${sort.length})`}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      <FilterPanel
        open={showFilterPanel}
        onClose={() => setShowFilterPanel(false)}
        fields={fields}
        filters={filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Sort Panel */}
      <SortPanel
        open={showSortPanel}
        onClose={() => setShowSortPanel(false)}
        fields={fields}
        sort={sort}
        onSortChange={handleSortChange}
      />

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-300 dark:border-gray-700">
            {fields.map((field) => (
              <th key={field.id} className="p-2 font-heading uppercase text-xs tracking-wide text-brand-grey">
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
            >
            {fields.map((field) => {
              const isEditing =
                editingCell?.rowId === row.id &&
                editingCell?.fieldId === field.id;

              return (
                <td
                  key={field.id}
                  className={`p-2 ${field.type === "number" ? "text-right" : ""} ${
                    !isEditing ? "cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (!isEditing) {
                      // For select fields, start inline editing
                      if (
                        field.type === "single_select" ||
                        field.type === "multi_select"
                      ) {
                        setEditingCell({ rowId: row.id, fieldId: field.id });
                      } else {
                        // For other fields, open drawer
                        setTableId(tableId);
                        setRecordId(row.id);
                        setOpen(true);
                      }
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isEditing) {
                      setEditingCell({ rowId: row.id, fieldId: field.id });
                    }
                  }}
                >
                  {isEditing ? (
                    <InlineFieldEditor
                      field={field}
                      value={row[field.field_key]}
                      recordId={row.id}
                      tableId={tableId}
                      onSave={async (newValue) => {
                        const { error } = await supabase
                          .from(tableId)
                          .update({ [field.field_key]: newValue })
                          .eq("id", row.id);

                        if (!error) {
                          // Update local state
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id
                                ? { ...r, [field.field_key]: newValue }
                                : r
                            )
                          );
                          setEditingCell(null);
                        } else {
                          throw error;
                        }
                      }}
                      onCancel={() => setEditingCell(null)}
                    />
                  ) : (
                    <FieldRenderer
                      field={field}
                      value={row[field.field_key]}
                      record={row}
                    />
                  )}
                </td>
              );
            })}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

