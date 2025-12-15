"use client";

import { useState, useEffect, useRef } from "react";
import { X, Check } from "lucide-react";
import { FieldType } from "@/lib/fields";
import { useTables } from "@/lib/hooks/useTables";
import { loadFields } from "@/lib/fields";

interface FieldTypeConfirmModalProps {
  open: boolean;
  onClose: () => void;
  columnName: string;
  suggestedType: FieldType;
  sampleValues: string[];
  onConfirm: (fieldType: FieldType, options?: { to_table?: string; display_field?: string }) => void;
}

const fieldTypeDescriptions: Record<FieldType, string> = {
  text: "Short text (up to 255 characters)",
  long_text: "Long text (unlimited length)",
  date: "Date and time",
  single_select: "Single choice from options",
  multi_select: "Multiple choices from options",
  number: "Numeric value",
  boolean: "True/False or Yes/No",
  attachment: "File or image URL",
  linked_record: "Link to another record",
};

export default function FieldTypeConfirmModal({
  open,
  onClose,
  columnName,
  suggestedType,
  sampleValues,
  onConfirm,
}: FieldTypeConfirmModalProps) {
  const [selectedType, setSelectedType] = useState<FieldType>(suggestedType);
  const [linkedTable, setLinkedTable] = useState<string>("");
  const [displayField, setDisplayField] = useState<string>("name");
  const [availableFields, setAvailableFields] = useState<string[]>([]);
  const { tables, loading: tablesLoading } = useTables();
  const selectRef = useRef<HTMLSelectElement>(null);

  // Load fields when linked table is selected
  useEffect(() => {
    if (selectedType === "linked_record" && linkedTable) {
      loadFields(linkedTable).then((fields) => {
        // Find common title/name fields
        const textFields = fields
          .filter((f) => f.type === "text" || f.type === "long_text")
          .map((f) => f.field_key);
        
        // Prioritize common names
        const commonNames = ["name", "title", "label", "id"];
        const prioritized = [
          ...commonNames.filter((name) => textFields.includes(name)),
          ...textFields.filter((f) => !commonNames.includes(f)),
        ];
        
        setAvailableFields(prioritized);
        
        // Auto-select first available field
        if (prioritized.length > 0 && !displayField) {
          setDisplayField(prioritized[0]);
        }
      });
    }
  }, [linkedTable, selectedType]);

  useEffect(() => {
    if (open) {
      setSelectedType(suggestedType);
      setLinkedTable("");
      setDisplayField("name");
      // Focus select after modal opens
      setTimeout(() => {
        selectRef.current?.focus();
      }, 100);
    }
  }, [open, suggestedType]);

  const handleConfirm = () => {
    if (selectedType === "linked_record") {
      if (!linkedTable) {
        alert("Please select a table to link to");
        return;
      }
      onConfirm(selectedType, {
        to_table: linkedTable,
        display_field: displayField || "name",
      });
    } else {
      onConfirm(selectedType);
    }
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Confirm Field Type
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Column Name
            </label>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md text-sm text-gray-900 dark:text-gray-100">
              {columnName}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Field Type
            </label>
            <select
              ref={selectRef}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as FieldType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.keys(fieldTypeDescriptions).map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} - {fieldTypeDescriptions[type as FieldType]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {fieldTypeDescriptions[selectedType]}
            </p>
          </div>

          {sampleValues.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sample Values ({sampleValues.length})
              </label>
              <div className="max-h-32 overflow-y-auto px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-md text-xs text-gray-600 dark:text-gray-400 space-y-1">
                {sampleValues.slice(0, 5).map((value, idx) => (
                  <div key={idx} className="truncate">
                    {value || "(empty)"}
                  </div>
                ))}
                {sampleValues.length > 5 && (
                  <div className="text-gray-400 dark:text-gray-500">
                    ... and {sampleValues.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Linked Record Configuration */}
          {selectedType === "linked_record" && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Link to Table <span className="text-red-500">*</span>
                </label>
                <select
                  value={linkedTable}
                  onChange={(e) => setLinkedTable(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a table...</option>
                  {tables.map((table) => (
                    <option key={table.id} value={table.name}>
                      {table.label || table.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Select which table this field should link to
                </p>
              </div>

              {linkedTable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Display Field <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={displayField}
                    onChange={(e) => setDisplayField(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {availableFields.length > 0 ? (
                      availableFields.map((fieldKey) => (
                        <option key={fieldKey} value={fieldKey}>
                          {fieldKey}
                        </option>
                      ))
                    ) : (
                      <option value="name">name (default)</option>
                    )}
                  </select>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Field to display from the linked table (e.g., "name", "title"). 
                    During import, CSV values will be matched against this field.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-3">
            <p className="text-xs text-blue-800 dark:text-blue-200">
              <strong>Auto-detected:</strong> {suggestedType.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())} - {fieldTypeDescriptions[suggestedType]}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              You can change the type above if needed.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedType === "linked_record" && !linkedTable}
            className="px-4 py-2 text-sm font-medium bg-brand-red text-white rounded-md hover:bg-brand-redDark transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
            Create Field
          </button>
        </div>
      </div>
    </div>
  );
}

