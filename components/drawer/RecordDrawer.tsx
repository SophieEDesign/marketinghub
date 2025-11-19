"use client";

import { useDrawer } from "@/lib/drawerState";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useFields } from "@/lib/useFields";
import FieldInput from "../fields/FieldInput";

export default function RecordDrawer() {
  const { open, setOpen, recordId, tableId } = useDrawer();
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId || "");

  // Filter visible fields, exclude id
  const fields = allFields.filter((f) => f.visible !== false && f.field_key !== "id");

  useEffect(() => {
    if (!recordId || !tableId) {
      setRow(null);
      return;
    }

    async function load() {
      setLoading(true);
      
      // Load record
      const { data } = await supabase
        .from(tableId as string)
        .select("*")
        .eq("id", recordId)
        .maybeSingle();
      
      setRow(data);
      setLoading(false);
    }
    load();
  }, [recordId, tableId]);

  if (!open) return null;

  const handleSave = async () => {
    if (!row || !tableId) return;
    
    setLoading(true);
    
    // Prepare update data
    const updateData: Record<string, any> = {};
    fields.forEach((field) => {
      const value = row[field.field_key];
      updateData[field.field_key] = value;
    });

    const { error } = await supabase
      .from(tableId as string)
      .update(updateData)
      .eq("id", row.id);

    if (!error) {
      setOpen(false);
      window.location.reload();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div className="relative w-[420px] bg-white dark:bg-gray-950 shadow-xl h-full p-6 overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        {(loading || fieldsLoading) && !row ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        ) : row ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-heading text-brand-blue">
                Edit Record
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Editable fields */}
            <div className="flex flex-col gap-4">
              {fields.map((field) => (
                <div key={field.id}>
                  <label className="text-sm opacity-70 block mb-1">
                    {field.label} {field.required && "*"}
                  </label>
                  <FieldInput
                    field={field}
                    value={row[field.field_key]}
                    onChange={(value) =>
                      setRow({ ...row, [field.field_key]: value })
                    }
                    table={tableId || undefined}
                    recordId={recordId || null}
                  />
                </div>
              ))}

              {/* Save */}
              <button
                className="btn-primary mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">Record not found</div>
          </div>
        )}
      </div>
    </div>
  );
}
