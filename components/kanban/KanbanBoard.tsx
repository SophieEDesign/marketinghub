"use client";

import { useState, useEffect } from "react";
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
import KanbanLane from "./KanbanLane";
import KanbanCard from "./KanbanCard";

const STATUS_GROUPS = [
  {
    title: "Planning / Ideation",
    statuses: ["Ideas", "Dates for Engagement", "Date Confirmed", "On Hold", "Duplicate", "Cancelled"],
  },
  {
    title: "Intake",
    statuses: ["To Do", "Awaiting Information"],
  },
  {
    title: "Production",
    statuses: ["In Progress", "Needs Update", "Drafted – Needs Internal Review"],
  },
  {
    title: "Approvals",
    statuses: ["Sent for Approval – Internal (P&M)", "Tech Check Required", "Text Approved – Image Needed", "Approved – Ready to Schedule"],
  },
  {
    title: "Scheduling",
    statuses: ["Scheduled"],
  },
  {
    title: "Completion",
    statuses: ["Completed (Published)", "Event Passed / Out of Date", "Monthly (Recurring)"],
  },
];

export default function KanbanBoard() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  async function loadData() {
    const { data, error } = await supabase
      .from("content")
      .select("*, campaigns(name)");
    
    if (!error && data) {
      setRows(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleDragStart(event: any) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const draggedId = active.id as string;
    const item = rows.find((r) => r.id === draggedId);
    if (!item) return;

    const sourceGroup = STATUS_GROUPS.find((group) =>
      group.statuses.includes(item.status)
    );

    const destinationGroup = STATUS_GROUPS.find(
      (group) => group.title === over.id
    );

    if (!destinationGroup) return;
    if (sourceGroup?.title === destinationGroup.title) return;

    const newStatus = destinationGroup.statuses[0];

    async function updateStatus() {
      const { error } = await supabase
        .from("content")
        .update({ status: newStatus })
        .eq("id", draggedId);

      if (!error) {
        await loadData();
      }
    }

    updateStatus();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const activeItem = activeId ? rows.find((r) => r.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_GROUPS.map((group) => {
          const groupItems = rows.filter((r) => group.statuses.includes(r.status));
          return (
            <KanbanLane
              key={group.title}
              groupTitle={group.title}
              statuses={group.statuses}
              items={groupItems}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rotate-3 opacity-90">
            <KanbanCard row={activeItem} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

