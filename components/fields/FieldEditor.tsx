"use client";

import { useState, useEffect } from "react";
import { Field, FieldType, FieldOption } from "@/lib/fields";

interface FieldEditorProps {
  field: Field;
  onClose: () => void;
  onSave: (updates: Partial<Field>) => void;
  onAddOption?: (option: FieldOption) => void;
  onUpdateOption?: (optionId: string, changes: Partial<FieldOption>) => void;
  onRemoveOption?: (optionId: string) => void;
}

export default function FieldEditor({
  field,
  onClose,
  onSave,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: FieldEditorProps) {
  const [label, setLabel] = useState(field.label);
  const [type, setType] = useState(field.type);
  const [required, setRequired] = useState(field.required);
  const [visible, setVisible] = useState(field.visible ?? true);
  const [options, setOptions] = useState<FieldOption[]>(
    field.options?.values || []
  );

  useEffect(() => {
    setLabel(field.label);
    setType(field.type);
    setRequired(field.required);
    setVisible(field.visible ?? true);
    setOptions(field.options?.values || []);
  }, [field]);

  const handleSave = () => {
    onSave({
      label,
      type,
      required,
      visible,
      options:
        type === "single_select" || type === "multi_select"
          ? { values: options }
          : undefined,
    });
  };

  const addOption = () => {
    const newOption: FieldOption = {
      id: `opt_${Date.now()}`,
      label: "",
      color: "#9ca3af",
    };
    setOptions([...options, newOption]);
    if (onAddOption) {
      onAddOption(newOption);
    }
  };

  const updateOption = (index: number, changes: Partial<FieldOption>) => {
    const updated = [...options];
    updated[index] = { ...updated[index], ...changes };
    setOptions(updated);
    
    if (onUpdateOption && updated[index].id) {
      onUpdateOption(updated[index].id, changes);
    }
  };

  const removeOption = (index: number) => {
    const option = options[index];
    setOptions(options.filter((_, i) => i !== index));
    
    if (onRemoveOption && option.id) {
      onRemoveOption(option.id);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold">Edit Field</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {/* Label */}
            <div>
              <label className="text-sm font-medium block mb-1">Field Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                placeholder="Field name"
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-sm font-medium block mb-1">Field Type</label>
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

            {/* Required & Visible */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={(e) => setRequired(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Required</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={visible}
                  onChange={(e) => setVisible(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Visible</span>
              </label>
            </div>

            {/* Options for Select Types */}
            {(type === "single_select" || type === "multi_select") && (
              <div>
                <label className="text-sm font-medium block mb-2">Options</label>
                <div className="flex flex-col gap-2">
                  {options.map((opt, idx) => (
                    <div key={opt.id || idx} className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={opt.color || "#9ca3af"}
                        onChange={(e) =>
                          updateOption(idx, { color: e.target.value })
                        }
                        className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={opt.label}
                        onChange={(e) => updateOption(idx, { label: e.target.value })}
                        className="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                        placeholder="Option label"
                      />
                      <button
                        onClick={() => removeOption(idx)}
                        className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addOption}
                    className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
                  >
                    + Add Option
                  </button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

