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
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
            placeholder="Enter value..."
          />
        );

      case "number":
        return (
          <input
            type="number"
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value ? Number(e.target.value) : "" })}
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
            placeholder="Enter number..."
          />
        );

      case "date":
        if (filter.operator === "in_range" || filter.operator === "range") {
          return (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={Array.isArray(filter.value) ? filter.value[0] || "" : ""}
                onChange={(e) =>
                  updateFilter(filter.id, {
                    value: [e.target.value, Array.isArray(filter.value) ? filter.value[1] || "" : ""],
                  })
                }
                className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
              />
              <input
                type="date"
                value={Array.isArray(filter.value) ? filter.value[1] || "" : ""}
                onChange={(e) =>
                  updateFilter(filter.id, {
                    value: [Array.isArray(filter.value) ? filter.value[0] || "" : "", e.target.value],
                  })
                }
                className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
              />
            </div>
          );
        }
        return (
          <input
            type="date"
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
          />
        );

      case "single_select":
        const selectOptions = field.options?.values || [];
        return (
          <select
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
          >
            <option value="">Select option...</option>
            {selectOptions.map((opt: any) => (
              <option key={opt.id || opt.label} value={opt.id || opt.label}>
                {opt.label || opt.id}
              </option>
            ))}
          </select>
        );

      case "multi_select":
        const multiSelectOptions = field.options?.values || [];
        if (filter.operator === "includes_any_of") {
          // Multi-select for "includes any of" - allows multiple values
          return (
            <div className="space-y-2">
              {Array.isArray(filter.value) && filter.value.length > 0 ? (
                filter.value.map((val: string, idx: number) => (
                  <div key={idx} className="flex gap-2">
                    <select
                      value={val || ""}
                      onChange={(e) => {
                        const newValue = [...(filter.value || [])];
                        newValue[idx] = e.target.value;
                        updateFilter(filter.id, { value: newValue });
                      }}
                      className="flex-1 px-3 py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm"
                    >
                      <option value="">Select option...</option>
                      {multiSelectOptions.map((opt: any) => (
                        <option key={opt.id || opt.label} value={opt.id || opt.label}>
                          {opt.label || opt.id}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        const newValue = [...(filter.value || [])];
                        newValue.splice(idx, 1);
                        updateFilter(filter.id, { value: newValue.length > 0 ? newValue : [] });
                      }}
                      className="px-2 text-red-600 hover:text-red-700"
                      title="Remove value"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : null}
              <button
                onClick={() => {
                  const newValue = Array.isArray(filter.value) ? [...filter.value, ""] : [""];
                  updateFilter(filter.id, { value: newValue });
                }}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add value
              </button>
            </div>
          );
        }
        // Single value for "includes" or "contains"
        return (
          <select
            value={filter.value || ""}
            onChange={(e) => updateFilter(filter.id, { value: e.target.value })}
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
          >
            <option value="">Select option...</option>
            {multiSelectOptions.map((opt: any) => (
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
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
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
            className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
            placeholder="Enter value..."
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-full md:w-96 md:max-w-md bg-white dark:bg-gray-950 shadow-xl h-full overflow-y-auto border-l border-gray-200 dark:border-gray-700">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h2 className="text-lg md:text-xl font-heading text-brand-blue">Filters</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 -mr-2 touch-manipulation"
              aria-label="Close filters"
            >
              <X className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>

          {/* Add Filter Button */}
          <button
            onClick={addFilter}
            className="w-full btn-secondary mb-4 flex items-center justify-center gap-2 py-3 md:py-2 touch-manipulation"
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="text-sm md:text-base">Add Filter</span>
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
                    className="border border-gray-300 dark:border-gray-700 rounded-md p-3 md:p-4 bg-gray-50 dark:bg-gray-900"
                  >
                    <div className="flex items-start gap-2 md:gap-3 mb-2">
                      <div className="flex-1 space-y-2 md:space-y-3">
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
                          className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
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
                          className="w-full px-3 py-2.5 md:py-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm md:text-base touch-manipulation"
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
                        className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 -mt-1 touch-manipulation"
                        title="Remove filter"
                        aria-label="Remove filter"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-2 md:gap-3">
            <button onClick={handleClear} className="btn-secondary flex-1 py-3 md:py-2 touch-manipulation">
              <span className="text-sm md:text-base">Clear All</span>
            </button>
            <button onClick={handleSave} className="btn-primary flex-1 py-3 md:py-2 touch-manipulation">
              <span className="text-sm md:text-base">Apply Filters</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

