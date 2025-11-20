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
import ViewHeader from "./ViewHeader";
import { Filter, Sort } from "@/lib/types/filters";
import { runAutomations } from "@/lib/automations/automationEngine";
import { toast } from "../ui/Toast";

interface GridViewProps {
  tableId: string;
}

export default function GridView({ tableId }: GridViewProps) {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const viewId = pathParts[1] || "grid";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    fieldId: string;
  } | null>(null);
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);
  
  // Apply visible_fields and field_order
  let fields = allFields;
  if (visibleFields.length > 0) {
    fields = fields.filter((f) => visibleFields.includes(f.id));
  }
  if (fieldOrder.length > 0) {
    fields = [...fields].sort((a, b) => {
      const aIndex = fieldOrder.indexOf(a.id);
      const bIndex = fieldOrder.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }
  const { setOpen, setRecordId, setTableId } = useDrawer();
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
  
  const handleViewSettingsUpdate = async (updates: {
    visible_fields?: string[];
    field_order?: string[];
    row_height?: "compact" | "medium" | "tall";
  }): Promise<boolean> => {
    try {
      if (updates.visible_fields !== undefined) await setVisibleFields(updates.visible_fields);
      if (updates.field_order !== undefined) await setFieldOrder(updates.field_order);
      if (updates.row_height !== undefined) await setRowHeight(updates.row_height);
      return true;
    } catch (error) {
      console.error("Error updating view settings:", error);
      return false;
    }
  };

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
  };

  const handleSortChange = async (newSort: Sort[]) => {
    await saveSort(newSort);
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
      />

      {/* Table */}
      <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
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
              className={`hover:bg-gray-100 dark:hover:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${
                rowHeight === "compact" ? "h-8" : rowHeight === "tall" ? "h-20" : "h-12"
              }`}
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

