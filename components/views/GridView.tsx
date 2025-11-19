"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useDrawer } from "@/lib/drawerState";
import { useFields } from "@/lib/useFields";
import FieldRenderer from "../fields/FieldRenderer";
import InlineFieldEditor from "../fields/InlineFieldEditor";

interface GridViewProps {
  tableId: string;
}

export default function GridView({ tableId }: GridViewProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    fieldId: string;
  } | null>(null);
  const { fields, loading: fieldsLoading } = useFields(tableId);
  const { setOpen, setRecordId, setTableId } = useDrawer();

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Load records
      const { data, error } = await supabase
        .from(tableId)
        .select("*")
        .order("created_at", { ascending: false });
      
      if (!error && data) {
        setRows(data);
      }
      setLoading(false);
    }
    load();
  }, [tableId]);

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
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-300 dark:border-gray-700">
            {fields.map((field) => (
              <th key={field.id} className="p-2 font-medium">
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
  );
}

