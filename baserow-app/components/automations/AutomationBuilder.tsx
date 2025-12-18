"use client"

import { useState, useEffect } from "react"
import { Save, Play, Trash2, Plus, X, GripVertical, AlertCircle } from "lucide-react"
import type { Automation, TableField } from "@/types/database"
import type { TriggerType, ActionType, ActionConfig, TriggerConfig } from "@/lib/automations/types"
import FormulaEditor from "@/components/fields/FormulaEditor"

interface AutomationBuilderProps {
  automation?: Automation | null
  tableId: string
  tableFields: TableField[]
  onSave: (automation: Partial<Automation>) => Promise<void>
  onTest?: () => Promise<void>
  onDelete?: () => Promise<void>
}

const TRIGGER_TYPES: { value: TriggerType; label: string }[] = [
  { value: 'row_created', label: 'When a record is created' },
  { value: 'row_updated', label: 'When a record is updated' },
  { value: 'row_deleted', label: 'When a record is deleted' },
  { value: 'schedule', label: 'On a schedule' },
  { value: 'webhook', label: 'When webhook is called' },
  { value: 'condition', label: 'When conditions match' },
]

const ACTION_TYPES: { value: ActionType; label: string }[] = [
  { value: 'update_record', label: 'Update record' },
  { value: 'create_record', label: 'Create record' },
  { value: 'delete_record', label: 'Delete record' },
  { value: 'send_email', label: 'Send email' },
  { value: 'call_webhook', label: 'Call webhook' },
  { value: 'run_script', label: 'Run script' },
  { value: 'delay', label: 'Delay' },
  { value: 'log_message', label: 'Log message' },
  { value: 'stop_execution', label: 'Stop execution' },
]

