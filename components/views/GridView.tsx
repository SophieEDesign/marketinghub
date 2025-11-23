"use client";

import React, { useEffect, useState, useTransition, useMemo, Fragment } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useRecordDrawer } from "@/components/record-drawer/RecordDrawerProvider";
import { useFields } from "@/lib/useFields";
import { useViewConfigs } from "@/lib/useViewConfigs";
import { applyFiltersAndSort } from "@/lib/query/applyFiltersAndSort";
import { getRequiredColumns } from "@/lib/query/getRequiredColumns";
import { getOrFetch, CacheKeys, invalidateCache } from "@/lib/cache/metadataCache";
import FieldRenderer from "../fields/FieldRenderer";
import InlineFieldEditor from "../fields/InlineFieldEditor";
import ViewHeader from "./ViewHeader";
import EnhancedColumnHeader from "../grid/EnhancedColumnHeader";
import { Filter, Sort } from "@/lib/types/filters";
import { runAutomations } from "@/lib/automations/automationEngine";
import { toast } from "../ui/Toast";
import { logFieldChanges } from "@/lib/activityLogger";
import { GridSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import DeleteConfirmModal from "../ui/DeleteConfirmModal";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useUndo } from "@/lib/undo/useUndo";
import UndoToast from "../common/UndoToast";

interface GridViewProps {
  tableId: string;
}

