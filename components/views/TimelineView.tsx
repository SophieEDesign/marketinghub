"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import dayjs from "dayjs";
import { useFields } from "@/lib/useFields";
import { Field } from "@/lib/fields";
import FieldRenderer from "../fields/FieldRenderer";

interface TimelineViewProps {
  tableId: string;
}

export default function TimelineView({ tableId }: TimelineViewProps) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);

  // Identify timeline start: use created_at field (label = "Created At")
  const startField = allFields.find(
    (f) => f.label.toLowerCase() === "created at" && f.type === "date"
  ) || allFields.find((f) => f.field_key === "created_at" && f.type === "date") || null;

  // Identify timeline end: use Publish Date field
  const endField = allFields.find(
    (f) => f.label.toLowerCase() === "publish date" && f.type === "date"
  ) || allFields.find((f) => f.field_key === "publish_date" && f.type === "date") || null;

  // Find title field
  const titleField = allFields.find((f) => f.label.toLowerCase() === "title") || allFields[0];

  // Find status field for color
  const statusField = allFields.find(
    (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Load records
      const { data, error } = await supabase
        .from(tableId)
        .select("*")
        .order(startField?.field_key || "created_at");

      if (!error && data) {
        setRows(data);
      }
      setLoading(false);
    }
    load();
  }, [tableId, startField]);

  // Timeline window (60 days forward/backwards)
  const startWindow = dayjs().subtract(30, "day");
  const endWindow = dayjs().add(60, "day");
  const totalDays = endWindow.diff(startWindow, "day");

  if (loading || fieldsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!startField) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">
          No date field found. Please configure a date field for Timeline view.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-x-auto">
      <div className="min-w-[1500px]">
        {/* Timeline header (day scale) */}
        <div className="flex border-b border-gray-300 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="w-48"></div>
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = startWindow.add(i, "day");
            const isToday = d.isSame(dayjs(), "day");
            return (
              <div
                key={i}
                className={`w-12 text-[10px] text-center opacity-70 border-l border-gray-200 dark:border-gray-700 ${
                  isToday ? "bg-blue-100 dark:bg-blue-900" : ""
                }`}
              >
                {d.format("DD MMM")}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">No records found</div>
          </div>
        ) : (
          rows.map((row) => {
            const start = row[startField.field_key] ? dayjs(row[startField.field_key]) : dayjs();
            const endFieldKey = endField?.field_key || startField.field_key;
            const end = row[endFieldKey]
              ? dayjs(row[endFieldKey])
              : dayjs().add(1, "day");

            // Convert to offset
            const offsetDays = Math.max(0, start.diff(startWindow, "day"));
            const durationDays = Math.max(1, end.diff(start, "day"));

            // Get status color from field options or default
            let statusColor = "#9ca3af";
            if (statusField && row[statusField.field_key]) {
              const option = statusField.options?.values?.find(
                (opt: any) => opt.id === row[statusField.field_key] || opt.label === row[statusField.field_key]
              );
              statusColor = option?.color || statusColor;
            }

            return (
              <div
                key={row.id}
                className="flex items-center border-b border-gray-200 dark:border-gray-800 h-12 relative hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {/* Title */}
                <div className="w-48 px-2 text-sm font-medium truncate flex-shrink-0">
                  {titleField ? row[titleField.field_key] || "Untitled" : "Untitled"}
                </div>

                {/* Bar container */}
                <div className="flex-1 relative h-full">
                  {/* Offset spacer */}
                  {offsetDays >= 0 && durationDays > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6"
                      style={{ left: `${offsetDays * 48}px` }}
                    >
                      {/* Bar */}
                      <div
                        className="rounded-sm h-6 opacity-90 hover:opacity-100 transition cursor-pointer flex items-center justify-center text-white text-[10px] font-medium px-1"
                        style={{
                          width: `${Math.max(durationDays * 48, 48)}px`,
                          backgroundColor: statusColor,
                          minWidth: "48px",
                        }}
                        title={`${titleField ? row[titleField.field_key] || "Untitled" : "Untitled"}\n${statusField ? `${statusField.label}: ${row[statusField.field_key] || "N/A"}\n` : ""}Start: ${start.format("DD MMM YYYY")}\nEnd: ${end.format("DD MMM YYYY")}`}
                      >
                        {durationDays * 48 > 60 && (
                          <span className="truncate">
                            {titleField ? row[titleField.field_key] || "Untitled" : "Untitled"}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

