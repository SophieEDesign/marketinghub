"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useDrawer } from "@/lib/drawerState";
import { useFields } from "@/lib/useFields";
import FieldRenderer from "../fields/FieldRenderer";

interface GridViewProps {
  tableId: string;
}

export default function GridView({ tableId }: GridViewProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
              className="hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-200 dark:border-gray-700"
              onClick={() => {
                setTableId(tableId);
                setRecordId(row.id);
                setOpen(true);
              }}
            >
            {fields.map((field) => (
              <td 
                key={field.id} 
                className={`p-2 ${field.type === "number" ? "text-right" : ""}`}
              >
                <FieldRenderer field={field} value={row[field.field_key]} record={row} />
              </td>
            ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

