"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTables } from "@/lib/hooks/useTables";
import { useFields } from "@/lib/useFields";
import { AutomationAction } from "@/lib/automations/schema";

interface ActionBuilderProps {
  actions: AutomationAction[];
  onChange: (actions: AutomationAction[]) => void;
}

export default function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const { tables } = useTables();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addAction = (type: string) => {
    const newAction: any = { type };
    
    // Set defaults based on type
    switch (type) {
      case "send_email":
        newAction.to = "";
        newAction.subject = "";
        newAction.body = "";
        newAction.from = "";
        break;
      case "send_webhook":
        newAction.url = "";
        newAction.method = "POST";
        newAction.headers = {};
        newAction.body = {};
        break;
      case "update_record":
        newAction.table_id = "";
        newAction.table_name = "";
        newAction.record_id = "";
        newAction.field_updates = {};
        break;
      case "create_record":
        newAction.table_id = "";
        newAction.table_name = "";
        newAction.field_values = {};
        break;
      case "delete_record":
        newAction.table_id = "";
        newAction.table_name = "";
        newAction.record_id = "";
        break;
      case "set_field_value":
        newAction.field_key = "";
        newAction.value = "";
        break;
    }
    
    onChange([...actions, newAction]);
    setEditingIndex(actions.length);
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates } as AutomationAction;
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    onChange(newActions);
    if (editingIndex === index) {
      setEditingIndex(null);
    } else if (editingIndex !== null && editingIndex > index) {
      setEditingIndex(editingIndex - 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Actions List */}
      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border border-gray-200 dark:border-gray-700 rounded-md">
            No actions configured. Add an action to get started.
          </div>
        ) : (
          actions.map((action, index) => (
            <ActionEditor
              key={index}
              action={action}
              index={index}
              onUpdate={(updates) => updateAction(index, updates)}
              onRemove={() => removeAction(index)}
              isEditing={editingIndex === index}
              onToggleEdit={() => setEditingIndex(editingIndex === index ? null : index)}
            />
          ))
        )}
      </div>

      {/* Add Action Dropdown */}
      <div className="relative">
        <button
          onClick={() => {
            const menu = document.getElementById("action-type-menu");
            if (menu) {
              menu.classList.toggle("hidden");
            }
          }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          <Plus className="w-4 h-4" />
          Add Action
        </button>
        <div
          id="action-type-menu"
          className="hidden absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10"
        >
          <button
            onClick={() => {
              addAction("send_email");
              document.getElementById("action-type-menu")?.classList.add("hidden");
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Send Email
          </button>
          <button
            onClick={() => {
              addAction("send_webhook");
              document.getElementById("action-type-menu")?.classList.add("hidden");
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Send Webhook
          </button>
          <button
            onClick={() => {
              addAction("update_record");
              document.getElementById("action-type-menu")?.classList.add("hidden");
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Update Record
          </button>
          <button
            onClick={() => {
              addAction("create_record");
              document.getElementById("action-type-menu")?.classList.add("hidden");
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Create Record
          </button>
          <button
            onClick={() => {
              addAction("delete_record");
              document.getElementById("action-type-menu")?.classList.add("hidden");
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Delete Record
          </button>
          <button
            onClick={() => {
              addAction("set_field_value");
              document.getElementById("action-type-menu")?.classList.add("hidden");
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Set Field Value
          </button>
        </div>
      </div>
    </div>
  );
}

// Action Editor Component
function ActionEditor({
  action,
  index,
  onUpdate,
  onRemove,
  isEditing,
  onToggleEdit,
}: {
  action: AutomationAction;
  index: number;
  onUpdate: (updates: Partial<AutomationAction>) => void;
  onRemove: () => void;
  isEditing: boolean;
  onToggleEdit: () => void;
}) {
  const { tables } = useTables();
  const [selectedTableId, setSelectedTableId] = useState<string>(
    (action as any).table_id || ""
  );
  const { fields } = useFields(selectedTableId || "");

  const renderActionFields = () => {
    switch (action.type) {
      case "send_email":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                To (email addresses, comma-separated)
              </label>
              <input
                type="text"
                value={(action as any).to || ""}
                onChange={(e) => onUpdate({ to: e.target.value } as any)}
                placeholder="user@example.com, admin@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={(action as any).subject || ""}
                onChange={(e) => onUpdate({ subject: e.target.value } as any)}
                placeholder="Email subject (supports {{field_key}} variables)"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Body
              </label>
              <textarea
                value={(action as any).body || ""}
                onChange={(e) => onUpdate({ body: e.target.value } as any)}
                placeholder="Email body (supports {{field_key}} variables)"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                From (optional)
              </label>
              <input
                type="email"
                value={(action as any).from || ""}
                onChange={(e) => onUpdate({ from: e.target.value } as any)}
                placeholder="sender@example.com"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        );

      case "send_webhook":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                value={(action as any).url || ""}
                onChange={(e) => onUpdate({ url: e.target.value } as any)}
                placeholder="https://example.com/webhook"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                HTTP Method
              </label>
              <select
                value={(action as any).method || "POST"}
                onChange={(e) => onUpdate({ method: e.target.value } as any)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Body (JSON)
              </label>
              <textarea
                value={JSON.stringify((action as any).body || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    onUpdate({ body: parsed } as any);
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                placeholder='{"key": "value"}'
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm font-mono"
              />
            </div>
          </div>
        );

      case "update_record":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Table
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  const selectedTable = tables.find((t) => t.id === e.target.value);
                  setSelectedTableId(e.target.value);
                  onUpdate({
                    table_id: e.target.value,
                    table_name: selectedTable?.name || "",
                  } as any);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} ({table.name})
                  </option>
                ))}
              </select>
            </div>
            {selectedTableId && (
              <RecordFieldUpdater
                tableId={selectedTableId}
                fields={fields}
                fieldUpdates={(action as any).field_updates || {}}
                onUpdate={(updates) => onUpdate({ field_updates: updates } as any)}
              />
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Record ID (leave empty to use trigger context)
              </label>
              <input
                type="text"
                value={(action as any).record_id || ""}
                onChange={(e) => onUpdate({ record_id: e.target.value } as any)}
                placeholder="UUID or leave empty"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        );

      case "create_record":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Table
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  const selectedTable = tables.find((t) => t.id === e.target.value);
                  setSelectedTableId(e.target.value);
                  onUpdate({
                    table_id: e.target.value,
                    table_name: selectedTable?.name || "",
                  } as any);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} ({table.name})
                  </option>
                ))}
              </select>
            </div>
            {selectedTableId && (
              <RecordFieldCreator
                tableId={selectedTableId}
                fields={fields}
                fieldValues={(action as any).field_values || {}}
                onUpdate={(values) => onUpdate({ field_values: values } as any)}
              />
            )}
          </div>
        );

      case "delete_record":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Table
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  const selectedTable = tables.find((t) => t.id === e.target.value);
                  setSelectedTableId(e.target.value);
                  onUpdate({
                    table_id: e.target.value,
                    table_name: selectedTable?.name || "",
                  } as any);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.label} ({table.name})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Record ID (leave empty to use trigger context)
              </label>
              <input
                type="text"
                value={(action as any).record_id || ""}
                onChange={(e) => onUpdate({ record_id: e.target.value } as any)}
                placeholder="UUID or leave empty"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        );

      case "set_field_value":
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Field Key
              </label>
              <input
                type="text"
                value={(action as any).field_key || ""}
                onChange={(e) => onUpdate({ field_key: e.target.value } as any)}
                placeholder="field_key"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Value (supports {'{{field_key}}'} variables)
              </label>
              <input
                type="text"
                value={(action as any).value || ""}
                onChange={(e) => onUpdate({ value: e.target.value } as any)}
                placeholder="Value or {{field_key}}"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          </div>
        );

      default:
        return <div className="text-sm text-gray-500">Unknown action type</div>;
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {index + 1}. {action.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleEdit}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            {isEditing ? "Collapse" : "Edit"}
          </button>
          <button
            onClick={onRemove}
            className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      {isEditing && <div className="mt-3">{renderActionFields()}</div>}
    </div>
  );
}

// Helper component for updating record fields
function RecordFieldUpdater({
  tableId,
  fields,
  fieldUpdates,
  onUpdate,
}: {
  tableId: string;
  fields: any[];
  fieldUpdates: Record<string, any>;
  onUpdate: (updates: Record<string, any>) => void;
}) {
  const [selectedField, setSelectedField] = useState<string>("");
  const [fieldValue, setFieldValue] = useState<string>("");

  const addFieldUpdate = () => {
    if (selectedField && fieldValue !== undefined) {
      onUpdate({ ...fieldUpdates, [selectedField]: fieldValue });
      setSelectedField("");
      setFieldValue("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Field Updates
      </div>
      {Object.keys(fieldUpdates).length > 0 && (
        <div className="space-y-2">
          {Object.entries(fieldUpdates).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">
                {key}: {String(value)}
              </span>
              <button
                onClick={() => {
                  const newUpdates = { ...fieldUpdates };
                  delete newUpdates[key];
                  onUpdate(newUpdates);
                }}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        >
          <option value="">Select field...</option>
          {fields.map((field) => (
            <option key={field.id} value={field.field_key}>
              {field.label} ({field.field_key})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={fieldValue}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder="Value or {{field_key}}"
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addFieldUpdate();
            }
          }}
        />
        <button
          onClick={addFieldUpdate}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// Helper component for creating record fields
function RecordFieldCreator({
  tableId,
  fields,
  fieldValues,
  onUpdate,
}: {
  tableId: string;
  fields: any[];
  fieldValues: Record<string, any>;
  onUpdate: (values: Record<string, any>) => void;
}) {
  const [selectedField, setSelectedField] = useState<string>("");
  const [fieldValue, setFieldValue] = useState<string>("");

  const addFieldValue = () => {
    if (selectedField && fieldValue !== undefined) {
      onUpdate({ ...fieldValues, [selectedField]: fieldValue });
      setSelectedField("");
      setFieldValue("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
        Field Values
      </div>
      {Object.keys(fieldValues).length > 0 && (
        <div className="space-y-2">
          {Object.entries(fieldValues).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex-1">
                {key}: {String(value)}
              </span>
              <button
                onClick={() => {
                  const newValues = { ...fieldValues };
                  delete newValues[key];
                  onUpdate(newValues);
                }}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <select
          value={selectedField}
          onChange={(e) => setSelectedField(e.target.value)}
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        >
          <option value="">Select field...</option>
          {fields.map((field) => (
            <option key={field.id} value={field.field_key}>
              {field.label} ({field.field_key})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={fieldValue}
          onChange={(e) => setFieldValue(e.target.value)}
          placeholder="Value or {{field_key}}"
          className="flex-1 px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addFieldValue();
            }
          }}
        />
        <button
          onClick={addFieldValue}
          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Add
        </button>
      </div>
    </div>
  );
}
