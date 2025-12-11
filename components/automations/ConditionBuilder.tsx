"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTables } from "@/lib/hooks/useTables";
import { useFields } from "@/lib/useFields";
import { Condition, FieldCondition } from "@/lib/automations/schema";
import { getOperatorsForFieldType, getOperatorLabel } from "@/lib/types/filters";

interface ConditionBuilderProps {
  conditions: Condition[];
  tableId?: string;
  onChange: (conditions: Condition[]) => void;
}

export default function ConditionBuilder({
  conditions,
  tableId,
  onChange,
}: ConditionBuilderProps) {
  const { tables } = useTables();
  const [selectedTableId, setSelectedTableId] = useState<string>(tableId || "");
  const { fields } = useFields(selectedTableId || "");

  const addCondition = () => {
    const newCondition: Condition = {
      type: "field",
      field_key: "",
      operator: "equals",
      value: "",
    };
    onChange([...conditions, newCondition]);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates } as Condition;
    onChange(newConditions);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  // If tableId is not provided, allow table selection
  const showTableSelector = !tableId;

  return (
    <div className="space-y-4">
      {showTableSelector && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Table (for condition fields)
          </label>
          <select
            value={selectedTableId}
            onChange={(e) => setSelectedTableId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          >
            <option value="">Select a table...</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.label} ({table.name})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-3">
        {conditions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-md">
            No conditions. Automation will run whenever the trigger fires.
          </div>
        ) : (
          conditions.map((condition, index) => (
            <ConditionEditor
              key={index}
              condition={condition}
              tableId={selectedTableId || tableId}
              fields={fields}
              onChange={(updates) => updateCondition(index, updates)}
              onRemove={() => removeCondition(index)}
            />
          ))
        )}
      </div>

      <button
        onClick={addCondition}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <Plus className="w-4 h-4" />
        Add Condition
      </button>
    </div>
  );
}

// Condition Editor Component
function ConditionEditor({
  condition,
  tableId,
  fields,
  onChange,
  onRemove,
}: {
  condition: Condition;
  tableId?: string;
  fields: any[];
  onChange: (updates: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  // Type guard to check if it's a FieldCondition
  const isFieldCondition = (c: Condition): c is FieldCondition => {
    return c.type === "field";
  };
  const fieldCondition = isFieldCondition(condition) ? condition : null;
  
  const selectedField = fieldCondition ? fields.find((f) => f.field_key === fieldCondition.field_key) : null;
  const fieldType = selectedField?.type || "text";
  const operators = getOperatorsForFieldType(fieldType);

  // Only render if it's a FieldCondition
  if (!fieldCondition) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800">
        <p className="text-sm text-gray-500">Only field conditions are supported in this editor.</p>
        <button
          onClick={onRemove}
          className="mt-2 text-xs text-red-600 hover:text-red-800"
        >
          Remove condition
        </button>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              Field
            </label>
            <select
              value={fieldCondition.field_key || ""}
              onChange={(e) => onChange({ field_key: e.target.value } as any)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
            >
              <option value="">Select field...</option>
              {fields.map((field) => (
                <option key={field.id} value={field.field_key}>
                  {field.label} ({field.field_key})
                </option>
              ))}
            </select>
          </div>

          {fieldCondition.field_key && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Operator
                </label>
                <select
                  value={fieldCondition.operator || "equals"}
                  onChange={(e) => onChange({ operator: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                >
                  {operators.map((op) => (
                    <option key={op} value={op}>
                      {getOperatorLabel(op)}
                    </option>
                  ))}
                </select>
              </div>

              {!["is_empty", "is_not_empty"].includes(fieldCondition.operator || "equals") && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Value
                  </label>
                  {fieldType === "boolean" ? (
                    <select
                      value={String(fieldCondition.value || "")}
                      onChange={(e) => onChange({ value: e.target.value === "true" })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : fieldType === "date" || fieldType === "datetime" ? (
                    <input
                      type={fieldType === "date" ? "date" : "datetime-local"}
                      value={fieldCondition.value || ""}
                      onChange={(e) => onChange({ value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                    />
                  ) : fieldType === "number" ? (
                    <input
                      type="number"
                      value={fieldCondition.value || ""}
                      onChange={(e) => onChange({ value: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                    />
                  ) : (
                    <input
                      type="text"
                      value={fieldCondition.value || ""}
                      onChange={(e) => onChange({ value: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                      placeholder="Value"
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
