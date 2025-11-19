"use client";

import { useState, useEffect } from "react";
import { X, Plus } from "lucide-react";
import { Field } from "@/lib/fields";
import { Filter, FilterOperator, getOperatorsForFieldType, getOperatorLabel } from "@/lib/types/filters";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  fields: Field[];
  filters: Filter[];
  onFiltersChange: (filters: Filter[]) => void;
}

export default function FilterPanel({
  open,
  onClose,
  fields,
  filters,
  onFiltersChange,
}: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState<Filter[]>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  if (!open) return null;

  const addFilter = () => {
    const firstField = fields.find((f) => f.type !== "linked_record") || fields[0];
    if (!firstField) return;

    const operators = getOperatorsForFieldType(firstField.type);
    const newFilter: Filter = {
      id: `filter_${Date.now()}`,
      field: firstField.field_key,
      operator: operators[0],
      value: "",
    };
    setLocalFilters([...localFilters, newFilter]);
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setLocalFilters(
      localFilters.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  };

  const removeFilter = (id: string) => {
    setLocalFilters(localFilters.filter((f) => f.id !== id));
  };

  const handleSave = () => {
    onFiltersChange(localFilters);
  };

  const handleClear = () => {
    setLocalFilters([]);
    onFiltersChange([]);
  };

  const getField = (fieldKey: string) => {
    return fields.find((f) => f.field_key === fieldKey);
  };

  const renderValueInput = (filter: Filter) => {
    const field = getField(filter.field);
    if (!field) return null;

    const operators = getOperatorsForFieldType(field.type);
    const needsValue = !["is_empty", "is_not_empty"].includes(filter.operator);

    if (!needsValue) {
      return <span className="text-sm text-gray-500">(no value needed)</span>;
    }

    switch (field.type) {
      case "text":
      case "long_text":
        return (
          <input
            type="text"
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            placeholder="Enter value..."
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value ? Number(e.target.value) : "" })}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            placeholder="Enter number..."
          />
        );

      case "date":
        if (filter.operator === "in_range") {
          return (
            <div className="flex gap-2">
              <input
                type="date"
                value={Array.isArray(filter.value) ? filter.value[0] || "" : ""}
                onChange={(e) =>
                  updateFilter(filter.id, {
                    value: [e.target.value, Array.isArray(filter.value) ? filter.value[1] || "" : ""],
                  })
                }
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
              <input
                type="date"
                value={Array.isArray(filter.value) ? filter.value[1] || "" : ""}
                onChange={(e) =>
                  updateFilter(filter.id, {
                    value: [Array.isArray(filter.value) ? filter.value[0] || "" : "", e.target.value],
                  })
                }
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          );
        }
        return (
          <input
            type="date"
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          />
        );

      case "single_select":
        const selectOptions = field.options?.values || [];
        return (
          <select
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">Select option...</option>
            {selectOptions.map((opt: any) => (
              <option key={opt.id || opt.label} value={opt.id || opt.label}>
                {opt.label || opt.id}
              </option>
            ))}
          </select>
        );

      case "boolean":
        return (
          <select
            value={filter.value === true ? "true" : filter.value === false ? "false" : ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value === "true" ? true : e.target.value === "false" ? false : null })}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
          >
            <option value="">Select...</option>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );

      default:
        return (
          <input
            type="text"
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
            placeholder="Enter value..."
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-96 bg-white dark:bg-gray-950 shadow-xl h-full overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-heading text-brand-blue">Filters</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Add Filter Button */}
          <button
            onClick={addFilter}
            className="w-full btn-secondary mb-4 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Filter
          </button>

          {/* Active Filters */}
          <div className="space-y-3">
            {localFilters.length === 0 ? (
              <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No filters applied
              </div>
            ) : (
              localFilters.map((filter) => {
                const field = getField(filter.field);
                const operators = field ? getOperatorsForFieldType(field.type) : [];

                return (
                  <div
                    key={filter.id}
                    className="border border-gray-300 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <div className="flex-1 space-y-2">
                        {/* Field Select */}
                        <select
                          value={filter.field}
                          onChange={(e) => {
                            const newField = getField(e.target.value);
                            if (newField) {
                              const newOperators = getOperatorsForFieldType(newField.type);
                              updateFilter(filter.id, {
                                field: e.target.value,
                                operator: newOperators[0],
                                value: "",
                              });
                            }
                          }}
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        >
                          {fields.map((f) => (
                            <option key={f.id} value={f.field_key}>
                              {f.label}
                            </option>
                          ))}
                        </select>

                        {/* Operator Select */}
                        <select
                          value={filter.operator}
                          onChange={(e) => updateFilter(filter.id, { operator: e.target.value as FilterOperator, value: "" })}
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                        >
                          {operators.map((op) => (
                            <option key={op} value={op}>
                              {getOperatorLabel(op)}
                            </option>
                          ))}
                        </select>

                        {/* Value Input */}
                        {renderValueInput(filter)}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFilter(filter.id)}
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                        title="Remove filter"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
            <button onClick={handleClear} className="btn-secondary flex-1">
              Clear All
            </button>
            <button onClick={handleSave} className="btn-primary flex-1">
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

