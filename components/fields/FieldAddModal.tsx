"use client";

import { useState } from "react";
import { FieldType } from "@/lib/fields";

interface FieldAddModalProps {
  onClose: () => void;
  onAdd: (label: string, type: FieldType, required: boolean) => void;
}

export default function FieldAddModal({ onClose, onAdd }: FieldAddModalProps) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd(label.trim(), type, required);
    setLabel("");
    setType("text");
    setRequired(false);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Add New Field</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Field Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
              placeholder="e.g., Priority, Category, etc."
              required
              autoFocus
            />
          </div>

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

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Required field</span>
          </label>

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Add Field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

