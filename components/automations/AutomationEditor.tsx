"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Plus, Trash2 } from "lucide-react";
import { useAutomations } from "@/lib/hooks/useAutomations";
import { useTables } from "@/lib/hooks/useTables";
import { useFields } from "@/lib/useFields";
import Button from "@/components/ui/Button";
import { Filter, getOperatorsForFieldType, getOperatorLabel } from "@/lib/types/filters";
import { Condition } from "@/lib/automations/conditionEngine";

interface AutomationEditorProps {
  automation: any | null;
  open: boolean;
  onClose: () => void;
}

type TriggerType =
  | "schedule"
  | "record_created"
  | "record_updated"
  | "field_match"
  | "date_approaching"
  | "manual";

type ActionType =
  | "send_email"
  | "slack_message"
  | "webhook"
  | "update_record"
  | "create_record"
  | "duplicate_record"
  | "run_script";

export default function AutomationEditor({
  automation,
  open,
  onClose,
}: AutomationEditorProps) {
  const { createAutomation, updateAutomation } = useAutomations();
  const { tables } = useTables();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");
  const [triggerType, setTriggerType] = useState<TriggerType>("schedule");
  const [triggerConfig, setTriggerConfig] = useState<any>({});
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<any[]>([]);

  // Load automation data when editing
  useEffect(() => {
    if (automation) {
      setName(automation.name || "");
      setStatus(automation.status || "active");
      setTriggerType(automation.trigger?.type || "schedule");
      setTriggerConfig(automation.trigger || {});
      setConditions(automation.conditions || []);
      setActions(automation.actions || []);
      setStep(1);
    } else {
      // Reset for new automation
      setName("");
      setStatus("active");
      setTriggerType("schedule");
      setTriggerConfig({});
      setConditions([]);
      setActions([]);
      setStep(1);
    }
  }, [automation, open]);

  if (!open) return null;

  const handleSave = async () => {
    try {
      setSaving(true);

      const automationData = {
        name,
        status,
        trigger: {
          type: triggerType,
          ...triggerConfig,
        },
        conditions,
        actions,
      };

      if (automation) {
        await updateAutomation(automation.id, automationData);
      } else {
        await createAutomation(automationData);
      }

      onClose();
    } catch (error: any) {
      console.error("Error saving automation:", error);
      alert(`Failed to save automation: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAddCondition = () => {
    const newCondition: Condition = {
      field: "",
      operator: "equals",
      value: "",
    };
    setConditions([...conditions, newCondition]);
  };

  const handleUpdateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], ...updates };
    setConditions(newConditions);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleAddAction = () => {
    const newAction = {
      type: "send_email",
      to: "",
      subject: "",
      body: "",
    };
    setActions([...actions, newAction]);
  };

  const handleUpdateAction = (index: number, updates: any) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...updates };
    setActions(newActions);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[600px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-[9999] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {automation ? "Edit Automation" : "New Automation"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Indicator */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === s
                    ? "bg-blue-600 text-white"
                    : step > s
                    ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    : "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {s}
              </button>
              {s < 5 && (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Step 1: General */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                General Settings
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                  placeholder="Automation name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "paused")}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
            </div>
          )}

          {/* Step 2: Trigger */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Trigger
              </h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trigger Type
                </label>
                <select
                  value={triggerType}
                  onChange={(e) => {
                    setTriggerType(e.target.value as TriggerType);
                    setTriggerConfig({});
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                >
                  <option value="schedule">Schedule</option>
                  <option value="record_created">Record Created</option>
                  <option value="record_updated">Record Updated</option>
                  <option value="field_match">Field Match</option>
                  <option value="date_approaching">Date Approaching</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              {/* Trigger-specific fields */}
              {triggerType === "schedule" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Frequency
                    </label>
                    <select
                      value={triggerConfig.frequency || "daily"}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, frequency: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    >
                      <option value="minutely">Every Minute</option>
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  {(triggerConfig.frequency === "daily" ||
                    triggerConfig.frequency === "weekly" ||
                    triggerConfig.frequency === "monthly") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Time (HH:mm)
                      </label>
                      <input
                        type="time"
                        value={triggerConfig.time || "09:00"}
                        onChange={(e) =>
                          setTriggerConfig({ ...triggerConfig, time: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                      />
                    </div>
                  )}
                  {triggerConfig.frequency === "weekly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Day of Week
                      </label>
                      <select
                        value={triggerConfig.dayOfWeek || 0}
                        onChange={(e) =>
                          setTriggerConfig({
                            ...triggerConfig,
                            dayOfWeek: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                      >
                        <option value="0">Sunday</option>
                        <option value="1">Monday</option>
                        <option value="2">Tuesday</option>
                        <option value="3">Wednesday</option>
                        <option value="4">Thursday</option>
                        <option value="5">Friday</option>
                        <option value="6">Saturday</option>
                      </select>
                    </div>
                  )}
                  {triggerConfig.frequency === "monthly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Day of Month (1-31)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={triggerConfig.dayOfMonth || 1}
                        onChange={(e) =>
                          setTriggerConfig({
                            ...triggerConfig,
                            dayOfMonth: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                      />
                    </div>
                  )}
                  {triggerConfig.frequency === "hourly" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Minute (0-59)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="59"
                        value={triggerConfig.minute || 0}
                        onChange={(e) =>
                          setTriggerConfig({
                            ...triggerConfig,
                            minute: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                      />
                    </div>
                  )}
                </div>
              )}

              {(triggerType === "record_created" ||
                triggerType === "record_updated") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Table
                  </label>
                  <select
                    value={triggerConfig.table || ""}
                    onChange={(e) =>
                      setTriggerConfig({ ...triggerConfig, table: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="">Select table...</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {triggerType === "field_match" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Table
                    </label>
                    <select
                      value={triggerConfig.table || ""}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, table: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    >
                      <option value="">Select table...</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {triggerConfig.table && (
                    <FieldMatchTriggerConfig
                      tableId={triggerConfig.table}
                      config={triggerConfig}
                      onChange={setTriggerConfig}
                    />
                  )}
                </div>
              )}

              {triggerType === "date_approaching" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Table
                    </label>
                    <select
                      value={triggerConfig.table || ""}
                      onChange={(e) =>
                        setTriggerConfig({ ...triggerConfig, table: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    >
                      <option value="">Select table...</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {triggerConfig.table && (
                    <DateApproachingTriggerConfig
                      tableId={triggerConfig.table}
                      config={triggerConfig}
                      onChange={setTriggerConfig}
                    />
                  )}
                </div>
              )}

              {triggerType === "manual" && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This automation can only be triggered manually from the automations page.
                </p>
              )}
            </div>
          )}

          {/* Step 3: Conditions */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Conditions
                </h3>
                <Button
                  variant="outline"
                  onClick={handleAddCondition}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Condition
                </Button>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                All conditions must be met (AND logic) for the automation to run.
              </p>

              {conditions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No conditions. Automation will run whenever the trigger fires.
                </div>
              ) : (
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <ConditionEditor
                      key={index}
                      condition={condition}
                      tableId={triggerConfig.table}
                      onChange={(updates) => handleUpdateCondition(index, updates)}
                      onRemove={() => handleRemoveCondition(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Actions */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Actions
                </h3>
                <Button
                  variant="outline"
                  onClick={handleAddAction}
                  className="flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Action
                </Button>
              </div>

              {actions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No actions. Add at least one action to execute.
                </div>
              ) : (
                <div className="space-y-4">
                  {actions.map((action, index) => (
                    <ActionEditor
                      key={index}
                      action={action}
                      tables={tables}
                      onChange={(updates) => handleUpdateAction(index, updates)}
                      onRemove={() => handleRemoveAction(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 5: Summary */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Summary
              </h3>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                <div>
                  <strong>Name:</strong> {name}
                </div>
                <div>
                  <strong>Status:</strong> {status}
                </div>
                <div>
                  <strong>Trigger:</strong> {triggerType}
                </div>
                <div>
                  <strong>Conditions:</strong> {conditions.length}
                </div>
                <div>
                  <strong>Actions:</strong> {actions.length}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  JSON Preview
                </label>
                <pre className="w-full p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-xs overflow-auto max-h-64">
                  {JSON.stringify(
                    {
                      name,
                      status,
                      trigger: { type: triggerType, ...triggerConfig },
                      conditions,
                      actions,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex gap-2">
            {step > 1 && (
              <Button
                variant="outline"
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {step < 5 ? (
              <Button
                onClick={() => setStep(step + 1)}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving || !name}
                className="flex items-center gap-2"
              >
                {saving ? "Saving..." : automation ? "Update" : "Create"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// Helper component for field match trigger
function FieldMatchTriggerConfig({
  tableId,
  config,
  onChange,
}: {
  tableId: string;
  config: any;
  onChange: (config: any) => void;
}) {
  const { fields } = useFields(tableId);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Field
        </label>
        <select
          value={config.field || ""}
          onChange={(e) => onChange({ ...config, field: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        >
          <option value="">Select field...</option>
          {fields
            .filter((f) => f.type !== "linked_record")
            .map((field) => (
              <option key={field.id} value={field.field_key}>
                {field.label}
              </option>
            ))}
        </select>
      </div>
      {config.field && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Operator
            </label>
            <select
              value={config.operator || "equals"}
              onChange={(e) => onChange({ ...config, operator: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="equals">Equals</option>
              <option value="not_equals">Not Equals</option>
              <option value="contains">Contains</option>
              <option value=">">Greater Than</option>
              <option value="<">Less Than</option>
              <option value=">=">Greater Than or Equal</option>
              <option value="<=">Less Than or Equal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Value
            </label>
            <input
              type="text"
              value={config.value || ""}
              onChange={(e) => onChange({ ...config, value: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="Value to match"
            />
          </div>
        </>
      )}
    </div>
  );
}

// Helper component for date approaching trigger
function DateApproachingTriggerConfig({
  tableId,
  config,
  onChange,
}: {
  tableId: string;
  config: any;
  onChange: (config: any) => void;
}) {
  const { fields } = useFields(tableId);
  const dateFields = fields.filter(
    (f) => f.type === "date"
  );

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Date Field
        </label>
        <select
          value={config.dateField || ""}
          onChange={(e) => onChange({ ...config, dateField: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
        >
          <option value="">Select date field...</option>
          {dateFields.map((field) => (
            <option key={field.id} value={field.field_key}>
              {field.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Days Before
        </label>
        <input
          type="number"
          min="0"
          value={config.daysBefore || 0}
          onChange={(e) =>
            onChange({ ...config, daysBefore: parseInt(e.target.value) || 0 })
          }
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          placeholder="0"
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Trigger X days before the date
        </p>
      </div>
    </div>
  );
}

// Helper component for condition editor
function ConditionEditor({
  condition,
  tableId,
  onChange,
  onRemove,
}: {
  condition: Condition;
  tableId?: string;
  onChange: (updates: Partial<Condition>) => void;
  onRemove: () => void;
}) {
  const { fields } = useFields(tableId || "");
  const field = fields.find((f) => f.field_key === condition.field);

  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <select
            value={condition.field}
            onChange={(e) => onChange({ field: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
          >
            <option value="">Select field...</option>
            {fields
              .filter((f) => f.type !== "linked_record")
              .map((f) => (
                <option key={f.id} value={f.field_key}>
                  {f.label}
                </option>
              ))}
          </select>
          {condition.field && (
            <>
              <select
                value={condition.operator}
                onChange={(e) => onChange({ operator: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
              >
                <option value="equals">Equals</option>
                <option value="not_equals">Not Equals</option>
                <option value="contains">Contains</option>
                <option value=">">Greater Than</option>
                <option value="<">Less Than</option>
                <option value=">=">Greater Than or Equal</option>
                <option value="<=">Less Than or Equal</option>
                <option value="between">Between</option>
                <option value="changed_from">Changed From</option>
                <option value="changed_to">Changed To</option>
              </select>
              {!["is_empty", "is_not_empty"].includes(condition.operator) && (
                <input
                  type="text"
                  value={condition.value || ""}
                  onChange={(e) => onChange({ value: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                  placeholder="Value"
                />
              )}
            </>
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// Helper component for action editor
function ActionEditor({
  action,
  tables,
  onChange,
  onRemove,
}: {
  action: any;
  tables: any[];
  onChange: (updates: any) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-gray-300 dark:border-gray-700 rounded-md p-3 bg-gray-50 dark:bg-gray-800">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-2">
          <select
            value={action.type || "send_email"}
            onChange={(e) => onChange({ type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
          >
            <option value="send_email">Send Email</option>
            <option value="slack_message">Slack Message</option>
            <option value="webhook">Webhook</option>
            <option value="update_record">Update Record</option>
            <option value="create_record">Create Record</option>
            <option value="duplicate_record">Duplicate Record</option>
            <option value="run_script">Run Script</option>
          </select>

          {/* Action-specific fields */}
          {action.type === "send_email" && (
            <>
              <input
                type="email"
                value={action.to || ""}
                onChange={(e) => onChange({ to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                placeholder="To email"
              />
              <input
                type="text"
                value={action.subject || ""}
                onChange={(e) => onChange({ subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                placeholder="Subject"
              />
              <textarea
                value={action.body || ""}
                onChange={(e) => onChange({ body: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                placeholder="Email body (use {{field}} for variables)"
                rows={4}
              />
            </>
          )}

          {action.type === "slack_message" && (
            <>
              <input
                type="url"
                value={action.webhook_url || ""}
                onChange={(e) => onChange({ webhook_url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                placeholder="Slack Webhook URL"
              />
              <textarea
                value={action.message || ""}
                onChange={(e) => onChange({ message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                placeholder="Message"
                rows={3}
              />
            </>
          )}

          {action.type === "webhook" && (
            <>
              <input
                type="url"
                value={action.url || ""}
                onChange={(e) => onChange({ url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                placeholder="Webhook URL"
              />
              <select
                value={action.method || "POST"}
                onChange={(e) => onChange({ method: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
              <textarea
                value={JSON.stringify(action.body || {}, null, 2)}
                onChange={(e) => {
                  try {
                    onChange({ body: JSON.parse(e.target.value) });
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm font-mono"
                placeholder='{"key": "value"}'
                rows={4}
              />
            </>
          )}

          {(action.type === "update_record" ||
            action.type === "create_record" ||
            action.type === "duplicate_record") && (
            <>
              <select
                value={action.table || ""}
                onChange={(e) => onChange({ table: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
              >
                <option value="">Select table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
              {action.type === "update_record" && (
                <input
                  type="text"
                  value={action.recordId || ""}
                  onChange={(e) => onChange({ recordId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                  placeholder="Record ID"
                />
              )}
              {action.type === "duplicate_record" && (
                <input
                  type="text"
                  value={action.recordId || ""}
                  onChange={(e) => onChange({ recordId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm"
                  placeholder="Record ID to duplicate"
                />
              )}
              <textarea
                value={JSON.stringify(action.updates || action.data || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    if (action.type === "update_record") {
                      onChange({ updates: parsed });
                    } else {
                      onChange({ data: parsed });
                    }
                  } catch {
                    // Invalid JSON, ignore
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm font-mono"
                placeholder='{"field": "value"}'
                rows={4}
              />
            </>
          )}

          {action.type === "run_script" && (
            <textarea
              value={action.script || ""}
              onChange={(e) => onChange({ script: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-sm font-mono"
              placeholder="JavaScript code"
              rows={8}
            />
          )}
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

