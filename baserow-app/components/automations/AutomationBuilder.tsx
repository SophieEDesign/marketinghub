"use client"

import { useState, useEffect, useMemo } from "react"
import { Save, Play, Trash2, Plus, X, GripVertical, AlertCircle, Sparkles, RefreshCw, Trash, Clock, Webhook, Filter, Edit, FilePlus, Mail, Code, Timer, MessageSquare, Square, Layout, List, Variable, Eye } from "lucide-react"
import type { Automation, TableField } from "@/types/database"
import type { TriggerType, ActionType, ActionConfig, TriggerConfig } from "@/lib/automations/types"
import AutomationConditionBuilder from "./AutomationConditionBuilder"
import VisualWorkflowBuilder from "./VisualWorkflowBuilder"
import VariablePicker from "./VariablePicker"
import ScheduleBuilder from "./ScheduleBuilder"
import AutomationTestMode from "./AutomationTestMode"
import WebhookManager from "./WebhookManager"
import type { FilterTree } from "@/lib/filters/canonical-model"
import { filterTreeToFormula } from "@/lib/automations/condition-formula"
import FormulaEditor from "@/components/fields/FormulaEditor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AutomationBuilderProps {
  automation?: Automation | null
  tableId: string
  tableFields: TableField[]
  onSave: (automation: Partial<Automation>) => Promise<void>
  onTest?: () => Promise<void>
  onDelete?: () => Promise<void>
}

const TRIGGER_TYPES: { 
  value: TriggerType
  label: string
  icon: typeof Sparkles
  description: string
  category: string
}[] = [
  { 
    value: 'row_created', 
    label: 'When a record is created',
    icon: Sparkles,
    description: 'Runs automatically whenever a new record is added to this table',
    category: 'Record Events'
  },
  { 
    value: 'row_updated', 
    label: 'When a record is updated',
    icon: RefreshCw,
    description: 'Runs when any field in a record changes, or only when specific fields change',
    category: 'Record Events'
  },
  { 
    value: 'row_deleted', 
    label: 'When a record is deleted',
    icon: Trash,
    description: 'Runs automatically when a record is removed from this table',
    category: 'Record Events'
  },
  { 
    value: 'schedule', 
    label: 'On a schedule',
    icon: Clock,
    description: 'Runs at specific times, like daily at 9 AM or every Monday',
    category: 'Time-based'
  },
  { 
    value: 'webhook', 
    label: 'When webhook is called',
    icon: Webhook,
    description: 'Runs when an external system sends data to your webhook URL',
    category: 'External Events'
  },
  { 
    value: 'condition', 
    label: 'When conditions match',
    icon: Filter,
    description: 'Continuously checks if records match certain criteria',
    category: 'Conditional'
  },
]

