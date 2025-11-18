"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

const toTransformString = (transform: any) => {
  if (!transform) return "";
  const { x = 0, y = 0, scaleX = 1, scaleY = 1 } = transform;
  return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
};

interface ViewConfig {
  visible_fields: string[];
  field_order: string[];
}

interface ViewConfigSidebarProps {
  viewName: string;
  availableFields: string[];
  onClose: () => void;
}

function SortableFieldItem({ id, label, isVisible, onToggle }: { id: string; label: string; isVisible: boolean; onToggle: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: toTransformString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded bg-gray-50 dark:bg-gray-800"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        ⋮⋮
      </div>
      <input
        type="checkbox"
        checked={isVisible}
        onChange={onToggle}
        className="rounded"
      />
      <span className="flex-1 text-sm">{label}</span>
    </div>
  );
}

export default function ViewConfigSidebar({
  viewName,
  availableFields,
  onClose,
}: ViewConfigSidebarProps) {
  const { settings, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(new Set());
  const [fieldOrder, setFieldOrder] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const viewConfigs = settings.view_configs || {};
    const config: ViewConfig = viewConfigs[viewName] || {
      visible_fields: availableFields,
      field_order: availableFields,
    };

    setVisibleFields(new Set(config.visible_fields || availableFields));
    setFieldOrder(config.field_order || availableFields);
  }, [viewName, availableFields, settings.view_configs]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFieldOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleToggleField = (field: string) => {
    setVisibleFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(field)) {
        newSet.delete(field);
      } else {
        newSet.add(field);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const viewConfigs = settings.view_configs || {};
      const newConfig: ViewConfig = {
        visible_fields: Array.from(visibleFields),
        field_order: fieldOrder,
      };

      await updateSettings({
        view_configs: {
          ...viewConfigs,
          [viewName]: newConfig,
        },
      });

      alert("View configuration saved!");
      onClose();
    } catch (error) {
      console.error("Error saving view config:", error);
      alert("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const getFieldLabel = (field: string): string => {
    return field
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="relative w-80 bg-white dark:bg-gray-900 shadow-xl h-full p-6 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Configure {viewName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-medium mb-2">Field Visibility & Order</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Drag to reorder, check to show/hide
            </p>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={fieldOrder}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {fieldOrder.map((field) => (
                    <SortableFieldItem
                      key={field}
                      id={field}
                      label={getFieldLabel(field)}
                      isVisible={visibleFields.has(field)}
                      onToggle={() => handleToggleField(field)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          <div className="flex gap-2 mt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

