"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Field } from "@/lib/fields";
import { useFieldManager } from "@/lib/useFieldManager";

interface InlineSelectEditorProps {
  field: Field;
  value: string | null;
  onChange: (value: string | null) => void;
  onClose: () => void;
}

export default function InlineSelectEditor({
  field,
  value,
  onChange,
  onClose,
}: InlineSelectEditorProps) {
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [showAddOption, setShowAddOption] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { addSelectOption, fields } = useFieldManager(field.table_id);

  const options = field.options?.values || [];

  useEffect(() => {
    if (showAddOption && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAddOption]);

  const handleAddOption = async () => {
    if (!newOptionLabel.trim()) return;

    const newOption = {
      id: newOptionLabel.toLowerCase().replace(/\s+/g, "_"),
      label: newOptionLabel.trim(),
      color: "#9ca3af",
    };

    // Add option to field
    await addSelectOption(field.id, newOption);

    // Select the new option
    onChange(newOption.id);

    // Reset and close
    setNewOptionLabel("");
    setShowAddOption(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    } else if (e.key === "Escape") {
      setShowAddOption(false);
      setNewOptionLabel("");
    }
  };

  return (
    <div className="absolute z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto">
      <div className="p-1">
        {/* Existing Options */}
        <div className="space-y-0.5">
          <button
            onClick={() => {
              onChange(null);
              onClose();
            }}
            className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
              !value ? "bg-gray-100 dark:bg-gray-700 font-medium" : ""
            }`}
          >
            <span className="text-gray-400">Clear</span>
          </button>
          {options.map((opt: any) => (
            <button
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                onClose();
              }}
              className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center gap-2 ${
                value === opt.id ? "bg-blue-50 dark:bg-blue-900/30 font-medium" : ""
              }`}
            >
              {opt.color && (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: opt.color }}
                />
              )}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Add New Option */}
        {showAddOption ? (
          <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 px-2 py-1">
              <input
                ref={inputRef}
                type="text"
                value={newOptionLabel}
                onChange={(e) => setNewOptionLabel(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="New option name..."
                className="flex-1 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleAddOption}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Add option"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setShowAddOption(false);
                  setNewOptionLabel("");
                }}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddOption(true)}
            className="w-full mt-1 pt-1 border-t border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add option</span>
          </button>
        )}
      </div>
    </div>
  );
}

