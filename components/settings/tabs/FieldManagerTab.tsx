"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { useTables } from "@/lib/hooks/useTables";
import { Field } from "@/lib/fields";
import FieldList from "@/components/fields/FieldList";
import FieldEditor from "@/components/fields/FieldEditor";
import FieldAddModal from "@/components/fields/FieldAddModal";

export default function FieldManagerTab() {
  const router = useRouter();
  const [tableId, setTableId] = useState("");
  const { tables: dynamicTables, loading: tablesLoading } = useTables();

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
    if (tableId) {
    getFields();
    }
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

  const handleAdd = async (label: string, type: any, required: boolean) => {
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

  const currentTable = dynamicTables.find((t) => t.name === tableId || t.id === tableId);

  if (loading && fields.length === 0) {
    return <div className="text-sm text-gray-500">Loading fields...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-semibold text-brand-blue mb-2">
            Field Manager – {currentTable?.label || tableId || "Select Table"} Table
          </h2>
          <div className="flex items-center gap-4">
            <select
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
              className="px-3 py-2 rounded bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            >
              <option value="">-- Select a table --</option>
              {dynamicTables.map((table) => (
                <option key={table.id} value={table.name}>
                  {table.label}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              Managing fields for: <strong>{currentTable?.label || tableId || "No table selected"}</strong>
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-sm"
        >
          + Add Field
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">Fields ({fields.length})</h3>

        {!tableId ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="mb-2">Please select a table to manage its fields.</p>
          </div>
        ) : fields.length === 0 ? (
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