export default function AutomationBuilder({
  automation,
  tableId,
  tableFields,
  onSave,
  onTest,
  onDelete,
}: AutomationBuilderProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [triggerType, setTriggerType] = useState<TriggerType>("row_created")
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>({})
  const [actions, setActions] = useState<ActionConfig[]>([])
  const [enabled, setEnabled] = useState(true)
  const [condition, setCondition] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null)

  useEffect(() => {
    if (automation) {
      setName(automation.name || "")
      setDescription(automation.description || "")
      setTriggerType((automation.trigger_type as TriggerType) || "row_created")
      setTriggerConfig(automation.trigger_config || {})
      setActions((automation.actions as ActionConfig[]) || [])
      setEnabled(automation.enabled ?? true)
      setCondition(automation.conditions?.[0]?.formula || "")
    }
  }, [automation])

  async function handleSave() {
    if (!name.trim()) {
      setError("Automation name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        actions,
        enabled,
        conditions: condition ? [{ formula: condition }] : undefined,
      })
    } catch (err: any) {
      setError(err.message || "Failed to save automation")
    } finally {
      setLoading(false)
    }
  }

  function addAction() {
    const newAction: ActionConfig = {
      type: 'log_message',
      message: 'Action executed',
    }
    setActions([...actions, newAction])
    setEditingActionIndex(actions.length)
  }

  function updateAction(index: number, updates: Partial<ActionConfig>) {
    const newActions = [...actions]
    newActions[index] = { ...newActions[index], ...updates }
    setActions(newActions)
  }

  function deleteAction(index: number) {
    setActions(actions.filter((_, i) => i !== index))
    if (editingActionIndex === index) {
      setEditingActionIndex(null)
    }
  }

  function renderTriggerConfig() {
    switch (triggerType) {
      case 'row_updated':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Watch Fields (optional)</label>
            <p className="text-xs text-gray-500">
              Only trigger when these fields change. Leave empty to trigger on any change.
            </p>
            <div className="space-y-2">
              {(triggerConfig.watch_fields || []).map((field, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    value={field}
                    onChange={(e) => {
                      const fields = [...(triggerConfig.watch_fields || [])]
                      fields[index] = e.target.value
                      setTriggerConfig({ ...triggerConfig, watch_fields: fields })
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    <option value="">Select field...</option>
                    {tableFields.map(f => (
                      <option key={f.id} value={f.name}>{f.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      const fields = (triggerConfig.watch_fields || []).filter((_, i) => i !== index)
                      setTriggerConfig({ ...triggerConfig, watch_fields: fields })
                    }}
                    className="px-2 text-red-600 hover:bg-red-50 rounded"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  setTriggerConfig({
                    ...triggerConfig,
                    watch_fields: [...(triggerConfig.watch_fields || []), ""],
                  })
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add field
              </button>
            </div>
          </div>
        )

      case 'schedule':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Interval</label>
              <select
                value={triggerConfig.interval || 'day'}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, interval: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="minute">Every minute(s)</option>
                <option value="hour">Every hour(s)</option>
                <option value="day">Every day</option>
                <option value="week">Every week</option>
                <option value="month">Every month</option>
              </select>
            </div>

            {triggerConfig.interval && ['minute', 'hour'].includes(triggerConfig.interval) && (
              <div>
                <label className="block text-sm font-medium mb-1">Interval Value</label>
                <input
                  type="number"
                  min="1"
                  value={triggerConfig.interval_value || 1}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, interval_value: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}

            {triggerConfig.interval === 'day' && (
              <div>
                <label className="block text-sm font-medium mb-1">Time (HH:MM)</label>
                <input
                  type="time"
                  value={triggerConfig.time || '00:00'}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}

            {triggerConfig.interval === 'week' && (
              <div>
                <label className="block text-sm font-medium mb-1">Day of Week</label>
                <select
                  value={triggerConfig.day_of_week || 0}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, day_of_week: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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

            {triggerConfig.interval === 'month' && (
              <div>
                <label className="block text-sm font-medium mb-1">Day of Month</label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={triggerConfig.day_of_month || 1}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, day_of_month: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </div>
        )

      case 'webhook':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Webhook ID</label>
            <input
              type="text"
              value={triggerConfig.webhook_id || ''}
              onChange={(e) => setTriggerConfig({ ...triggerConfig, webhook_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="Generate or enter webhook ID"
            />
            <p className="text-xs text-gray-500">
              Webhook URL: /api/hooks/{triggerConfig.webhook_id || '[id]'}
            </p>
            {!triggerConfig.webhook_id && (
              <button
                onClick={() => {
                  const id = `wh_${Date.now()}`
                  setTriggerConfig({ ...triggerConfig, webhook_id: id })
                }}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Generate Webhook ID
              </button>
            )}
          </div>
        )

      case 'condition':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Condition Formula</label>
            <FormulaEditor
              value={triggerConfig.formula || ''}
              onChange={(formula) => setTriggerConfig({ ...triggerConfig, formula })}
              tableFields={tableFields}
            />
            <div>
              <label className="block text-sm font-medium mb-1">Check Interval (seconds)</label>
              <input
                type="number"
                min="1"
                value={triggerConfig.check_interval || 60}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, check_interval: parseInt(e.target.value) || 60 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  function renderActionEditor(action: ActionConfig, index: number) {
    if (editingActionIndex !== index) {
      return (
        <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-md">
          <GripVertical className="h-4 w-4 text-gray-400" />
          <div className="flex-1">
            <div className="font-medium text-sm">{ACTION_TYPES.find(a => a.value === action.type)?.label}</div>
            <div className="text-xs text-gray-500">{action.type}</div>
          </div>
          <button
            onClick={() => setEditingActionIndex(index)}
            className="px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
          >
            Edit
          </button>
          <button
            onClick={() => deleteAction(index)}
            className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }

    return (
      <div className="p-4 border border-blue-300 rounded-md bg-blue-50">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium">Edit Action</h4>
          <button
            onClick={() => setEditingActionIndex(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Action Type</label>
            <select
              value={action.type}
              onChange={(e) => updateAction(index, { type: e.target.value as ActionType })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {ACTION_TYPES.map(at => (
                <option key={at.value} value={at.value}>{at.label}</option>
              ))}
            </select>
          </div>

          {renderActionConfig(action, index)}
        </div>
      </div>
    )
  }

  function renderActionConfig(action: ActionConfig, index: number) {
    switch (action.type) {
      case 'update_record':
      case 'create_record':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Table ID</label>
              <input
                type="text"
                value={action.table_id || tableId}
                onChange={(e) => updateAction(index, { table_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Table ID"
              />
            </div>
            {action.type === 'update_record' && (
              <div>
                <label className="block text-sm font-medium mb-1">Record ID</label>
                <input
                  type="text"
                  value={action.record_id || ''}
                  onChange={(e) => updateAction(index, { record_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="{{record_id}} or specific ID"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Field Updates (JSON)</label>
              <textarea
                value={JSON.stringify(action.field_updates || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const updates = JSON.parse(e.target.value)
                    updateAction(index, { field_updates: updates })
                  } catch {}
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                rows={4}
                placeholder='{"field_name": "value", "another_field": "{{field_from_trigger}}"}'
              />
            </div>
          </>
        )

      case 'delete_record':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Table ID</label>
              <input
                type="text"
                value={action.table_id || tableId}
                onChange={(e) => updateAction(index, { table_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Record ID</label>
              <input
                type="text"
                value={action.record_id || ''}
                onChange={(e) => updateAction(index, { record_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="{{record_id}}"
              />
            </div>
          </>
        )

      case 'send_email':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">To</label>
              <input
                type="email"
                value={action.to || ''}
                onChange={(e) => updateAction(index, { to: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="email@example.com or {{field}}"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <input
                type="text"
                value={action.subject || ''}
                onChange={(e) => updateAction(index, { subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Email subject"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Body</label>
              <textarea
                value={action.body || ''}
                onChange={(e) => updateAction(index, { body: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                rows={4}
                placeholder="Email body (supports {{variables}})"
              />
            </div>
          </>
        )

      case 'call_webhook':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url"
                value={action.url || ''}
                onChange={(e) => updateAction(index, { url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="https://example.com/webhook"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Method</label>
              <select
                value={action.method || 'POST'}
                onChange={(e) => updateAction(index, { method: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Body (JSON)</label>
              <textarea
                value={JSON.stringify(action.body || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const body = JSON.parse(e.target.value)
                    updateAction(index, { body })
                  } catch {}
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                rows={4}
                placeholder='{"key": "value", "field": "{{field_name}}"}'
              />
            </div>
          </>
        )

      case 'delay':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Delay Type</label>
              <select
                value={action.delay_type || 'seconds'}
                onChange={(e) => updateAction(index, { delay_type: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
                <option value="hours">Hours</option>
                <option value="until">Until Date/Time</option>
              </select>
            </div>
            {action.delay_type !== 'until' && (
              <div>
                <label className="block text-sm font-medium mb-1">Delay Value</label>
                <input
                  type="number"
                  min="0"
                  value={action.delay_value || 0}
                  onChange={(e) => updateAction(index, { delay_value: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
            {action.delay_type === 'until' && (
              <div>
                <label className="block text-sm font-medium mb-1">Until Date/Time</label>
                <input
                  type="datetime-local"
                  value={action.until_datetime || ''}
                  onChange={(e) => updateAction(index, { until_datetime: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </>
        )

      case 'log_message':
        return (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Message</label>
              <input
                type="text"
                value={action.message || ''}
                onChange={(e) => updateAction(index, { message: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                placeholder="Log message (supports {{variables}})"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Level</label>
              <select
                value={action.level || 'info'}
                onChange={(e) => updateAction(index, { level: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </>
        )

      case 'run_script':
        return (
          <div>
            <label className="block text-sm font-medium mb-1">Script</label>
            <textarea
              value={action.script || ''}
              onChange={(e) => updateAction(index, { script: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              rows={6}
              placeholder="JavaScript code (sandboxed)"
            />
            <p className="text-xs text-gray-500 mt-1">
              Limited sandbox - only basic operations allowed
            </p>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Automation Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter automation name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Optional description"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="enabled" className="text-sm">
            Enabled
          </label>
        </div>
      </div>

      {/* Trigger */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Trigger</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Trigger Type</label>
          <select
            value={triggerType}
            onChange={(e) => {
              setTriggerType(e.target.value as TriggerType)
              setTriggerConfig({ table_id: tableId })
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TRIGGER_TYPES.map(tt => (
              <option key={tt.value} value={tt.value}>{tt.label}</option>
            ))}
          </select>
        </div>

        {renderTriggerConfig()}
      </div>

      {/* Conditions */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Conditions (Optional)</h3>
        <p className="text-sm text-gray-500">
          Only run automation if this formula evaluates to true
        </p>
        <FormulaEditor
          value={condition}
          onChange={setCondition}
          tableFields={tableFields}
        />
      </div>

      {/* Actions */}
      <div className="space-y-4 border-t pt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Actions</h3>
          <button
            onClick={addAction}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Action
          </button>
        </div>

        <div className="space-y-2">
          {actions.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No actions yet. Click &quot;Add Action&quot; to get started.
            </div>
          ) : (
            actions.map((action, index) => (
              <div key={index}>
                {renderActionEditor(action, index)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t pt-4 flex items-center justify-between gap-2">
        {onDelete && (
          <button
            onClick={onDelete}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        )}
        <div className="flex gap-2 ml-auto">
          {onTest && (
            <button
              onClick={onTest}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Test Run
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Automation"}
          </button>
        </div>
      </div>
    </div>
  )
}
