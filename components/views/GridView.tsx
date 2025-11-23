"use client";

import React, { useEffect, useState, useTransition, useMemo } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import { useFields } from "@/lib/useFields";
import { useViewSettings } from "@/lib/useViewSettings";
import { applyFiltersAndSort } from "@/lib/query/applyFiltersAndSort";
import { getRequiredColumns } from "@/lib/query/getRequiredColumns";
import { getOrFetch, CacheKeys, invalidateCache } from "@/lib/cache/metadataCache";
import FieldRenderer from "../fields/FieldRenderer";
import InlineFieldEditor from "../fields/InlineFieldEditor";
import ViewHeader from "./ViewHeader";
import SortableColumnHeader from "./SortableColumnHeader";
import { Filter, Sort } from "@/lib/types/filters";
import { runAutomations } from "@/lib/automations/automationEngine";
import { toast } from "../ui/Toast";
import { logFieldChanges } from "@/lib/activityLogger";
import { GridSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";

interface GridViewProps {
  tableId: string;
}

function GridViewComponent({ tableId }: GridViewProps) {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const viewId = pathParts[1] || "grid";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    fieldId: string;
  } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    rowId?: string;
    rowIds?: string[];
  }>({ isOpen: false });
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);
  const { openRecord } = useRecordDrawer();
  const {
    settings,
    getViewSettings,
    saveFilters,
    saveSort,
    setVisibleFields,
    setFieldOrder,
    setRowHeight,
  } = useViewSettings(tableId, viewId);

  const filters = settings?.filters || [];
  const sort = settings?.sort || [];
  const visibleFields = settings?.visible_fields || [];
  const fieldOrder = settings?.field_order || [];
  const rowHeight = settings?.row_height || "medium";

  // Detect mobile
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(typeof window !== "undefined" && window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Apply visible_fields and field_order (memoized) with deduplication
  const fields = useMemo(() => {
    // First, deduplicate by field_key (keep first occurrence)
    const seenKeys = new Set<string>();
    const deduplicated = allFields.filter((f) => {
      if (!f.field_key) {
        console.warn(`Field ${f.id} has no field_key, skipping`);
        return false;
      }
      if (seenKeys.has(f.field_key)) {
        console.warn(`Duplicate field_key "${f.field_key}" found, skipping duplicate`);
        return false;
      }
      seenKeys.add(f.field_key);
      return true;
    });

    let currentFields = deduplicated;
    if (visibleFields.length > 0) {
      currentFields = currentFields.filter((f) => visibleFields.includes(f.id));
    }
    if (fieldOrder.length > 0) {
      currentFields = [...currentFields].sort((a, b) => {
        const aIndex = fieldOrder.indexOf(a.id);
        const bIndex = fieldOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }
    return currentFields;
  }, [allFields, visibleFields, fieldOrder]);

  // Get ordered field IDs for drag-and-drop
  const orderedFieldIds = useMemo(() => {
    return fields.map((f) => f.id);
  }, [fields]);

  // Handle drag end for column reordering
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedFieldIds.indexOf(active.id as string);
    const newIndex = orderedFieldIds.indexOf(over.id as string);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(orderedFieldIds, oldIndex, newIndex);
    await setFieldOrder(newOrder);
    
    // Invalidate cache to refresh view
    invalidateCache(CacheKeys.tableRecords(tableId, "*"));
  };
  
  const handleViewSettingsUpdate = async (updates: {
    visible_fields?: string[];
    field_order?: string[];
    row_height?: "compact" | "medium" | "tall";
  }): Promise<void> => {
    try {
      if (updates.visible_fields !== undefined) await setVisibleFields(updates.visible_fields);
      if (updates.field_order !== undefined) await setFieldOrder(updates.field_order);
      if (updates.row_height !== undefined) await setRowHeight(updates.row_height);
    } catch (error) {
      console.error("Error updating view settings:", error);
    }
  };

  // Load view settings on mount (only once)
  useEffect(() => {
    if (tableId && viewId) {
      getViewSettings();
    }
  }, [tableId, viewId]); // Remove getViewSettings from deps to avoid infinite loop

  // Get required columns based on visible fields
  const requiredColumns = useMemo(() => {
    if (fields.length === 0) return "id, created_at, updated_at";
    return getRequiredColumns(fields);
  }, [fields]);

  // Load records with filters and sort (optimized with caching and column selection)
  useEffect(() => {
    if (!tableId || fieldsLoading) return;
    
    async function load() {
      setLoading(true);

      // Create cache key from filters and sort
      const cacheKey = CacheKeys.tableRecords(
        tableId,
        JSON.stringify({ filters, sort, columns: requiredColumns })
      );

      const loadData = async () => {
        let query = supabase.from(tableId).select(requiredColumns).limit(200);

        // Apply filters and sort
        query = applyFiltersAndSort(query, filters, sort);

        // Default sort if no sort specified
        if (sort.length === 0) {
          query = query.order("created_at", { ascending: false });
        }

        const { data, error } = await query;

        if (!error && data) {
          return data;
        } else if (error) {
          console.error("Error loading records:", error);
          return [];
        }
        return [];
      };

      const data = await getOrFetch(cacheKey, loadData, 2 * 60 * 1000); // 2 min cache
      setRows(data);
      setLoading(false);
    }
    load();
  }, [tableId, filters, sort, requiredColumns, fieldsLoading]);

  const [isPending, startTransition] = useTransition();

  const handleFiltersChange = async (newFilters: Filter[]) => {
    startTransition(() => {
      saveFilters(newFilters);
      // Invalidate cache when filters change
      invalidateCache(CacheKeys.tableRecords(tableId, "*"));
    });
  };

  const handleSortChange = async (newSort: Sort[]) => {
    startTransition(() => {
      saveSort(newSort);
      // Invalidate cache when sort changes
      invalidateCache(CacheKeys.tableRecords(tableId, "*"));
    });
  };

  const handleRemoveFilter = async (filterId: string) => {
    const newFilters = filters.filter((f) => f.id !== filterId);
    await saveFilters(newFilters);
  };

  if (loading || fieldsLoading) {
    return (
      <div>
        <ViewHeader
          tableId={tableId}
          viewId={viewId}
          fields={allFields}
          filters={filters}
          sort={sort}
          onFiltersChange={handleFiltersChange}
          onSortChange={handleSortChange}
          onRemoveFilter={handleRemoveFilter}
          viewSettings={{
            visible_fields: visibleFields,
            field_order: fieldOrder,
            row_height: rowHeight,
          }}
          onViewSettingsUpdate={handleViewSettingsUpdate}
        />
        <GridSkeleton rows={10} cols={fields.length || 5} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        <ViewHeader
          tableId={tableId}
          viewId={viewId}
          fields={allFields}
          filters={filters}
          sort={sort}
          onFiltersChange={handleFiltersChange}
          onSortChange={handleSortChange}
          onRemoveFilter={handleRemoveFilter}
          viewSettings={{
            visible_fields: visibleFields,
            field_order: fieldOrder,
            row_height: rowHeight,
          }}
          onViewSettingsUpdate={handleViewSettingsUpdate}
        />
        <EmptyState
          title="No records found"
          description={filters.length > 0 ? "Try adjusting your filters to see more results." : "Get started by creating your first record."}
          actionLabel={filters.length === 0 ? "Create Record" : undefined}
          onAction={filters.length === 0 ? () => {
            // Open new record modal - would need to import useModal
            window.location.href = `/${tableId}/grid`;
          } : undefined}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header with Filter/Sort/Settings Buttons */}
      <ViewHeader
        tableId={tableId}
        viewId={viewId}
        fields={allFields}
        filters={filters}
        sort={sort}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        onRemoveFilter={handleRemoveFilter}
        viewSettings={{
          visible_fields: visibleFields,
          field_order: fieldOrder,
          row_height: rowHeight,
        }}
        onViewSettingsUpdate={handleViewSettingsUpdate}
        selectedRowCount={selectedRows.size}
        onBulkDelete={
          selectedRows.size > 0
            ? () => setDeleteConfirm({ isOpen: true, rowIds: Array.from(selectedRows) })
            : undefined
        }
      />

      {/* Table - Fixed horizontal scroll */}
      <div className="flex-1 w-full min-w-0 overflow-hidden">
        <div className="overflow-auto w-full min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <SortableContext items={orderedFieldIds} strategy={horizontalListSortingStrategy}>
                      {fields.map((field) => (
                        <SortableColumnHeader
                          key={field.id}
                          id={field.id}
                          label={field.label}
                          isMobile={isMobile}
                        />
                      ))}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={`transition-colors duration-150 ${
                  index % 2 === 0 
                    ? "bg-white dark:bg-gray-900" 
                    : "bg-gray-50/50 dark:bg-gray-800/50"
                } hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${
                  rowHeight === "compact" ? "h-10" : rowHeight === "tall" ? "h-20" : "h-14"
                } ${selectedRows.has(row.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}
              >
                <td className="px-2">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(row.id)}
                    onChange={(e) => {
                      const newSelected = new Set(selectedRows);
                      if (e.target.checked) {
                        newSelected.add(row.id);
                      } else {
                        newSelected.delete(row.id);
                      }
                      setSelectedRows(newSelected);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
            {fields.map((field) => {
              const isEditing =
                editingCell?.rowId === row.id &&
                editingCell?.fieldId === field.id;

              return (
                <td
                  key={field.id}
                  className={`px-4 py-3 text-sm ${field.type === "number" ? "text-right" : ""} ${
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
                        openRecord(tableId, row.id);
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
                        try {
                          // Store previous state for automation comparison
                          const previousRecord = { ...row };

                          // Update the field
                          const { error, data: updatedRecord } = await supabase
                            .from(tableId)
                            .update({ [field.field_key]: newValue })
                            .eq("id", row.id)
                            .select()
                            .single();

                          if (error) {
                            throw error;
                          }

                          if (!updatedRecord) {
                            throw new Error("Failed to update record");
                          }

                          // Log field change
                          await logFieldChanges(previousRecord, updatedRecord, tableId, "user");

                          // Run automations
                          try {
                            const automationResult = await runAutomations(
                              tableId,
                              updatedRecord,
                              previousRecord
                            );

                            // Apply any updates from automations
                            if (automationResult.updated && Object.keys(automationResult.updated).length > 0) {
                              const automationUpdates: Record<string, any> = {};
                              Object.keys(automationResult.updated).forEach((key) => {
                                if (key !== "id" && automationResult.updated[key] !== updatedRecord[key]) {
                                  automationUpdates[key] = automationResult.updated[key];
                                }
                              });

                              if (Object.keys(automationUpdates).length > 0) {
                                const { data: finalRecord } = await supabase
                                  .from(tableId)
                                  .update(automationUpdates)
                                  .eq("id", row.id)
                                  .select()
                                  .single();

                                if (finalRecord) {
                                  // Log automation changes
                                  await logFieldChanges(updatedRecord, finalRecord, tableId, "automation");
                                  // Update local state with final record
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id ? finalRecord : r
                                    )
                                  );
                                }
                              } else {
                                // Update local state with updated record
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? updatedRecord : r
                                  )
                                );
                              }
                            } else {
                              // Update local state with updated record
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? updatedRecord : r
                                )
                              );
                            }

                            // Show notifications
                            automationResult.notifications.forEach((notification) => {
                              toast({
                                title: "Automation Triggered",
                                description: notification,
                                type: "success",
                              });
                            });
                          } catch (automationError) {
                            console.error("Error running automations:", automationError);
                            // Still update local state even if automations fail
                            setRows((prev) =>
                              prev.map((r) =>
                                r.id === row.id ? updatedRecord : r
                              )
                            );
                          }

                          setEditingCell(null);
                        } catch (error: any) {
                          console.error("Error saving field:", error);
                          toast({
                            title: "Error",
                            description: error.message || "Failed to save changes",
                            type: "error",
                          });
                          setEditingCell(null);
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
            </DndContext>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoize GridView to prevent unnecessary re-renders
const GridView = React.memo(GridViewComponent);
export default GridView;

