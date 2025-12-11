"use client";

import { useState, useEffect } from "react";
import { useTables } from "@/lib/hooks/useTables";
import { useFields } from "@/lib/useFields";
import { AutomationTrigger } from "@/lib/automations/schema";

interface TriggerBuilderProps {
  trigger: AutomationTrigger | null;
  onChange: (trigger: AutomationTrigger) => void;
}

export default function TriggerBuilder({ trigger, onChange }: TriggerBuilderProps) {
  const { tables } = useTables();
  const [triggerType, setTriggerType] = useState<string>(trigger?.type || "schedule");
  const [config, setConfig] = useState<any>(trigger || {});

  useEffect(() => {
    if (trigger) {
      setTriggerType(trigger.type);
      setConfig(trigger);
    }
  }, [trigger]);

  const handleTypeChange = (type: string) => {
    setTriggerType(type);
    const newTrigger: any = { type };
    
    // Set defaults based on type
    switch (type) {
      case "schedule":
        newTrigger.schedule = { frequency: "daily", time: "09:00" };
        break;
      case "record_created":
      case "record_updated":
        newTrigger.table_id = "";
        newTrigger.table_name = "";
        break;
      case "field_match":
        newTrigger.table_id = "";
        newTrigger.table_name = "";
        newTrigger.field_key = "";
        newTrigger.operator = "equals";
        newTrigger.value = "";
        break;
      case "date_approaching":
        newTrigger.table_id = "";
        newTrigger.table_name = "";
        newTrigger.date_field_key = "";
        newTrigger.days_before = 7;
        break;
      case "manual":
        // No additional config needed
        break;
    }
    
    setConfig(newTrigger);
    onChange(newTrigger as AutomationTrigger);
  };

  const updateConfig = (updates: any) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange(newConfig as AutomationTrigger);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Trigger Type
        </label>
        <select
          value={triggerType}
          onChange={(e) => handleTypeChange(e.target.value)}
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

      {/* Schedule Trigger */}
      {triggerType === "schedule" && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Frequency
            </label>
            <select
              value={config.schedule?.frequency || "daily"}
              onChange={(e) => updateConfig({ schedule: { ...config.schedule, frequency: e.target.value } })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {(config.schedule?.frequency === "daily" || config.schedule?.frequency === "weekly" || config.schedule?.frequency === "monthly") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Time (HH:mm)
              </label>
              <input
                type="time"
                value={config.schedule?.time || "09:00"}
                onChange={(e) => updateConfig({ schedule: { ...config.schedule, time: e.target.value } })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
          )}
          {config.schedule?.frequency === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Day of Week
              </label>
              <select
                value={config.schedule?.dayOfWeek ?? 0}
                onChange={(e) => updateConfig({ schedule: { ...config.schedule, dayOfWeek: parseInt(e.target.value) } })}
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
          {config.schedule?.frequency === "monthly" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Day of Month (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={config.schedule?.dayOfMonth ?? 1}
                onChange={(e) => updateConfig({ schedule: { ...config.schedule, dayOfMonth: parseInt(e.target.value) } })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
          )}
        </div>
      )}

      {/* Record Created/Updated Triggers */}
      {(triggerType === "record_created" || triggerType === "record_updated") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Table
          </label>
          <select
            value={config.table_id || ""}
            onChange={(e) => {
              const selectedTable = tables.find((t) => t.id === e.target.value);
              updateConfig({
                table_id: e.target.value,
                table_name: selectedTable?.name || "",
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          >
            <option value="">Select a table...</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.label} ({table.name})
              </option>
            ))}
          </select>
          {triggerType === "record_updated" && (
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Watch Fields (optional, leave empty to watch all fields)
              </label>
              <input
                type="text"
                value={Array.isArray(config.fields) ? config.fields.join(", ") : ""}
                onChange={(e) => {
                  const fields = e.target.value.split(",").map((f) => f.trim()).filter(Boolean);
                  updateConfig({ fields: fields.length > 0 ? fields : undefined });
                }}
                placeholder="field1, field2, field3"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              />
            </div>
          )}
        </div>
      )}

      {/* Field Match Trigger */}
      {triggerType === "field_match" && (
        <FieldMatchTriggerConfig
          tableId={config.table_id}
          config={config}
          onChange={updateConfig}
        />
      )}

      {/* Date Approaching Trigger */}
      {triggerType === "date_approaching" && (
        <DateApproachingTriggerConfig
          tableId={config.table_id}
          config={config}
          onChange={updateConfig}
        />
      )}

      {/* Manual Trigger */}
      {triggerType === "manual" && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          This automation can only be triggered manually from the automations page.
        </p>
      )}
    </div>
  );
}

// Helper component for field match trigger
function FieldMatchTriggerConfig({
  tableId,
  config,
  onChange,
}: {
  tableId?: string;
  config: any;
  onChange: (updates: any) => void;
}) {
  const { tables } = useTables();
  const { fields } = useFields(tableId || "");
  const [selectedField, setSelectedField] = useState<string>(config.field_key || "");

  useEffect(() => {
    if (config.field_key) {
      setSelectedField(config.field_key);
    }
  }, [config.field_key]);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Table
        </label>
        <select
          value={tableId || ""}
          onChange={(e) => {
            const selectedTable = tables.find((t) => t.id === e.target.value);
            onChange({
              table_id: e.target.value,
              table_name: selectedTable?.name || "",
            });
          }}
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
      {tableId && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Field
            </label>
            <select
              value={selectedField}
              onChange={(e) => {
                setSelectedField(e.target.value);
                onChange({ field_key: e.target.value });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select field...</option>
              {fields.map((field) => (
                <option key={field.id} value={field.field_key}>
                  {field.label} ({field.field_key})
                </option>
              ))}
            </select>
          </div>
          {selectedField && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Operator
                </label>
                <select
                  value={config.operator || "equals"}
                  onChange={(e) => onChange({ operator: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                >
                  <option value="equals">Equals</option>
                  <option value="not_equals">Not Equals</option>
                  <option value="contains">Contains</option>
                  <option value="greater_than">Greater Than</option>
                  <option value="less_than">Less Than</option>
                  <option value="is_empty">Is Empty</option>
                  <option value="is_not_empty">Is Not Empty</option>
                </select>
              </div>
              {!["is_empty", "is_not_empty"].includes(config.operator || "equals") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    value={config.value || ""}
                    onChange={(e) => onChange({ value: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    placeholder="Value to match"
                  />
                </div>
              )}
            </>
          )}
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
  tableId?: string;
  config: any;
  onChange: (updates: any) => void;
}) {
  const { tables } = useTables();
  const { fields } = useFields(tableId || "");
  const dateFields = fields.filter((f) => f.type === "date");

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Table
        </label>
        <select
          value={tableId || ""}
          onChange={(e) => {
            const selectedTable = tables.find((t) => t.id === e.target.value);
            onChange({
              table_id: e.target.value,
              table_name: selectedTable?.name || "",
            });
          }}
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
      {tableId && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date Field
            </label>
            <select
              value={config.date_field_key || ""}
              onChange={(e) => onChange({ date_field_key: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">Select date field...</option>
              {dateFields.map((field) => (
                <option key={field.id} value={field.field_key}>
                  {field.label} ({field.field_key})
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
              value={config.days_before ?? 7}
              onChange={(e) => onChange({ days_before: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              placeholder="7"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Trigger will fire this many days before the date field value
            </p>
          </div>
        </>
      )}
    </div>
  );
}
