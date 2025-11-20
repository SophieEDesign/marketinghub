"use client";

import { useState, useEffect } from "react";
import { X, GripVertical, Settings } from "lucide-react";
import { Field } from "@/lib/fields";
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

interface ViewSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  tableId: string;
  viewId: string;
  fields: Field[];
  settings: {
    visible_fields?: string[];
    field_order?: string[];
    kanban_group_field?: string;
    calendar_date_field?: string;
    timeline_date_field?: string;
    row_height?: "compact" | "medium" | "tall";
    card_fields?: string[];
  };
  onUpdate: (updates: {
    visible_fields?: string[];
    field_order?: string[];
    kanban_group_field?: string;
    calendar_date_field?: string;
    timeline_date_field?: string;
    row_height?: "compact" | "medium" | "tall";
    card_fields?: string[];
  }) => Promise<boolean>;
}

function SortableFieldItem({
  field,
  isVisible,
  onToggle,
}: {
  field: Field;
  isVisible: boolean;
  onToggle: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: toTransformString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-manipulation"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <input
        type="checkbox"
        checked={isVisible}
        onChange={onToggle}
        className="rounded w-4 h-4 touch-manipulation"
      />
      <span className="flex-1 text-sm font-medium">{field.label}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700">
        {field.type}
      </span>
    </div>
  );
}

function SortableCardFieldItem({ field }: { field: Field }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: toTransformString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      <span className="flex-1 text-sm font-medium">{field.label}</span>
    </div>
  );
}

export default function ViewSettingsDrawer({
  open,
  onClose,
  tableId,
  viewId,
  fields,
  settings,
  onUpdate,
}: ViewSettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"fields" | "options">("fields");
  const [localVisibleFields, setLocalVisibleFields] = useState<string[]>([]);
  const [localFieldOrder, setLocalFieldOrder] = useState<string[]>([]);
  const [localKanbanGroupField, setLocalKanbanGroupField] = useState<string>("");
  const [localCalendarDateField, setLocalCalendarDateField] = useState<string>("");
  const [localTimelineDateField, setLocalTimelineDateField] = useState<string>("");
  const [localRowHeight, setLocalRowHeight] = useState<"compact" | "medium" | "tall">("medium");
  const [localCardFields, setLocalCardFields] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize local state from settings
  useEffect(() => {
    if (open && settings) {
      setLocalVisibleFields(settings.visible_fields || fields.map((f) => f.id));
      setLocalFieldOrder(settings.field_order || fields.map((f) => f.id));
      setLocalKanbanGroupField(settings.kanban_group_field || "");
      setLocalCalendarDateField(settings.calendar_date_field || "");
      setLocalTimelineDateField(settings.timeline_date_field || "");
      setLocalRowHeight(settings.row_height || "medium");
      setLocalCardFields(settings.card_fields || fields.map((f) => f.id));
    }
  }, [open, settings, fields]);

  if (!open) return null;

  // Get ordered fields based on field_order
  const orderedFields = [...fields].sort((a, b) => {
    const aIndex = localFieldOrder.indexOf(a.id);
    const bIndex = localFieldOrder.indexOf(b.id);
    if (aIndex === -1 && bIndex === -1) return 0;
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  const handleFieldDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localFieldOrder.indexOf(active.id as string);
    const newIndex = localFieldOrder.indexOf(over.id as string);

    const newOrder = arrayMove(localFieldOrder, oldIndex, newIndex);
    setLocalFieldOrder(newOrder);
    onUpdate({ field_order: newOrder });
  };

  const handleToggleVisibility = (fieldId: string) => {
    const newVisible = localVisibleFields.includes(fieldId)
      ? localVisibleFields.filter((id) => id !== fieldId)
      : [...localVisibleFields, fieldId];
    setLocalVisibleFields(newVisible);
    onUpdate({ visible_fields: newVisible });
  };

  const handleCardFieldsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localCardFields.indexOf(active.id as string);
    const newIndex = localCardFields.indexOf(over.id as string);

    const newOrder = arrayMove(localCardFields, oldIndex, newIndex);
    setLocalCardFields(newOrder);
    onUpdate({ card_fields: newOrder });
  };

  // Get date fields for calendar/timeline
  const dateFields = fields.filter((f) => f.type === "date");
  const singleSelectFields = fields.filter((f) => f.type === "single_select");

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-950 shadow-xl h-full overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-brand-blue" />
              <h2 className="text-lg font-heading text-brand-blue">View Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 -mr-2 touch-manipulation"
              aria-label="Close settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab("fields")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "fields"
                  ? "border-brand-red text-brand-red"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              Fields
            </button>
            <button
              onClick={() => setActiveTab("options")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === "options"
                  ? "border-brand-red text-brand-red"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              View Options
            </button>
          </div>

          {/* Fields Tab */}
          {activeTab === "fields" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Show / Hide Fields
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Drag to reorder, check to show/hide
                </p>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleFieldDragEnd}
                >
                  <SortableContext
                    items={localFieldOrder}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {orderedFields.map((field) => (
                        <SortableFieldItem
                          key={field.id}
                          field={field}
                          isVisible={localVisibleFields.includes(field.id)}
                          onToggle={() => handleToggleVisibility(field.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          )}

          {/* View Options Tab */}
          {activeTab === "options" && (
            <div className="space-y-6">
              {/* Grid View Options */}
              {viewId === "grid" && (
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Row Height
                  </h3>
                  <select
                    value={localRowHeight}
                    onChange={(e) => {
                      const height = e.target.value as "compact" | "medium" | "tall";
                      setLocalRowHeight(height);
                      onUpdate({ row_height: height });
                    }}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="compact">Compact</option>
                    <option value="medium">Medium</option>
                    <option value="tall">Tall</option>
                  </select>
                </div>
              )}

              {/* Kanban View Options */}
              {viewId === "kanban" && (
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Group By
                  </h3>
                  <select
                    value={localKanbanGroupField}
                    onChange={(e) => {
                      setLocalKanbanGroupField(e.target.value);
                      onUpdate({ kanban_group_field: e.target.value || undefined });
                    }}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">Select field...</option>
                    {singleSelectFields.map((field) => (
                      <option key={field.id} value={field.field_key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Calendar View Options */}
              {viewId === "calendar" && (
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Date Field
                  </h3>
                  <select
                    value={localCalendarDateField}
                    onChange={(e) => {
                      setLocalCalendarDateField(e.target.value);
                      onUpdate({ calendar_date_field: e.target.value || undefined });
                    }}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">Select field...</option>
                    {dateFields.map((field) => (
                      <option key={field.id} value={field.field_key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Timeline View Options */}
              {viewId === "timeline" && (
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Date Field
                  </h3>
                  <select
                    value={localTimelineDateField}
                    onChange={(e) => {
                      setLocalTimelineDateField(e.target.value);
                      onUpdate({ timeline_date_field: e.target.value || undefined });
                    }}
                    className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                  >
                    <option value="">Select field...</option>
                    {dateFields.map((field) => (
                      <option key={field.id} value={field.field_key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Cards View Options */}
              {viewId === "cards" && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Card Fields
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Drag to reorder fields on cards
                  </p>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleCardFieldsDragEnd}
                  >
                    <SortableContext
                      items={localCardFields}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {localCardFields
                          .map((fieldId) => fields.find((f) => f.id === fieldId))
                          .filter((f): f is Field => f !== undefined)
                          .map((field) => (
                            <SortableCardFieldItem key={field.id} field={field} />
                          ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

