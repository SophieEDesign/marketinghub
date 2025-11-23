"use client";

import { useDroppable } from "@dnd-kit/core";
import { Field } from "@/lib/fields";
import KanbanCard from "./KanbanCard";

interface KanbanLaneProps {
  groupTitle: string;
  statuses: string[];
  items: any[];
  fields: Field[];
}

export default function KanbanLane({ groupTitle, statuses, items, fields }: KanbanLaneProps) {
  // Use the first status as the droppable id to match with lane.id
  const droppableId = statuses[0] || groupTitle;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col bg-gray-100 dark:bg-gray-800 rounded-lg p-3 w-80 min-w-[20rem] gap-3 ${
        isOver ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <h2 className="text-sm font-semibold mb-2">{groupTitle}</h2>
      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-12rem)]">
        {items.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-4">
            No items
          </div>
        ) : (
          items.map((item) => <KanbanCard key={item.id} row={item} fields={fields} />)
        )}
      </div>
    </div>
  );
}