const ACTION_TYPES: { 
  value: ActionType
  label: string
  icon: typeof Edit
  description: string
  category: string
}[] = [
  { 
    value: 'update_record', 
    label: 'Update a record',
    icon: Edit,
    description: 'Modify fields in an existing record',
    category: 'Data Operations'
  },
  { 
    value: 'create_record', 
    label: 'Create a record',
    icon: FilePlus,
    description: 'Add a new record to a table',
    category: 'Data Operations'
  },
  { 
    value: 'delete_record', 
    label: 'Delete a record',
    icon: Trash,
    description: 'Remove a record from a table',
    category: 'Data Operations'
  },
  { 
    value: 'send_email', 
    label: 'Send an email',
    icon: Mail,
    description: 'Send an email notification with dynamic content',
    category: 'Notifications'
  },
  { 
    value: 'call_webhook', 
    label: 'Call a webhook',
    icon: Webhook,
    description: 'Send data to an external URL or service',
    category: 'Integrations'
  },
  { 
    value: 'run_script', 
    label: 'Run a script',
    icon: Code,
    description: 'Execute custom JavaScript code (advanced)',
    category: 'Advanced'
  },
  { 
    value: 'delay', 
    label: 'Wait',
    icon: Timer,
    description: 'Pause execution for a specified amount of time',
    category: 'Flow Control'
  },
  { 
    value: 'log_message', 
    label: 'Log a message',
    icon: MessageSquare,
    description: 'Add a message to the automation execution log',
    category: 'Debugging'
  },
  { 
    value: 'stop_execution', 
    label: 'Stop execution',
    icon: Square,
    description: 'Immediately stop the automation from continuing',
    category: 'Flow Control'
  },
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
  const [conditionFilterTree, setConditionFilterTree] = useState<FilterTree>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'form' | 'visual'>('visual')
  const [category, setCategory] = useState<string>("")
  const [tags, setTags] = useState<string[]>([])
  const [previewingAction, setPreviewingAction] = useState<number | null>(null)
  const [variablePickerOpen, setVariablePickerOpen] = useState<{ actionIndex: number; mappingIndex: number; inputRef: HTMLInputElement | null } | null>(null)
  const [showTestMode, setShowTestMode] = useState(false)

  useEffect(() => {
    if (automation) {
      setName(automation.name || "")
      setDescription(automation.description || "")
      setTriggerType((automation.trigger_type as TriggerType) || "row_created")
      setTriggerConfig(automation.trigger_config || {})
      setActions((automation.actions as ActionConfig[]) || [])
      setEnabled(automation.enabled ?? true)
      setCategory(automation.category || "")
      setTags(automation.tags || [])
      
      // Handle conditions: support both old formula format and new filter JSON format
      const conditions = automation.conditions?.[0]
      if (conditions) {
        if (conditions.filter_tree) {
          // New format: filter tree JSON
          setConditionFilterTree(conditions.filter_tree as FilterTree)
        } else if (conditions.formula) {
          // Old format: formula string - convert to empty filter tree
          // (We can't parse formulas back to filter tree easily, so start fresh)
          // Users can rebuild conditions using the new UI
          setConditionFilterTree(null)
        } else {
          setConditionFilterTree(null)
        }
      } else {
        setConditionFilterTree(null)
      }
    }
  }, [automation])

  // Convert filter tree to formula for backward compatibility
  const conditionFormula = useMemo(() => {
    if (!conditionFilterTree) return ""
    return filterTreeToFormula(conditionFilterTree, tableFields)
  }, [conditionFilterTree, tableFields])

  async function handleSave() {
    if (!name.trim()) {
      setError("Automation name is required")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Save both filter_tree (new format) and formula (for backward compatibility)
      const conditions = conditionFilterTree ? [{
        filter_tree: conditionFilterTree,
        formula: conditionFormula, // Generated formula for backward compatibility
      }] : undefined

      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        actions,
        enabled,
        conditions,
        category: category || undefined,
        tags: tags.length > 0 ? tags : undefined,
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
          <ScheduleBuilder
            config={triggerConfig}
            onChange={(newConfig) => setTriggerConfig(newConfig)}
          />
        )

      case 'webhook':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Webhook ID</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={triggerConfig.webhook_id || ''}
                  onChange={(e) => setTriggerConfig({ ...triggerConfig, webhook_id: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder="Generate or enter webhook ID"
                />
                {!triggerConfig.webhook_id && (
                  <button
                    onClick={() => {
                      const id = `wh_${Date.now()}`
                      setTriggerConfig({ ...triggerConfig, webhook_id: id })
                    }}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Generate
                  </button>
                )}
              </div>
            </div>
            {triggerConfig.webhook_id && automation && (
              <div className="border-t pt-4">
                <WebhookManager
                  webhookId={triggerConfig.webhook_id}
                  automationId={automation.id}
                />
              </div>
            )}
          </div>
        )

      case 'condition':
        return (
          <div className="space-y-2">
            <label className="block text-sm font-medium">Condition Formula</label>
            <FormulaEditor
              value={triggerConfig.formula || ''}
              onChange={(formula: string) => setTriggerConfig({ ...triggerConfig, formula })}
              tableFields={tableFields}
            />
            <div className="text-xs text-gray-500 space-y-2">
              <p>
                Tip: for “after today” you can use <span className="font-mono">{`{YourDateField} > TODAY()`}</span>.
              </p>
              {conditionFormula.trim() && (
                <button
                  type="button"
                  onClick={() => setTriggerConfig({ ...triggerConfig, formula: conditionFormula })}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Use “Only run when…” conditions as formula
                </button>
              )}
            </div>
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
      const actionType = ACTION_TYPES.find(a => a.value === action.type)
      const Icon = actionType?.icon || Edit
      return (
        <div className="flex items-center gap-2 p-3 border border-gray-200 rounded-md hover:border-gray-300 transition-colors">
          <GripVertical className="h-4 w-4 text-gray-400" />
          <Icon className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{actionType?.label || action.type}</div>
            {actionType?.description && (
              <div className="text-xs text-gray-500 truncate">{actionType.description}</div>
            )}
          </div>
          <button
            onClick={() => setPreviewingAction(index)}
            className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded flex items-center gap-1"
            title="Preview action"
          >
            <Eye className="h-3 w-3" />
            Preview
          </button>
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
          {previewingAction === index && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold text-sm text-blue-900">Action Preview</span>
                </div>
                <button
                  onClick={() => setPreviewingAction(null)}
                  className="text-blue-600 hover:text-blue-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="text-sm text-blue-800 space-y-1">
                {renderActionPreview(action)}
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">What should this action do?</label>
            <Select
              value={action.type}
              onValueChange={(value) => updateAction(index, { type: value as ActionType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(() => {
                    const selected = ACTION_TYPES.find(at => at.value === action.type)
                    if (!selected) return "Select action type"
                    const Icon = selected.icon
                    return (
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{selected.label}</span>
                      </div>
                    )
                  })()}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(
                  ACTION_TYPES.reduce((acc, at) => {
                    if (!acc[at.category]) acc[at.category] = []
                    acc[at.category].push(at)
                    return acc
                  }, {} as Record<string, typeof ACTION_TYPES>)
                ).map(([category, actions]) => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {category}
                    </div>
                    {actions.map(at => {
                      const Icon = at.icon
                      return (
                        <SelectItem key={at.value} value={at.value}>
                          <div className="flex items-start gap-2 py-1">
                            <Icon className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{at.label}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{at.description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {(() => {
              const selected = ACTION_TYPES.find(at => at.value === action.type)
              if (!selected) return null
              return (
                <p className="text-xs text-gray-500 mt-1.5">{selected.description}</p>
              )
            })()}
          </div>

          {renderActionConfig(action, index)}
        </div>
      </div>
    )
  }

  function renderActionPreview(action: ActionConfig): React.ReactNode {
    switch (action.type) {
      case 'update_record':
        return (
          <>
            <div><strong>Will update:</strong> Record in table {action.table_id || 'selected table'}</div>
            {action.record_id && (
              <div><strong>Record ID:</strong> {action.record_id}</div>
            )}
            {action.field_update_mappings && action.field_update_mappings.length > 0 && (
              <div>
                <strong>Fields to update:</strong>
                <ul className="list-disc list-inside mt-1 ml-2">
                  {action.field_update_mappings.map((m, i) => (
                    <li key={i}>{m.field}: {String(m.value).substring(0, 50)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      case 'create_record':
        return (
          <>
            <div><strong>Will create:</strong> New record in table {action.table_id || 'selected table'}</div>
            {action.field_update_mappings && action.field_update_mappings.length > 0 && (
              <div>
                <strong>Initial values:</strong>
                <ul className="list-disc list-inside mt-1 ml-2">
                  {action.field_update_mappings.map((m, i) => (
                    <li key={i}>{m.field}: {String(m.value).substring(0, 50)}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )
      case 'delete_record':
        return (
          <>
            <div><strong>Will delete:</strong> Record {action.record_id || '{{record_id}}'}</div>
            <div><strong>From table:</strong> {action.table_id || 'selected table'}</div>
          </>
        )
      case 'send_email':
        return (
          <>
            <div><strong>To:</strong> {action.to || 'Not set'}</div>
            <div><strong>Subject:</strong> {action.subject || 'Not set'}</div>
            {action.email_body && (
              <div>
                <strong>Body preview:</strong>
                <div className="mt-1 p-2 bg-white border border-blue-300 rounded text-xs max-h-32 overflow-y-auto">
                  {action.email_body.substring(0, 200)}
                  {action.email_body.length > 200 && '...'}
                </div>
              </div>
            )}
          </>
        )
      case 'call_webhook':
        return (
          <>
            <div><strong>URL:</strong> {action.url || 'Not set'}</div>
            <div><strong>Method:</strong> {action.method || 'POST'}</div>
            {action.webhook_body && (
              <div>
                <strong>Payload:</strong>
                <pre className="mt-1 p-2 bg-white border border-blue-300 rounded text-xs max-h-32 overflow-y-auto">
                  {JSON.stringify(action.webhook_body, null, 2).substring(0, 200)}
                </pre>
              </div>
            )}
          </>
        )
      case 'delay':
        return (
          <>
            <div><strong>Will wait:</strong> {
              action.delay_type === 'until' && action.until_datetime
                ? `Until ${new Date(action.until_datetime).toLocaleString()}`
                : `${action.delay_value || 0} ${action.delay_type || 'seconds'}`
            }</div>
          </>
        )
      case 'log_message':
        return (
          <>
            <div><strong>Will log:</strong> {action.message || 'Not set'}</div>
            <div><strong>Level:</strong> {action.level || 'info'}</div>
          </>
        )
      default:
        return <div>Preview not available for this action type</div>
    }
  }

  function renderActionConfig(action: ActionConfig, index: number) {
    switch (action.type) {
      case 'update_record':
      case 'create_record':
        const mappings = action.field_update_mappings || []
        const triggerFieldOptions = tableFields
          .filter(f => f.type !== 'formula')
          .map(f => f.name)
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
              <label className="block text-sm font-medium mb-1">Field Updates</label>

              {/* Mapping UI */}
              <div className="space-y-2">
                {mappings.length === 0 && (
                  <div className="text-xs text-gray-500">
                    Add a field mapping below. You can pull values from the trigger record using <span className="font-mono">{`{{field_name}}`}</span>.
                  </div>
                )}

                {mappings.map((m, mIndex) => (
                  <div key={mIndex} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <label className="block text-xs text-gray-600 mb-1">Field</label>
                      <select
                        value={m.field || ''}
                        onChange={(e) => {
                          const next = [...mappings]
                          next[mIndex] = { ...next[mIndex], field: e.target.value }
                          updateAction(index, { field_update_mappings: next, field_updates: undefined })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">Select field...</option>
                        {tableFields.map(f => (
                          <option key={f.id || f.name} value={f.name}>{f.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <label className="block text-xs text-gray-600 mb-1">Pull from</label>
                      <select
                        value=""
                        onChange={(e) => {
                          const template = e.target.value ? `{{${e.target.value}}}` : ''
                          const next = [...mappings]
                          next[mIndex] = { ...next[mIndex], value: template }
                          updateAction(index, { field_update_mappings: next, field_updates: undefined })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        <option value="">(custom)</option>
                        {triggerFieldOptions.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-4 relative">
                      <label className="block text-xs text-gray-600 mb-1">Value</label>
                      <div className="relative">
                        <input
                          type="text"
                          ref={(el) => {
                            if (variablePickerOpen?.actionIndex === index && variablePickerOpen?.mappingIndex === mIndex) {
                              variablePickerOpen.inputRef = el
                            }
                          }}
                          value={typeof m.value === 'string' ? m.value : (m.value ?? '')}
                          onChange={(e) => {
                            const next = [...mappings]
                            next[mIndex] = { ...next[mIndex], value: e.target.value }
                            updateAction(index, { field_update_mappings: next, field_updates: undefined })
                          }}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm"
                          placeholder='e.g. {{status}} or Static text or =FORMULA(...)'
                        />
                        <button
                          type="button"
                          onClick={() => setVariablePickerOpen({ actionIndex: index, mappingIndex: mIndex, inputRef: null })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                          title="Insert variable"
                        >
                          <Variable className="h-4 w-4" />
                        </button>
                        {variablePickerOpen?.actionIndex === index && variablePickerOpen?.mappingIndex === mIndex && (
                          <div className="absolute right-0 top-full mt-1">
                            <VariablePicker
                              tableFields={tableFields}
                              onInsert={(variable) => {
                                const next = [...mappings]
                                const currentValue = typeof next[mIndex].value === 'string' ? next[mIndex].value : ''
                                const cursorPos = variablePickerOpen.inputRef?.selectionStart || currentValue.length
                                const newValue = currentValue.slice(0, cursorPos) + variable + currentValue.slice(cursorPos)
                                next[mIndex] = { ...next[mIndex], value: newValue }
                                updateAction(index, { field_update_mappings: next, field_updates: undefined })
                                setVariablePickerOpen(null)
                                setTimeout(() => {
                                  variablePickerOpen.inputRef?.focus()
                                  const newPos = cursorPos + variable.length
                                  variablePickerOpen.inputRef?.setSelectionRange(newPos, newPos)
                                }, 0)
                              }}
                              onClose={() => setVariablePickerOpen(null)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          const next = mappings.filter((_, i) => i !== mIndex)
                          updateAction(index, { field_update_mappings: next, field_updates: undefined })
                        }}
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                        title="Remove mapping"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    const next = [...mappings, { field: '', value: '' }]
                    updateAction(index, { field_update_mappings: next, field_updates: undefined })
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + Add field update
                </button>
              </div>

              {/* Advanced JSON (optional) */}
              <div className="mt-3">
                <label className="block text-xs text-gray-600 mb-1">Advanced (JSON)</label>
                <textarea
                  value={JSON.stringify(action.field_updates || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const updates = JSON.parse(e.target.value)
                      updateAction(index, { field_updates: updates, field_update_mappings: undefined })
                    } catch {}
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                  rows={4}
                  placeholder='{"field_name": "value", "another_field": "{{field_from_trigger}}"}'
                />
              </div>
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
            <div className="relative">
              <label className="block text-sm font-medium mb-1">Body</label>
              <div className="relative">
                <textarea
                  value={action.email_body || ''}
                  onChange={(e) => updateAction(index, { email_body: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm"
                  rows={4}
                  placeholder="Email body (supports {{variables}})"
                />
                <button
                  type="button"
                  onClick={() => setVariablePickerOpen({ actionIndex: index, mappingIndex: -1, inputRef: null })}
                  className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                  title="Insert variable"
                >
                  <Variable className="h-4 w-4" />
                </button>
              </div>
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
                value={JSON.stringify(action.webhook_body || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const body = JSON.parse(e.target.value)
                    updateAction(index, { webhook_body: body })
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium mb-1">Error</div>
              <div>{error}</div>
            </div>
          </div>
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

        {/* Category */}
        <div>
          <label className="block text-sm font-medium mb-1">Category (optional)</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">No category</option>
            <option value="Notifications">Notifications</option>
            <option value="Data Sync">Data Sync</option>
            <option value="Maintenance">Maintenance</option>
            <option value="Workflow">Workflow</option>
            <option value="Integrations">Integrations</option>
            <option value="Cleanup">Cleanup</option>
            <option value="Other">Other</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">Organize automations by category</p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-1">Tags (optional)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((_, i) => i !== index))}
                  className="hover:text-blue-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Add a tag..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  e.preventDefault()
                  const newTag = e.currentTarget.value.trim()
                  if (!tags.includes(newTag)) {
                    setTags([...tags, newTag])
                  }
                  e.currentTarget.value = ''
                }
              }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={(e) => {
                const input = e.currentTarget.previousElementSibling as HTMLInputElement
                if (input.value.trim() && !tags.includes(input.value.trim())) {
                  setTags([...tags, input.value.trim()])
                  input.value = ''
                }
              }}
              className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors text-sm"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Press Enter or click Add to add tags</p>
        </div>
      </div>

      {/* Trigger */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Trigger</h3>
        <div>
          <label className="block text-sm font-medium mb-1">When should this automation run?</label>
          <Select
            value={triggerType}
            onValueChange={(value) => {
              const nextType = value as TriggerType
              setTriggerType(nextType)
              // Convenience: if user already built "Only run when..." conditions
              // and selects the "When conditions match" trigger, seed the trigger formula.
              if (nextType === 'condition' && conditionFormula.trim()) {
                setTriggerConfig({ table_id: tableId, formula: conditionFormula })
              } else {
                setTriggerConfig({ table_id: tableId })
              }
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(() => {
                  const selected = TRIGGER_TYPES.find(tt => tt.value === triggerType)
                  if (!selected) return "Select trigger type"
                  const Icon = selected.icon
                  return (
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span>{selected.label}</span>
                    </div>
                  )
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map(tt => {
                const Icon = tt.icon
                return (
                  <SelectItem key={tt.value} value={tt.value}>
                    <div className="flex items-start gap-2 py-1">
                      <Icon className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{tt.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{tt.description}</div>
                      </div>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          {(() => {
            const selected = TRIGGER_TYPES.find(tt => tt.value === triggerType)
            return selected ? (
              <p className="text-xs text-gray-500 mt-1.5">{selected.description}</p>
            ) : null
          })()}
        </div>

        {renderTriggerConfig()}
      </div>

      {/* Conditions */}
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Only run when…</h3>
        <AutomationConditionBuilder
          filterTree={conditionFilterTree}
          tableFields={tableFields}
          onChange={setConditionFilterTree}
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
              <div key={index} data-action-index={index}>
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
          <button
            onClick={() => setShowTestMode(true)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Test Automation
          </button>
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

      {/* Test Mode Modal */}
      {showTestMode && automation && (
        <AutomationTestMode
          automation={automation}
          onClose={() => setShowTestMode(false)}
        />
      )}
    </div>
  )
}
