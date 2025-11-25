"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import Button from "@/components/ui/Button";
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
import { Field, FieldType } from "@/lib/fields";
import FieldList from "@/components/fields/FieldList";
import FieldEditor from "@/components/fields/FieldEditor";
import FieldAddModal from "@/components/fields/FieldAddModal";

interface DynamicTable {
  id: string;
  name: string;
  label: string;
  description: string;
}

function FieldsContent() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const [table, setTable] = useState<DynamicTable | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Resolve table name from tableId (could be UUID or table name)
  const [tableName, setTableName] = useState<string>("");

  const {
    fields,
    loading: fieldsLoading,
    error,
    getFields,
    addField,
    deleteField,
    updateField,
    reorderFields,
    addSelectOption,
    removeSelectOption,
    updateSelectOption,
  } = useFieldManager(tableName);

  const [editingField, setEditingField] = useState<Field | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadTable();
  }, [tableId]);

  useEffect(() => {
    if (tableName) {
      getFields();
    }
  }, [tableName, getFields]);

  const loadTable = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tables/${tableId}`);
      if (!response.ok) throw new Error("Failed to load table");
      const data = await response.json();
      setTable(data);
      setTableName(data.name); // Use the actual table name for field manager
    } catch (error: any) {
      console.error("Error loading table:", error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading || fieldsLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading fields...</div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-500">Table not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/tables/${tableId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {table.label} - Fields
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage fields for this table
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Field
            </Button>
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Fields ({fields.length})</h2>
          </div>

          {fields.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p className="mb-2">No fields configured yet.</p>
              <p className="text-sm">Click "New Field" to get started.</p>
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

export default function FieldsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      }
    >
      <FieldsContent />
    </Suspense>
  );
}

