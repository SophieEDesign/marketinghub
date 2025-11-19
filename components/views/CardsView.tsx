"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { Field } from "@/lib/fields";
import { useDrawer } from "@/lib/drawerState";
import FieldRenderer from "../fields/FieldRenderer";

interface CardsViewProps {
  tableId: string;
}

export default function CardsView({ tableId }: CardsViewProps) {
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
        .order("updated_at", { ascending: false });
      
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

  // Find thumbnail/image field (field.type = attachment)
  const imageField = fields.find((f) => f.type === "attachment");

  // Find title field (label = "Title")
  const titleField = fields.find((f) => f.label.toLowerCase() === "title") || fields[0];

  // Find status field
  const statusField = fields.find(
    (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
  );

  // Find channels field
  const channelsField = fields.find(
    (f) => f.type === "multi_select" && f.label.toLowerCase().includes("channel")
  );

  // Find publish_date field
  const publishDateField = fields.find(
    (f) => f.label.toLowerCase() === "publish date" && f.type === "date"
  ) || fields.find((f) => f.field_key === "publish_date" && f.type === "date");

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
    >
      {rows.map((row) => {
        const imageValue = imageField ? row[imageField.field_key] : null;
        const titleValue = titleField ? row[titleField.field_key] : "Untitled";

        return (
          <div
            key={row.id}
            className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md overflow-hidden cursor-pointer transition border border-gray-200 dark:border-gray-800"
            onClick={() => {
              setTableId(tableId);
              setRecordId(row.id);
              setOpen(true);
            }}
          >
            {/* Thumbnail */}
            {imageValue ? (
              <img
                src={Array.isArray(imageValue) ? imageValue[0] : imageValue}
                alt={String(titleValue)}
                className="h-40 w-full object-cover"
              />
            ) : (
              <div className="h-40 w-full bg-gray-300 dark:bg-gray-700" />
            )}

            {/* Body */}
            <div className="p-4 flex flex-col gap-2">
              <h3 className="font-semibold text-sm line-clamp-2">{String(titleValue)}</h3>

              {/* Status field chip */}
              {statusField && (
                <div>
                  <FieldRenderer
                    field={statusField}
                    value={row[statusField.field_key]}
                    record={row}
                  />
                </div>
              )}

              {/* Channels multi-chip */}
              {channelsField && row[channelsField.field_key] && Array.isArray(row[channelsField.field_key]) && row[channelsField.field_key].length > 0 && (
                <div className="flex flex-wrap gap-1">
                  <FieldRenderer
                    field={channelsField}
                    value={row[channelsField.field_key]}
                    record={row}
                  />
                </div>
              )}

              {/* Publish date */}
              {publishDateField && row[publishDateField.field_key] && (
                <div className="text-xs opacity-70 text-gray-600 dark:text-gray-400">
                  {publishDateField.label}: {new Date(row[publishDateField.field_key]).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

