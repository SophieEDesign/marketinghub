"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TableField } from "@/types/fields"

interface SortableFieldItemProps {
  field: TableField
  children: React.ReactNode
  isVisible: boolean
  layoutMode: boolean
  onFieldVisibilityToggle?: (fieldName: string, visible: boolean) => void
}

/**
 * SortableFieldItem - Always renders with hooks, but disables sortable when layoutMode is false.
 * 
 * CRITICAL: This component MUST always call useSortable() to maintain stable hook order.
 * We disable the sortable behavior via the `disabled` prop, not by conditionally calling the hook.
 */
export default function SortableFieldItem({
  field,
  children,
  isVisible,
  layoutMode,
  onFieldVisibilityToggle,
}: SortableFieldItemProps) {
  // CRITICAL: Always call useSortable, even when layoutMode is false
  // This ensures stable hook order across renders
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: field.id,
    disabled: !layoutMode, // Disable sortable behavior, but still call the hook
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        !isVisible && "opacity-50"
      )}
    >
      {layoutMode && (
        <div className="absolute left-0 top-0 bottom-0 flex items-center z-10 -ml-0.5">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded p-2 transition-colors touch-none"
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </div>
          {onFieldVisibilityToggle && (
            <button
              type="button"
              onClick={() => onFieldVisibilityToggle(field.name, !isVisible)}
              className="p-1 text-gray-400 hover:text-gray-600"
              title={isVisible ? "Hide field" : "Show field"}
            >
              {isVisible ? (
                <Eye className="h-4 w-4" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      )}
      <div className={cn(layoutMode && "ml-10")}>
        {children}
      </div>
    </div>
  )
}
