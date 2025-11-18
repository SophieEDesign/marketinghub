"use client";

import { useDraggable } from "@dnd-kit/core";
import { useDrawer } from "@/lib/drawerState";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";

interface KanbanCardProps {
  row: any;
}

export default function KanbanCard({ row }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.id,
  });
  const { setOpen, setRecordId } = useDrawer();

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Only open drawer if not dragging
    if (!isDragging) {
      e.stopPropagation();
      setRecordId(row.id);
      setOpen(true);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`p-3 bg-white dark:bg-gray-900 rounded-lg shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing flex flex-col gap-2 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {row.thumbnail_url ? (
        <img
          src={row.thumbnail_url}
          alt={row.title || "Content thumbnail"}
          className="w-full h-24 object-cover rounded-md"
        />
      ) : (
        <div className="w-full h-24 bg-gray-300 dark:bg-gray-700 rounded-md" />
      )}

      <h3 className="font-medium text-sm line-clamp-2">{row.title || "Untitled"}</h3>

      <div className="flex items-center gap-1">
        <StatusChip value={row.status} />
      </div>

      {row.channels && row.channels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {row.channels.slice(0, 3).map((ch: string) => (
            <ChannelChip key={ch} label={ch} />
          ))}
          {row.channels.length > 3 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              +{row.channels.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

