"use client";

import { useState, useEffect } from "react";
import { X, GripVertical, Settings, Plus, Trash2 } from "lucide-react";
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
  viewType?: "grid" | "kanban" | "calendar" | "timeline" | "cards";
  fields: Field[];
  settings: {
    visible_fields?: string[];
    field_order?: string[];
    kanban_group_field?: string;
    calendar_date_field?: string;
    calendar_date_to_field?: string;
    timeline_date_field?: string;
    row_height?: "compact" | "medium" | "tall";
    card_fields?: string[];
    column_widths?: Record<string, number>;
    groupings?: Array<{ name: string; fields: string[] }>;
  };
  onUpdate: (updates: {
    visible_fields?: string[];
    field_order?: string[];
    kanban_group_field?: string;
    calendar_date_field?: string;
    calendar_date_to_field?: string;
    timeline_date_field?: string;
    row_height?: "compact" | "medium" | "tall";
    card_fields?: string[];
    column_widths?: Record<string, number>;
    groupings?: Array<{ name: string; fields: string[] }>;
  }) => Promise<void>;
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
  viewType,
  fields,
  settings,
  onUpdate,
}: ViewSettingsDrawerProps) {
  const [activeTab, setActiveTab] = useState<"fields" | "options">("fields");
  const [localVisibleFields, setLocalVisibleFields] = useState<string[]>([]);
  const [localFieldOrder, setLocalFieldOrder] = useState<string[]>([]);
  const [localKanbanGroupField, setLocalKanbanGroupField] = useState<string>("");
  const [localCalendarDateField, setLocalCalendarDateField] = useState<string>("");
  const [localCalendarDateToField, setLocalCalendarDateToField] = useState<string>("");
  const [localTimelineDateField, setLocalTimelineDateField] = useState<string>("");
  const [localRowHeight, setLocalRowHeight] = useState<"compact" | "medium" | "tall">("medium");
  const [localCardFields, setLocalCardFields] = useState<string[]>([]);
  const [localColumnWidths, setLocalColumnWidths] = useState<Record<string, number>>({});
  const [localGroupings, setLocalGroupings] = useState<Array<{ name: string; fields: string[] }>>([]);
  const [editingColumnWidth, setEditingColumnWidth] = useState<string | null>(null);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<number | null>(null);

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
      setLocalCalendarDateToField(settings.calendar_date_to_field || "");
      setLocalTimelineDateField(settings.timeline_date_field || "");
      setLocalRowHeight(settings.row_height || "medium");
      setLocalCardFields(settings.card_fields || fields.map((f) => f.id));
      setLocalColumnWidths(settings.column_widths || {});
      setLocalGroupings(settings.groupings || []);
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
              {(viewType === "grid" || viewId === "grid" || viewId.includes("grid")) && (
                <>
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

                  <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Column Widths
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Click a field to edit its column width (in pixels)
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orderedFields.map((field) => (
                        <div
                          key={field.id}
                          className="flex items-center justify-between p-2 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                        >
                          <span className="text-sm font-medium">{field.label}</span>
                          {editingColumnWidth === field.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={localColumnWidths[field.id] || 150}
                                onChange={(e) => {
                                  const width = parseInt(e.target.value) || 150;
                                  const newWidths = { ...localColumnWidths, [field.id]: width };
                                  setLocalColumnWidths(newWidths);
                                  onUpdate({ column_widths: newWidths });
                                }}
                                onBlur={() => setEditingColumnWidth(null)}
                                className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                                autoFocus
                              />
                              <span className="text-xs text-gray-500">px</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEditingColumnWidth(field.id)}
                              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                            >
                              {localColumnWidths[field.id] ? `${localColumnWidths[field.id]}px` : "Auto"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Field Groups
                      </h3>
                      <button
                        onClick={() => {
                          setShowAddGroup(true);
                          setNewGroupName("");
                        }}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      >
                        <Plus className="w-3 h-3" />
                        Add Group
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Group fields together in the grid view
                    </p>

                    {/* Add Group Form */}
                    {showAddGroup && (
                      <div className="mb-4 p-3 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                        <input
                          type="text"
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          placeholder="Group name"
                          className="w-full px-3 py-2 mb-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newGroupName.trim()) {
                              const newGroup = { name: newGroupName.trim(), fields: [] };
                              const updated = [...localGroupings, newGroup];
                              setLocalGroupings(updated);
                              onUpdate({ groupings: updated });
                              setNewGroupName("");
                              setShowAddGroup(false);
                            } else if (e.key === "Escape") {
                              setShowAddGroup(false);
                              setNewGroupName("");
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (newGroupName.trim()) {
                                const newGroup = { name: newGroupName.trim(), fields: [] };
                                const updated = [...localGroupings, newGroup];
                                setLocalGroupings(updated);
                                onUpdate({ groupings: updated });
                                setNewGroupName("");
                                setShowAddGroup(false);
                              }
                            }}
                            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded"
                            disabled={!newGroupName.trim()}
                          >
                            Create
                          </button>
                          <button
                            onClick={() => {
                              setShowAddGroup(false);
                              setNewGroupName("");
                            }}
                            className="px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Groups List */}
                    {localGroupings.length === 0 && !showAddGroup ? (
                      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                        No groups yet. Click "Add Group" to create one.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {localGroupings.map((group, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                          >
                            <div className="flex items-center justify-between mb-2">
                              {editingGroup === idx ? (
                                <input
                                  type="text"
                                  value={group.name}
                                  onChange={(e) => {
                                    const updated = [...localGroupings];
                                    updated[idx] = { ...group, name: e.target.value };
                                    setLocalGroupings(updated);
                                  }}
                                  onBlur={() => {
                                    onUpdate({ groupings: localGroupings });
                                    setEditingGroup(null);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      onUpdate({ groupings: localGroupings });
                                      setEditingGroup(null);
                                    } else if (e.key === "Escape") {
                                      setEditingGroup(null);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                                  autoFocus
                                />
                              ) : (
                                <div
                                  className="font-medium text-sm cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                                  onClick={() => setEditingGroup(idx)}
                                >
                                  {group.name}
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  const updated = localGroupings.filter((_, i) => i !== idx);
                                  setLocalGroupings(updated);
                                  onUpdate({ groupings: updated });
                                }}
                                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1"
                                title="Delete group"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {group.fields.length} field{group.fields.length !== 1 ? "s" : ""}
                            </div>
                            {/* Field selection for group */}
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  const updated = [...localGroupings];
                                  if (!updated[idx].fields.includes(e.target.value)) {
                                    updated[idx] = {
                                      ...group,
                                      fields: [...group.fields, e.target.value],
                                    };
                                    setLocalGroupings(updated);
                                    onUpdate({ groupings: updated });
                                  }
                                  e.target.value = "";
                                }
                              }}
                              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
                            >
                              <option value="">Add field to group...</option>
                              {fields
                                .filter((f) => !group.fields.includes(f.id))
                                .map((field) => (
                                  <option key={field.id} value={field.id}>
                                    {field.label}
                                  </option>
                                ))}
                            </select>
                            {/* Fields in group */}
                            {group.fields.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {group.fields.map((fieldId) => {
                                  const field = fields.find((f) => f.id === fieldId);
                                  if (!field) return null;
                                  return (
                                    <span
                                      key={fieldId}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                    >
                                      {field.label}
                                      <button
                                        onClick={() => {
                                          const updated = [...localGroupings];
                                          updated[idx] = {
                                            ...group,
                                            fields: group.fields.filter((id) => id !== fieldId),
                                          };
                                          setLocalGroupings(updated);
                                          onUpdate({ groupings: updated });
                                        }}
                                        className="text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
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
                <div className="pb-4 border-b border-gray-200 dark:border-gray-700 space-y-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      From Date Field
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
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Required: The start date for calendar events
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      To Date Field (Optional)
                    </h3>
                    <select
                      value={localCalendarDateToField}
                      onChange={(e) => {
                        setLocalCalendarDateToField(e.target.value);
                        onUpdate({ calendar_date_to_field: e.target.value || undefined });
                      }}
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="">None (single date)</option>
                      {dateFields.map((field) => (
                        <option key={field.id} value={field.field_key}>
                          {field.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Optional: Select a field to create date range events (periods of time)
                    </p>
                  </div>
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

