"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { useViewSettings } from "@/lib/useViewSettings";
import { applyFiltersAndSort } from "@/lib/query/applyFiltersAndSort";
import { Field } from "@/lib/fields";
import { Filter, Sort } from "@/lib/types/filters";
import KanbanLane from "../kanban/KanbanLane";
import KanbanCard from "../kanban/KanbanCard";
import ViewHeader from "./ViewHeader";

interface KanbanViewProps {
  tableId: string;
}

export default function KanbanView({ tableId }: KanbanViewProps) {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const viewId = pathParts[1] || "kanban";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);
  const {
    settings,
    getViewSettings,
    saveFilters,
    saveSort,
    setKanbanGroupField,
  } = useViewSettings(tableId, viewId);

  const filters = settings?.filters || [];
  const sort = settings?.sort || [];
  const kanbanGroupFieldKey = settings?.kanban_group_field;
  
  const handleViewSettingsUpdate = async (updates: {
    kanban_group_field?: string;
  }): Promise<boolean> => {
    try {
      if (updates.kanban_group_field !== undefined) await setKanbanGroupField(updates.kanban_group_field);
      return true;
    } catch (error) {
      console.error("Error updating view settings:", error);
      return false;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Find kanban field: use kanban_group_field from settings, or fallback to status field
  const kanbanField = kanbanGroupFieldKey
    ? allFields.find((f) => f.field_key === kanbanGroupFieldKey && f.type === "single_select")
    : allFields.find(
        (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
      ) || allFields.find((f) => f.type === "single_select") || null;

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

  function handleDragStart(event: any) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !kanbanField) return;

    const draggedId = active.id as string;
    const item = rows.find((r) => r.id === draggedId);
    if (!item) return;

    const newValue = over.id as string;
    const fieldKey = kanbanField.field_key; // Store in variable to help TypeScript

    async function updateRecord() {
      const { error } = await supabase
        .from(tableId as string)
        .update({ [fieldKey]: newValue })
        .eq("id", draggedId);

      if (!error) {
        // Reload data
        const { data } = await supabase.from(tableId as string).select("*");
        if (data) setRows(data);
      }
    }

    updateRecord();
  }

  if (loading || fieldsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!kanbanField || kanbanField.type !== "single_select") {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">
          No single-select field found for Kanban view. Please configure a status field.
        </div>
      </div>
    );
  }

  // Get options from field.options.values
  const options = kanbanField.options?.values || [];
  const lanes = options.map((opt: any) => ({
    id: opt.id || opt.label,
    title: opt.label || opt.id,
  }));

  // Group items by kanban field value
  const groupedItems: Record<string, any[]> = {};
  lanes.forEach((lane: { id: string; title: string }) => {
    groupedItems[lane.id] = rows.filter((r) => r[kanbanField.field_key] === lane.id);
  });

  const activeItem = activeId ? rows.find((r) => r.id === activeId) : null;

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
          kanban_group_field: kanbanGroupFieldKey,
        }}
        onViewSettingsUpdate={handleViewSettingsUpdate}
      />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
        {lanes.map((lane: { id: string; title: string }) => (
          <KanbanLane
            key={lane.id}
            groupTitle={lane.title}
            statuses={[lane.id]}
            items={groupedItems[lane.id] || []}
            fields={allFields}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rotate-3 opacity-90">
            <KanbanCard row={activeItem} fields={allFields} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
    </div>
  );
}

