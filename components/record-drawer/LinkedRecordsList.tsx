"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Field } from "@/lib/fields";
import { useRecordDrawer } from "./RecordDrawerProvider";
import { Link, ExternalLink } from "lucide-react";
import { getTable } from "@/lib/tables";

interface LinkedRecordsListProps {
  table: string;
  recordId: string;
  fields: Field[];
  record: any;
}

interface LinkedRecord {
  id: string;
  table: string;
  displayValue: string;
  fieldKey: string;
  fieldLabel: string;
}

export default function LinkedRecordsList({
  table,
  recordId,
  fields,
  record,
}: LinkedRecordsListProps) {
  const { openRecord } = useRecordDrawer();
  const [linkedRecords, setLinkedRecords] = useState<LinkedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLinkedRecords() {
      setLoading(true);
      const linked: LinkedRecord[] = [];

      // Find all linked_record fields
      const linkedFields = fields.filter((f) => f.type === "linked_record");

      for (const field of linkedFields) {
        const linkedId = record[field.field_key];
        if (!linkedId) continue;

        const foreignTable = field.options?.foreignTable || field.options?.to_table;
        const displayField = field.options?.displayField || field.options?.display_field || "name";

        if (!foreignTable) continue;

        try {
          const { data } = await supabase
            .from(foreignTable)
            .select(`id, ${displayField}`)
            .eq("id", linkedId)
            .maybeSingle();

          if (data) {
            const displayValue =
              data[displayField] || data.name || data.title || data.id;
            linked.push({
              id: data.id,
              table: foreignTable,
              displayValue: String(displayValue),
              fieldKey: field.field_key,
              fieldLabel: field.label,
            });
          }
        } catch (err) {
          console.error(`Error loading linked record from ${foreignTable}:`, err);
        }
      }

      // Find back-links (records that link to this record)
      // For content: find media.content_id, tasks.content_id
      // For campaigns: find content.campaign_id
      // For contacts: find tasks.assigned_to
      try {
        if (table === "content") {
          // Find media linked to this content
          const { data: media } = await supabase
            .from("media")
            .select("id, publication")
            .eq("content_id", recordId);
          if (media) {
            media.forEach((m) => {
              linked.push({
                id: m.id,
                table: "media",
                displayValue: m.publication || "Media",
                fieldKey: "content_id",
                fieldLabel: "Linked Media",
              });
            });
          }

          // Find tasks linked to this content
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, title")
            .eq("content_id", recordId);
          if (tasks) {
            tasks.forEach((t) => {
              linked.push({
                id: t.id,
                table: "tasks",
                displayValue: t.title || "Task",
                fieldKey: "content_id",
                fieldLabel: "Linked Tasks",
              });
            });
          }
        } else if (table === "campaigns") {
          // Find content linked to this campaign
          const { data: content } = await supabase
            .from("content")
            .select("id, title")
            .eq("campaign_id", recordId);
          if (content) {
            content.forEach((c) => {
              linked.push({
                id: c.id,
                table: "content",
                displayValue: c.title || "Content",
                fieldKey: "campaign_id",
                fieldLabel: "Linked Content",
              });
            });
          }
        } else if (table === "contacts") {
          // Find tasks assigned to this contact
          const { data: tasks } = await supabase
            .from("tasks")
            .select("id, title")
            .eq("assigned_to", recordId);
          if (tasks) {
            tasks.forEach((t) => {
              linked.push({
                id: t.id,
                table: "tasks",
                displayValue: t.title || "Task",
                fieldKey: "assigned_to",
                fieldLabel: "Assigned Tasks",
              });
            });
          }
        }
      } catch (err) {
        console.error("Error loading back-links:", err);
      }

      setLinkedRecords(linked);
      setLoading(false);
    }

    if (recordId) {
      loadLinkedRecords();
    }
  }, [table, recordId, fields, record]);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading linked records...</div>
    );
  }

  if (linkedRecords.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No linked records
      </div>
    );
  }

  // Group by table
  const grouped = linkedRecords.reduce((acc, item) => {
    if (!acc[item.table]) {
      acc[item.table] = [];
    }
    acc[item.table].push(item);
    return acc;
  }, {} as Record<string, LinkedRecord[]>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([tableName, records]) => {
        const tableConfig = getTable(tableName);
        return (
          <div key={tableName}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              {tableConfig?.name || tableName} ({records.length})
            </h4>
            <div className="space-y-2">
              {records.map((linked) => (
                <button
                  key={linked.id}
                  onClick={() => openRecord(linked.table, linked.id)}
                  className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left group"
                >
                  <Link className="w-4 h-4 text-gray-400 group-hover:text-brand-blue flex-shrink-0" />
                  <span className="flex-1 text-sm truncate">{linked.displayValue}</span>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-brand-blue flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

