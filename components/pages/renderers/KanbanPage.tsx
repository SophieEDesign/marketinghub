"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { KanbanPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSortable as useSortableHook } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";

interface KanbanPageProps {
  page: InterfacePage;
  config: KanbanPageConfig | null;
  isEditing?: boolean;
}

interface KanbanColumn {
  id: string;
  title: string;
  items: any[];
}

export default function KanbanPage({ page, config, isEditing }: KanbanPageProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [loading, setLoading] = useState(false);
  const { fields: allFields } = useFields(config?.table || "");

  const groupField = allFields.find((f) => f.field_key === config?.groupField);

  // Load records and group them
  useEffect(() => {
    if (!config?.table || !config.groupField) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        let query: any = supabase.from(config.table).select("*");

        // Apply filters
        if (config.filters && config.filters.length > 0) {
          for (const filter of config.filters) {
            if (filter.operator === "equals") {
              query = query.eq(filter.field, filter.value);
            }
            // Add more filter operators as needed
          }
        }

        const { data, error } = await query;

        if (error) throw error;

        // Group records by groupField
        const grouped: Record<string, any[]> = {};
        (data || []).forEach((record: any) => {
          const groupValue = record[config.groupField] || "Uncategorized";
          if (!grouped[groupValue]) {
            grouped[groupValue] = [];
          }
          grouped[groupValue].push(record);
        });

        // Convert to columns
        const newColumns: KanbanColumn[] = Object.entries(grouped).map(([value, items]) => ({
          id: value,
          title: String(value),
          items,
        }));

        setRecords(data || []);
        setColumns(newColumns);
      } catch (error: any) {
        console.error("Error loading records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [config]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || !config?.table) return;

    const recordId = active.id as string;
    const newGroupValue = over.id as string;

    // Update record in database
    try {
      const { error } = await supabase
        .from(config.table)
        .update({ [config.groupField]: newGroupValue })
        .eq("id", recordId);

      if (error) throw error;

      // Update local state
      setRecords((prev) =>
        prev.map((r) => (r.id === recordId ? { ...r, [config.groupField]: newGroupValue } : r))
      );

      // Rebuild columns
      const grouped: Record<string, any[]> = {};
      records.forEach((record: any) => {
        const groupValue = record.id === recordId ? newGroupValue : record[config.groupField] || "Uncategorized";
        if (!grouped[groupValue]) {
          grouped[groupValue] = [];
        }
        grouped[groupValue].push(record.id === recordId ? { ...record, [config.groupField]: newGroupValue } : record);
      });

      const newColumns: KanbanColumn[] = Object.entries(grouped).map(([value, items]) => ({
        id: value,
        title: String(value),
        items,
      }));

      setColumns(newColumns);
    } catch (error: any) {
      console.error("Error updating record:", error);
    }
  };

  if (!config?.table || !config.groupField) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table and group field in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading kanban board...
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <KanbanColumnComponent
            key={column.id}
            column={column}
            cardFields={config.cardFields || []}
            allFields={allFields}
          />
        ))}
      </div>
    </DndContext>
  );
}

function KanbanColumnComponent({
  column,
  cardFields,
  allFields,
}: {
  column: KanbanColumn;
  cardFields: string[];
  allFields: any[];
}) {
  const visibleFields = cardFields.length > 0
    ? allFields.filter((f) => cardFields.includes(f.field_key))
    : allFields.slice(0, 3);

  return (
    <div className="flex-shrink-0 w-64 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        {column.title} ({column.items.length})
      </h3>
      <SortableContext items={column.items.map((item: any) => item.id)}>
        <div className="space-y-2">
          {column.items.map((item: any) => (
            <KanbanCard key={item.id} item={item} fields={visibleFields} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

function KanbanCard({ item, fields }: { item: any; fields: any[] }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-gray-900 rounded-lg p-3 shadow-sm border border-gray-200 dark:border-gray-700 cursor-move"
    >
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="cursor-grab">
          <GripVertical className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex-1 space-y-1">
          {fields.map((field) => (
            <div key={field.field_key} className="text-sm">
              <span className="text-gray-500 dark:text-gray-400 text-xs">{field.label}:</span>{" "}
              <span className="text-gray-900 dark:text-white">
                {item[field.field_key] ? String(item[field.field_key]).slice(0, 50) : "-"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
