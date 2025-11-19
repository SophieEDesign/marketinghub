"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { Field, FieldOption } from "@/lib/fields";

interface MultiSelectDropdownProps {
  field: Field;
  value: string[] | null;
  onChange: (value: string[] | null) => void;
}

export default function MultiSelectDropdown({
  field,
  value,
  onChange,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = field.options?.values || [];

  const selectedValues = Array.isArray(value) ? value : [];
  const selectedOptions = options.filter((opt: FieldOption) =>
    selectedValues.includes(opt.id)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const toggleOption = (optionId: string) => {
    const current = selectedValues;
    if (current.includes(optionId)) {
      const newValue = current.filter((id) => id !== optionId);
      onChange(newValue.length > 0 ? newValue : null);
    } else {
      onChange([...current, optionId]);
    }
  };

  const removeOption = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newValue = selectedValues.filter((id) => id !== optionId);
    onChange(newValue.length > 0 ? newValue : null);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between text-left"
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt: FieldOption) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              >
                {opt.label}
                <button
                  onClick={(e) => removeOption(opt.id, e)}
                  className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          ) : (
            <span className="text-gray-500 dark:text-gray-400">
              Select {field.label}...
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No options available
              </div>
            ) : (
              options.map((opt: FieldOption) => {
                const isSelected = selectedValues.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id)}
                    className={`w-full text-left px-3 py-2 rounded text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition flex items-center gap-2 ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-900/30 font-medium"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {isSelected && (
                        <Check className="w-3 h-3 text-white" />
                      )}
                    </div>
                    {opt.color && (
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                    <span>{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