function GridViewComponent({ tableId }: GridViewProps) {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const viewId = pathParts[1] || "grid";
  const permissions = usePermissions();
  const { addAction, undo, lastAction, canUndo } = useUndo();
  const [dismissedAction, setDismissedAction] = useState<string | null>(null);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);
  const { openRecord } = useRecordDrawer();
  const {
    currentView,
    views,
    loading: viewConfigLoading,
    error: viewConfigError,
    saveCurrentView,
    switchToViewByName,
    reloadViews,
    createView,
    updateView,
    deleteView,
    setDefaultView,
  } = useViewConfigs(tableId);

  // Switch to view by name when viewId changes
  useEffect(() => {
    if (viewId && currentView && currentView.view_name !== viewId && currentView.id !== viewId) {
      switchToViewByName(viewId);
    }
  }, [viewId, currentView, switchToViewByName]);

  // Extract config from currentView
  const filters = currentView?.filters || [];
  const sort = currentView?.sort || [];
  const hiddenColumns = currentView?.hidden_columns || [];
  const columnOrder = currentView?.column_order || [];
  const columnWidths = currentView?.column_widths || {};
  const groupings = currentView?.groupings || [];
  const rowHeight = currentView?.row_height || "medium";

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

  // Organize fields by groups
  const { groupedFields, ungroupedFields } = useMemo(() => {
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
    // Filter out hidden columns
    if (hiddenColumns.length > 0) {
      currentFields = currentFields.filter((f) => !hiddenColumns.includes(f.id));
    }
    // Apply column order
    if (columnOrder.length > 0) {
      currentFields = [...currentFields].sort((a, b) => {
        const aIndex = columnOrder.indexOf(a.id);
        const bIndex = columnOrder.indexOf(b.id);
        if (aIndex === -1 && bIndex === -1) return 0;
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      });
    }

    // Organize by groups
    const grouped: Array<{ group: { name: string; fields: string[] }; fields: typeof currentFields }> = [];
    const groupedFieldIds = new Set<string>();
    
    if (groupings.length > 0) {
      groupings.forEach((group) => {
        const groupFields = currentFields.filter((f) => group.fields.includes(f.id));
        if (groupFields.length > 0) {
          grouped.push({ group, fields: groupFields });
          groupFields.forEach((f) => groupedFieldIds.add(f.id));
        }
      });
    }

    const ungrouped = currentFields.filter((f) => !groupedFieldIds.has(f.id));

    return { groupedFields: grouped, ungroupedFields: ungrouped };
  }, [allFields, hiddenColumns, columnOrder, groupings]);

  // Flatten for orderedFieldIds
  const fields = useMemo(() => {
    const all: typeof allFields = [];
    groupedFields.forEach((g) => all.push(...g.fields));
    all.push(...ungroupedFields);
    return all;
  }, [groupedFields, ungroupedFields]);

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
    await saveCurrentView({ column_order: newOrder });
    
    // Invalidate cache to refresh view
    invalidateCache(CacheKeys.tableRecords(tableId, "*"));
  };
  
  const handleViewSettingsUpdate = async (updates: {
    visible_fields?: string[];
    field_order?: string[];
    hidden_columns?: string[];
    column_order?: string[];
    row_height?: "compact" | "medium" | "tall";
    column_widths?: Record<string, number>;
    groupings?: Array<{ name: string; fields: string[] }>;
    kanban_group_field?: string;
    calendar_date_field?: string;
    timeline_date_field?: string;
    card_fields?: string[];
    filters?: any[];
    sort?: any[];
  }): Promise<void> => {
    try {
      // Map legacy properties to new ones
      const mappedUpdates: any = { ...updates };
      
      // Convert visible_fields to hidden_columns
      if (updates.visible_fields !== undefined) {
        const allFieldIds = fields.map((f) => f.id);
        mappedUpdates.hidden_columns = allFieldIds.filter((id) => !updates.visible_fields!.includes(id));
        delete mappedUpdates.visible_fields;
      }
      
      // Map field_order to column_order
      if (updates.field_order !== undefined) {
        mappedUpdates.column_order = updates.field_order;
        delete mappedUpdates.field_order;
      }
      
      await saveCurrentView(mappedUpdates);
      
      // Invalidate cache to refresh view
      invalidateCache(CacheKeys.tableRecords(tableId, "*"));
    } catch (error) {
      console.error("Error updating view settings:", error);
      toast({
        title: "Error",
        description: "Failed to update view settings",
        type: "error",
      });
    }
  };

  // Get required columns based on visible fields
  const requiredColumns = useMemo(() => {
    if (fields.length === 0) return "id, created_at, updated_at";
    return getRequiredColumns(fields);
  }, [fields]);

  // Load records with filters and sort (optimized with caching and column selection)
  useEffect(() => {
    if (!tableId) return;
    
    async function load() {
      setLoading(true);

      // Create cache key from filters and sort
      const cacheKey = CacheKeys.tableRecords(
        tableId,
        JSON.stringify({ filters, sort, columns: requiredColumns })
      );

      const loadData = async () => {
        // If fields are still loading or we have no fields, use select all to avoid column errors
        if (fieldsLoading || fields.length === 0) {
          console.log(`Fields not ready for ${tableId}, using select('*')`);
          const offset = (currentPage - 1) * recordsPerPage;
          let query = supabase.from(tableId).select("*").range(offset, offset + recordsPerPage - 1);
          query = applyFiltersAndSort(query, filters, sort);
          if (sort.length === 0) {
            query = query.order("created_at", { ascending: false });
          }
          const { data, error } = await query;
          if (error) {
            console.error("Error loading records with select(*):", error);
            if (error.code === '42P01') {
              setError(`Table "${tableId}" does not exist in the database. Please create it in Supabase.`);
            } else {
              setError(`Error loading records: ${error.message}`);
            }
            return [];
          }
          setError(null);
          return data || [];
        }

        // Get total count first (for pagination)
        const { count } = await supabase
          .from(tableId)
          .select("*", { count: "exact", head: true });
        
        if (count !== null) {
          setTotalRecords(count);
          setHasMore(count > recordsPerPage);
        }

        // Try with specific columns first
        const offset = (currentPage - 1) * recordsPerPage;
        let query = supabase.from(tableId).select(requiredColumns).range(offset, offset + recordsPerPage - 1);

        // Apply filters and sort
        query = applyFiltersAndSort(query, filters, sort);

        // Default sort if no sort specified
        if (sort.length === 0) {
          query = query.order("created_at", { ascending: false });
        }

        let { data, error } = await query;

        // If error is due to missing columns, fall back to select all
        if (error && (error.code === '42703' || error.message?.includes('does not exist') || error.message?.includes('column') || error.code === '42P01')) {
          console.warn(`Some columns don't exist (${error.message}), falling back to select('*'):`, error);
          // Retry with select all
          const offset = (currentPage - 1) * recordsPerPage;
          let fallbackQuery = supabase.from(tableId).select("*").range(offset, offset + recordsPerPage - 1);
          fallbackQuery = applyFiltersAndSort(fallbackQuery, filters, sort);
          if (sort.length === 0) {
            fallbackQuery = fallbackQuery.order("created_at", { ascending: false });
          }
          const fallbackResult = await fallbackQuery;
          if (!fallbackResult.error && fallbackResult.data) {
            setError(null);
            return fallbackResult.data;
          } else if (fallbackResult.error) {
            console.error("Fallback query also failed:", fallbackResult.error);
            // If table doesn't exist, return empty array
            if (fallbackResult.error.code === '42P01') {
              setError(`Table "${tableId}" does not exist in the database. Please create it in Supabase.`);
              return [];
            }
            setError(`Error loading records: ${fallbackResult.error.message}`);
            return [];
          }
        }

        if (!error && data) {
          setError(null);
          return data;
        } else if (error) {
          console.error("Error loading records:", error);
          // If table doesn't exist, return empty array
          if (error.code === '42P01') {
            setError(`Table "${tableId}" does not exist in the database. Please create it in Supabase.`);
            return [];
          }
          setError(`Error loading records: ${error.message}`);
          return [];
        }
        return [];
      };

      const data = await getOrFetch(cacheKey, loadData, 2 * 60 * 1000); // 2 min cache
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [tableId, filters, sort, requiredColumns, fieldsLoading, fields, currentPage]);
  
  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sort]);

  const [isPending, startTransition] = useTransition();

  const handleFiltersChange = async (newFilters: Filter[]) => {
    startTransition(async () => {
      await saveCurrentView({ filters: newFilters });
      // Invalidate cache when filters change
      invalidateCache(CacheKeys.tableRecords(tableId, "*"));
    });
  };

  const handleSortChange = async (newSort: Sort[]) => {
    startTransition(async () => {
      await saveCurrentView({ sort: newSort });
      // Invalidate cache when sort changes
      invalidateCache(CacheKeys.tableRecords(tableId, "*"));
    });
  };

  const handleRemoveFilter = async (filterId: string) => {
    const newFilters = filters.filter((f) => f.id !== filterId);
    await saveCurrentView({ filters: newFilters });
    invalidateCache(CacheKeys.tableRecords(tableId, "*"));
  };

  const handleDelete = async () => {
    const idsToDelete = deleteConfirm.rowIds || (deleteConfirm.rowId ? [deleteConfirm.rowId] : []);
    if (idsToDelete.length === 0) return;

    try {
      // Store deleted rows for undo
      const deletedRows = rows.filter((row) => idsToDelete.includes(row.id));

      const { error } = await supabase
        .from(tableId)
        .delete()
        .in("id", idsToDelete);

      if (error) {
        throw error;
      }

      // Add undo action
      addAction({
        type: "delete_records",
        description: `Deleted ${idsToDelete.length} record${idsToDelete.length > 1 ? "s" : ""}`,
        undo: async () => {
          // Restore deleted rows
          for (const row of deletedRows) {
            const { id, ...rowData } = row;
            await supabase.from(tableId).insert([rowData]);
          }
          invalidateCache(CacheKeys.tableRecords(tableId, "*"));
          setRows((prevRows) => [...prevRows, ...deletedRows]);
        },
        redo: async () => {
          await supabase
            .from(tableId)
            .delete()
            .in("id", idsToDelete);
          invalidateCache(CacheKeys.tableRecords(tableId, "*"));
          setRows((prevRows) => prevRows.filter((row) => !idsToDelete.includes(row.id)));
        },
      });

      // Remove deleted rows from local state
      setRows((prevRows) => prevRows.filter((row) => !idsToDelete.includes(row.id)));
      
      // Clear selection
      setSelectedRows(new Set());
      
      // Invalidate cache
      invalidateCache(CacheKeys.tableRecords(tableId, "*"));

      toast({
        title: "Success",
        description: `${idsToDelete.length} record${idsToDelete.length > 1 ? "s" : ""} deleted successfully`,
        type: "success",
      });

      setDeleteConfirm({ isOpen: false });
    } catch (error: any) {
      console.error("Error deleting records:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete records",
        type: "error",
      });
    }
  };

  // Show error message if there's an error
  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Error Loading Table</h3>
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              // Force reload by clearing cache and reloading
              invalidateCache(CacheKeys.tableRecords(tableId, "*"));
              window.location.reload();
            }}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || fieldsLoading || viewConfigLoading) {
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
            visible_fields: fields.filter((f) => !hiddenColumns.includes(f.id)).map((f) => f.id),
            field_order: columnOrder.length > 0 ? columnOrder : fields.map((f) => f.id),
            hidden_columns: hiddenColumns,
            column_order: columnOrder,
            column_widths: columnWidths,
            groupings: groupings,
            row_height: rowHeight,
            kanban_group_field: currentView?.kanban_group_field,
            calendar_date_field: currentView?.calendar_date_field,
            timeline_date_field: currentView?.timeline_date_field,
            card_fields: currentView?.card_fields,
          }}
          onViewSettingsUpdate={handleViewSettingsUpdate}
          currentView={currentView}
          views={views}
          onRenameView={async (newName: string) => {
            if (currentView?.id) {
              await updateView(currentView.id, { view_name: newName });
              await reloadViews();
            }
          }}
          onDuplicateView={async () => {
            if (currentView) {
              const newName = `${currentView.view_name} (Copy)`;
              await createView(newName, currentView);
              await reloadViews();
            }
          }}
          onDeleteView={async () => {
            if (currentView?.id && views.length > 1) {
              if (confirm(`Delete view "${currentView.view_name}"?`)) {
                await deleteView(currentView.id);
                await reloadViews();
              }
            }
          }}
          onSetDefaultView={async () => {
            if (currentView?.id) {
              await setDefaultView(currentView.id);
              await reloadViews();
            }
          }}
          onChangeViewType={async (viewType) => {
            if (currentView?.id) {
              await updateView(currentView.id, { view_type: viewType });
              await reloadViews();
              window.location.href = `/${tableId}/${viewType}`;
            }
          }}
          onResetLayout={async () => {
            if (currentView?.id) {
              await updateView(currentView.id, {
                column_order: [],
                column_widths: {},
                hidden_columns: [],
                groupings: [],
              });
              await reloadViews();
              invalidateCache(CacheKeys.tableRecords(tableId, "*"));
            }
          }}
          onCreateView={async () => {
            const name = prompt("Enter view name:");
            if (name) {
              await createView(name);
              await reloadViews();
            }
          }}
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
            visible_fields: fields.filter((f) => !hiddenColumns.includes(f.id)).map((f) => f.id),
            field_order: columnOrder.length > 0 ? columnOrder : fields.map((f) => f.id),
            hidden_columns: hiddenColumns,
            column_order: columnOrder,
            column_widths: columnWidths,
            groupings: groupings,
            row_height: rowHeight,
            kanban_group_field: currentView?.kanban_group_field,
            calendar_date_field: currentView?.calendar_date_field,
            timeline_date_field: currentView?.timeline_date_field,
            card_fields: currentView?.card_fields,
          }}
          onViewSettingsUpdate={handleViewSettingsUpdate}
          currentView={currentView}
          views={views}
          onRenameView={async (newName: string) => {
            if (currentView?.id) {
              await updateView(currentView.id, { view_name: newName });
              await reloadViews();
            }
          }}
          onDuplicateView={async () => {
            if (currentView) {
              const newName = `${currentView.view_name} (Copy)`;
              await createView(newName, currentView);
              await reloadViews();
            }
          }}
          onDeleteView={async () => {
            if (currentView?.id && views.length > 1) {
              if (confirm(`Delete view "${currentView.view_name}"?`)) {
                await deleteView(currentView.id);
                await reloadViews();
              }
            }
          }}
          onSetDefaultView={async () => {
            if (currentView?.id) {
              await setDefaultView(currentView.id);
              await reloadViews();
            }
          }}
          onChangeViewType={async (viewType) => {
            if (currentView?.id) {
              await updateView(currentView.id, { view_type: viewType });
              await reloadViews();
              window.location.href = `/${tableId}/${viewType}`;
            }
          }}
          onResetLayout={async () => {
            if (currentView?.id) {
              await updateView(currentView.id, {
                column_order: [],
                column_widths: {},
                hidden_columns: [],
                groupings: [],
              });
              await reloadViews();
              invalidateCache(CacheKeys.tableRecords(tableId, "*"));
            }
          }}
          onCreateView={async () => {
            const name = prompt("Enter view name:");
            if (name) {
              await createView(name);
              await reloadViews();
            }
          }}
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
          hidden_columns: hiddenColumns,
          column_order: columnOrder,
          column_widths: columnWidths,
          groupings: groupings,
          row_height: rowHeight,
        }}
        currentView={currentView}
        views={views}
        onRenameView={async (newName: string) => {
          if (currentView?.id) {
            await updateView(currentView.id, { view_name: newName });
            await reloadViews();
          }
        }}
        onDuplicateView={async () => {
          if (currentView) {
            const newName = `${currentView.view_name} (Copy)`;
            await createView(newName, currentView);
            await reloadViews();
          }
        }}
        onDeleteView={async () => {
          if (currentView?.id && views.length > 1) {
            if (confirm(`Delete view "${currentView.view_name}"?`)) {
              await deleteView(currentView.id);
              await reloadViews();
            }
          }
        }}
        onSetDefaultView={async () => {
          if (currentView?.id) {
            await setDefaultView(currentView.id);
            await reloadViews();
          }
        }}
        onChangeViewType={async (viewType) => {
          if (currentView?.id) {
            await updateView(currentView.id, { view_type: viewType });
            await reloadViews();
            window.location.href = `/${tableId}/${viewType}`;
          }
        }}
        onResetLayout={async () => {
          if (currentView?.id) {
            await updateView(currentView.id, {
              column_order: [],
              column_widths: {},
              hidden_columns: [],
              groupings: [],
            });
            await reloadViews();
            invalidateCache(CacheKeys.tableRecords(tableId, "*"));
          }
        }}
        onCreateView={async () => {
          const name = prompt("Enter view name:");
          if (name) {
            await createView(name);
            await reloadViews();
          }
        }}
        onViewSettingsUpdate={handleViewSettingsUpdate}
        selectedRowCount={selectedRows.size}
        onBulkDelete={
          selectedRows.size > 0 && permissions.canDelete
            ? () => setDeleteConfirm({ isOpen: true, rowIds: Array.from(selectedRows) })
            : undefined
        }
      />

      {/* Table - Fixed horizontal scroll */}
      <div className="flex-1 w-full min-w-0 overflow-hidden -mx-6 px-6">
        <div className="overflow-auto w-full min-w-0 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm">
          <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
            <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 border-b border-gray-200 dark:border-gray-700">
                  {/* Group Headers */}
                  {groupedFields.map((groupData) => {
                    const isCollapsed = collapsedGroups.has(groupData.group.name);
                    return (
                      <tr key={`group-${groupData.group.name}`} className="bg-gray-100 dark:bg-gray-800 border-b-2 border-gray-300 dark:border-gray-600">
                        <th colSpan={1000} className="px-4 py-2">
                          <button
                            onClick={() => {
                              setCollapsedGroups((prev) => {
                                const next = new Set(prev);
                                if (next.has(groupData.group.name)) {
                                  next.delete(groupData.group.name);
                                } else {
                                  next.add(groupData.group.name);
                                }
                                return next;
                              });
                            }}
                            className="flex items-center gap-2 w-full text-left hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-2 py-1 transition-colors"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                              {groupData.group.name}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              ({groupData.fields.length} field{groupData.fields.length !== 1 ? "s" : ""})
                            </span>
                          </button>
                        </th>
                      </tr>
                    );
                  })}
                  {/* Column Headers Row */}
                  <tr>
                    <th className="px-2 w-12">
                      <input
                        type="checkbox"
                        checked={rows.length > 0 && selectedRows.size === rows.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRows(new Set(rows.map((r) => r.id)));
                          } else {
                            setSelectedRows(new Set());
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <SortableContext items={orderedFieldIds} strategy={horizontalListSortingStrategy}>
                      {groupedFields.map((groupData) => {
                        const isCollapsed = collapsedGroups.has(groupData.group.name);
                        if (isCollapsed) return null;
                        return groupData.fields.map((field) => {
                          const globalIndex = fields.indexOf(field);
                          return (
                            <EnhancedColumnHeader
                              key={field.id}
                              field={field}
                              width={columnWidths[field.id]}
                              isMobile={isMobile}
                              onResize={async (fieldId, newWidth) => {
                                await saveCurrentView({
                                  column_widths: { ...columnWidths, [fieldId]: newWidth },
                                });
                              }}
                              onHide={async (fieldId) => {
                                await saveCurrentView({
                                  hidden_columns: [...hiddenColumns, fieldId],
                                });
                                invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                              }}
                              onRename={async (fieldId, newName) => {
                                console.log("Rename column:", fieldId, newName);
                              }}
                              onMoveLeft={globalIndex > 0 ? async (fieldId) => {
                                const currentIndex = columnOrder.indexOf(fieldId);
                                if (currentIndex > 0) {
                                  const newOrder = [...columnOrder];
                                  [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
                                  await saveCurrentView({ column_order: newOrder });
                                  invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                                }
                              } : undefined}
                              onMoveRight={globalIndex < fields.length - 1 ? async (fieldId) => {
                                const currentIndex = columnOrder.indexOf(fieldId);
                                if (currentIndex < columnOrder.length - 1) {
                                  const newOrder = [...columnOrder];
                                  [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
                                  await saveCurrentView({ column_order: newOrder });
                                  invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                                }
                              } : undefined}
                              onResetWidth={async (fieldId) => {
                                const newWidths = { ...columnWidths };
                                delete newWidths[fieldId];
                                await saveCurrentView({ column_widths: newWidths });
                              }}
                              canMoveLeft={globalIndex > 0}
                              canMoveRight={globalIndex < fields.length - 1}
                              isFirst={globalIndex === 0}
                              isLast={globalIndex === fields.length - 1}
                            />
                          );
                        });
                      })}
                      {ungroupedFields.map((field) => {
                        const globalIndex = fields.indexOf(field);
                        return (
                          <EnhancedColumnHeader
                            key={field.id}
                            field={field}
                            width={columnWidths[field.id]}
                            isMobile={isMobile}
                            onResize={async (fieldId, newWidth) => {
                              await saveCurrentView({
                                column_widths: { ...columnWidths, [fieldId]: newWidth },
                              });
                            }}
                            onHide={async (fieldId) => {
                              await saveCurrentView({
                                hidden_columns: [...hiddenColumns, fieldId],
                              });
                              invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                            }}
                            onRename={async (fieldId, newName) => {
                              console.log("Rename column:", fieldId, newName);
                            }}
                            onMoveLeft={globalIndex > 0 ? async (fieldId) => {
                              const currentIndex = columnOrder.indexOf(fieldId);
                              if (currentIndex > 0) {
                                const newOrder = [...columnOrder];
                                [newOrder[currentIndex - 1], newOrder[currentIndex]] = [newOrder[currentIndex], newOrder[currentIndex - 1]];
                                await saveCurrentView({ column_order: newOrder });
                                invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                              }
                            } : undefined}
                            onMoveRight={globalIndex < fields.length - 1 ? async (fieldId) => {
                              const currentIndex = columnOrder.indexOf(fieldId);
                              if (currentIndex < columnOrder.length - 1) {
                                const newOrder = [...columnOrder];
                                [newOrder[currentIndex], newOrder[currentIndex + 1]] = [newOrder[currentIndex + 1], newOrder[currentIndex]];
                                await saveCurrentView({ column_order: newOrder });
                                invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                              }
                            } : undefined}
                            onResetWidth={async (fieldId) => {
                              const newWidths = { ...columnWidths };
                              delete newWidths[fieldId];
                              await saveCurrentView({ column_widths: newWidths });
                            }}
                            canMoveLeft={globalIndex > 0}
                            canMoveRight={globalIndex < fields.length - 1}
                            isFirst={globalIndex === 0}
                            isLast={globalIndex === fields.length - 1}
                          />
                        );
                      })}
                    </SortableContext>
                  </tr>
                </thead>
                <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                className={`transition-all duration-200 ease-in-out ${
                  index % 2 === 0 
                    ? "bg-white dark:bg-gray-900" 
                    : "bg-gray-50/50 dark:bg-gray-800/50"
                } hover:bg-gray-100 dark:hover:bg-gray-800 hover:shadow-sm border-b border-gray-200 dark:border-gray-700 ${
                  rowHeight === "compact" ? "h-10" : rowHeight === "tall" ? "h-20" : "h-14"
                } ${selectedRows.has(row.id) ? "bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800" : ""}`}
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

              const cellWidth = columnWidths[field.id];
              return (
                <td
                  key={field.id}
                  style={cellWidth ? { width: `${cellWidth}px`, minWidth: `${cellWidth}px` } : undefined}
                  className={`px-4 py-3 text-sm transition-colors duration-150 ${field.type === "number" ? "text-right" : ""} ${
                    !isEditing ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50" : ""
                  }`}
                  onClick={() => {
                    if (!isEditing && permissions.canEdit) {
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
                    } else if (!isEditing) {
                      // Viewers can still open the drawer to view
                      openRecord(tableId, row.id);
                    }
                  }}
                  onDoubleClick={() => {
                    if (!isEditing && permissions.canEdit) {
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
                          const previousValue = previousRecord[field.field_key];

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

                          // Add undo action
                          addAction({
                            type: "field_edit",
                            description: `Updated ${field.label}`,
                            undo: async () => {
                              await supabase
                                .from(tableId)
                                .update({ [field.field_key]: previousValue })
                                .eq("id", row.id);
                              invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, [field.field_key]: previousValue } : r
                                )
                              );
                            },
                            redo: async () => {
                              await supabase
                                .from(tableId)
                                .update({ [field.field_key]: newValue })
                                .eq("id", row.id);
                              invalidateCache(CacheKeys.tableRecords(tableId, "*"));
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? updatedRecord : r
                                )
                              );
                            },
                          });

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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={handleDelete}
        title={deleteConfirm.rowIds && deleteConfirm.rowIds.length > 1 ? "Delete Records" : "Delete Record"}
        message={
          deleteConfirm.rowIds && deleteConfirm.rowIds.length > 1
            ? `Are you sure you want to delete ${deleteConfirm.rowIds.length} records?`
            : "Are you sure you want to delete this record?"
        }
        confirmText="Delete"
        cancelText="Cancel"
      />

      {/* Undo Toast */}
      {lastAction && lastAction.id !== dismissedAction && (
        <UndoToast
          action={lastAction}
          onUndo={async () => {
            await undo();
            setDismissedAction(lastAction.id);
          }}
          onDismiss={() => setDismissedAction(lastAction.id)}
        />
      )}
    </div>
  );
}

// Memoize GridView to prevent unnecessary re-renders
const GridView = React.memo(GridViewComponent);
export default GridView;

