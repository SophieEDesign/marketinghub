"use client";

import { useState, useRef, useEffect } from "react";
import { Field } from "@/lib/fields";
import FieldInput from "./FieldInput";
import InlineSelectEditor from "./InlineSelectEditor";
import MultiSelectDropdown from "./MultiSelectDropdown";

interface InlineFieldEditorProps {
  field: Field;
  value: any;
  recordId: string;
  tableId: string;
  onSave: (value: any) => Promise<void>;
  onCancel: () => void;
}

export default function InlineFieldEditor({
  field,
  value,
  recordId,
  tableId,
  onSave,
  onCancel,
}: InlineFieldEditorProps) {
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [showSelectDropdown, setShowSelectDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (showSelectDropdown) {
          setShowSelectDropdown(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showSelectDropdown]);

  const handleSave = async () => {
    if (editValue === value) {
      onCancel();
      return;
    }

    setSaving(true);
    try {
      await onSave(editValue);
    } catch (error) {
      console.error("Error saving:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  // For select fields, show inline dropdown editor
  if (field.type === "single_select") {
    return (
      <div ref={containerRef} className="relative">
        {showSelectDropdown ? (
          <InlineSelectEditor
            field={field}
            value={editValue}
            onChange={(newValue) => {
              setEditValue(newValue);
              handleSave();
            }}
            onClose={() => setShowSelectDropdown(false)}
          />
        ) : (
          <button
            onClick={() => setShowSelectDropdown(true)}
            className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <span className="text-sm">
              {field.options?.values?.find(
                (opt: any) => opt.id === editValue
              )?.label || editValue || "Select..."}
            </span>
          </button>
        )}
      </div>
    );
  }

  // For multi-select, use the dropdown component
  if (field.type === "multi_select") {
    return (
      <div ref={containerRef} className="relative">
        <MultiSelectDropdown
          field={field}
          value={Array.isArray(editValue) ? editValue : null}
          onChange={(newValue) => {
            setEditValue(newValue);
            // Auto-save on change for multi-select
            setTimeout(() => {
              handleSave();
            }, 100);
          }}
        />
      </div>
    );
  }

  // For other field types, use FieldInput
  return (
    <div ref={containerRef} onKeyDown={handleKeyDown}>
      <FieldInput
        field={field}
        value={editValue}
        onChange={setEditValue}
        table={tableId}
        recordId={recordId}
      />
      <div className="flex gap-2 mt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary text-xs disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="btn-secondary text-xs"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

