"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useFieldManager } from "@/lib/useFieldManager";
import { tables } from "@/lib/tables";
import { Field, FieldType } from "@/lib/fields";
import FieldList from "@/components/fields/FieldList";
import FieldEditor from "@/components/fields/FieldEditor";
import FieldAddModal from "@/components/fields/FieldAddModal";

function FieldManagerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table") || "content";

  const {
    fields,
    loading,
    error,
    getFields,
    addField,
    deleteField,
    updateField,
    reorderFields,
    addSelectOption,
    removeSelectOption,
    updateSelectOption,
  } = useFieldManager(tableId);

  const [editingField, setEditingField] = useState<Field | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    getFields();
  }, [tableId, getFields]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newFields = [...fields];
    const [moved] = newFields.splice(oldIndex, 1);
    newFields.splice(newIndex, 0, moved);

    const fieldIds = newFields.map((f) => f.id);
    reorderFields(fieldIds);
  };

  const handleAdd = async (label: string, type: FieldType, required: boolean) => {
    await addField(label, type, required);
    setShowAddModal(false);
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm("Are you sure you want to delete this field? This cannot be undone.")) {
      return;
    }
    await deleteField(fieldId);
  };

  const handleUpdate = async (updates: Partial<Field>) => {
    if (!editingField) return;
    await updateField(editingField.id, updates);
    setEditingField(null);
  };

  const currentTable = tables.find((t) => t.id === tableId);

  if (loading && fields.length === 0) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading fields...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Field Manager – {currentTable?.name || tableId} Table</h1>
        <div className="flex items-center gap-4">
          <select
            value={tableId}
            onChange={(e) => router.push(`/settings/fields?table=${e.target.value}`)}
            className="px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
          >
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            Managing fields for: <strong>{currentTable?.name || tableId}</strong>
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Fields ({fields.length})</h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm font-medium"
          >
            + Add Field
          </button>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="mb-2">No fields configured yet.</p>
            <p className="text-sm">Click "Add Field" to get started.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {fields.map((field) => (
                  <FieldList
                    key={field.id}
                    field={field}
                    onEdit={setEditingField}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {showAddModal && (
        <FieldAddModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}

      {editingField && (
        <FieldEditor
          field={editingField}
          onClose={() => setEditingField(null)}
          onSave={handleUpdate}
          onAddOption={async (option) => {
            if (editingField) {
              await addSelectOption(editingField.id, option);
              await getFields();
            }
          }}
          onUpdateOption={async (optionId, changes) => {
            if (editingField) {
              await updateSelectOption(editingField.id, optionId, changes);
              await getFields();
            }
          }}
          onRemoveOption={async (optionId) => {
            if (editingField) {
              await removeSelectOption(editingField.id, optionId);
              await getFields();
            }
          }}
        />
      )}
    </div>
  );
}

export default function FieldManagerPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading fields...</div>
      </div>
    }>
      <FieldManagerContent />
    </Suspense>
  );
}
