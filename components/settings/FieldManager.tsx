"use client";

import { useState, useEffect } from "react";
import { loadFields, createField, updateField, deleteField, reorderFields, Field, FieldType } from "@/lib/fields";
import { usePathname } from "next/navigation";

export default function FieldManager() {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const currentTable = pathParts[0] || "";

  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState({
    label: "",
    type: "text" as FieldType,
    required: false,
  });

  useEffect(() => {
    if (currentTable) {
    load();
    } else {
      setFields([]);
      setLoading(false);
    }
  }, [currentTable]);

  async function load() {
    if (!currentTable) return;
    setLoading(true);
    const tableFields = await loadFields(currentTable);
    setFields(tableFields);
    setLoading(false);
  }

  async function handleAddField() {
    if (!newField.label.trim()) return;

    const fieldKey = newField.label.toLowerCase().replace(/\s+/g, "_");
    const maxOrder = fields.length > 0 ? Math.max(...fields.map((f) => f.order)) : -1;

    const field = await createField(currentTable, {
      field_key: fieldKey,
      label: newField.label,
      type: newField.type,
      options: newField.type === "single_select" || newField.type === "multi_select" ? { values: [] } : undefined,
      order: maxOrder + 1,
      required: newField.required,
      // Note: visible column doesn't exist in table_fields - removed
    });

    if (field) {
      await load();
      setShowAddField(false);
      setNewField({ label: "", type: "text", required: false });
    }
  }

  async function handleUpdateField(fieldId: string, updates: Partial<Field>) {
    await updateField(currentTable, fieldId, updates);
    await load();
    setEditingField(null);
  }

  async function handleDeleteField(fieldId: string, fieldKey: string) {
    if (!confirm(`Are you sure you want to delete this field? This cannot be undone.`)) {
      return;
    }

    await deleteField(currentTable, fieldId);
    await load();
  }

  async function handleReorder(newOrder: Field[]) {
    const fieldIds = newOrder.map((f) => f.id);
    await reorderFields(currentTable, fieldIds);
    await load();
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Loading fields...</div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Fields</h3>
        <button
          onClick={() => setShowAddField(true)}
          className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm"
        >
          + Add Field
        </button>
      </div>

      {showAddField && (
        <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Field name"
              value={newField.label}
              onChange={(e) => setNewField({ ...newField, label: e.target.value })}
              className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            />
            <select
              value={newField.type}
              onChange={(e) => setNewField({ ...newField, type: e.target.value as FieldType })}
              className="p-2 rounded bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            >
              <option value="text">Text</option>
              <option value="long_text">Long Text</option>
              <option value="date">Date</option>
              <option value="single_select">Single Select</option>
              <option value="multi_select">Multi Select</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="attachment">Attachment</option>
              <option value="linked_record">Linked Record</option>
            </select>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newField.required}
                onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
              />
              <span className="text-sm">Required</span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={handleAddField}
                className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition text-sm"
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowAddField(false);
                  setNewField({ label: "", type: "text", required: false });
                }}
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {fields.map((field) => (
          <div
            key={field.id}
            className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-between"
          >
            <div className="flex-1">
              <div className="font-medium">{field.label}</div>
              <div className="text-xs text-gray-500">
                {field.field_key} • {field.type} {field.required && "• Required"}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingField(field)}
                className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition text-xs"
              >
                Edit
              </button>
              <button
                onClick={() => handleDeleteField(field.id, field.field_key)}
                className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition text-xs"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingField && (
        <EditFieldModal
          field={editingField}
          onClose={() => setEditingField(null)}
          onSave={(updates) => handleUpdateField(editingField.id, updates)}
        />
      )}
    </div>
  );
}

function EditFieldModal({
  field,
  onClose,
  onSave,
}: {
  field: Field;
  onClose: () => void;
  onSave: (updates: Partial<Field>) => void;
}) {
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState(field.type);
  const [required, setRequired] = useState(field.required);
  const [visible, setVisible] = useState(field.visible ?? true);
  const [options, setOptions] = useState<any[]>(
    Array.isArray(field.options) ? field.options : []
  );

  const handleSave = () => {
    onSave({
      label,
      type,
      required,
      visible,
      options: type === "single_select" || type === "multi_select" ? options : undefined,
    });
  };

  const addOption = () => {
    setOptions([...options, { id: `opt_${Date.now()}`, label: "" }]);
  };

  const updateOption = (index: number, label: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], label };
    setOptions(updated);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold mb-4">Edit Field</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm block mb-1">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            />
          </div>
          <div>
            <label className="text-sm block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FieldType)}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            >
              <option value="text">Text</option>
              <option value="long_text">Long Text</option>
              <option value="date">Date</option>
              <option value="single_select">Single Select</option>
              <option value="multi_select">Multi Select</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="attachment">Attachment</option>
              <option value="linked_record">Linked Record</option>
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
            />
            <span className="text-sm">Required</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />
            <span className="text-sm">Visible</span>
          </label>
          {(type === "single_select" || type === "multi_select") && (
            <div>
              <label className="text-sm block mb-1">Options</label>
              <div className="flex flex-col gap-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={opt.label}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      className="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                      placeholder="Option label"
                    />
                    <button
                      onClick={() => removeOption(idx)}
                      className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
                >
                  + Add Option
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
