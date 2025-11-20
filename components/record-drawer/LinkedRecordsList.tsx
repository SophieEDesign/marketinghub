"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Field } from "@/lib/fields";
import { useRecordDrawer } from "./RecordDrawerProvider";
import { Link, ExternalLink } from "lucide-react";
import { getTable } from "@/lib/tables";
import { tableMetadata } from "@/lib/tableMetadata";

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

          if (data && typeof data === 'object' && 'id' in data) {
            const record = data as Record<string, any>;
            const displayValue =
              record[displayField] || record.name || record.title || record.id;
            linked.push({
              id: String(record.id),
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

             // Find back-links (records that link to this record) using metadata
             const tableMeta = tableMetadata[table];
             if (tableMeta?.linkedFrom) {
               try {
                 for (const relation of tableMeta.linkedFrom) {
                   const { data: linkedRecords } = await supabase
                     .from(relation.table)
                     .select("id, title, name")
                     .eq(relation.field, recordId);

                   if (linkedRecords) {
                     linkedRecords.forEach((record: any) => {
                       const displayValue = record.title || record.name || `${relation.table} #${record.id}`;
                       linked.push({
                         id: record.id,
                         table: relation.table,
                         displayValue,
                         fieldKey: relation.field,
                         fieldLabel: `Linked ${tableMetadata[relation.table]?.label || relation.table}`,
                       });
                     });
                   }
                 }
               } catch (err) {
                 console.error("Error loading back-links:", err);
               }
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

