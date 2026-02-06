"use client"

import { useState, useEffect, useMemo } from "react"
import { Save, Play, Trash2, Plus, X, GripVertical, AlertCircle, Sparkles, RefreshCw, Trash, Clock, Webhook, Filter, Edit, FilePlus, Mail, Code, Timer, MessageSquare, Square, Layout, List, Variable, Eye } from "lucide-react"
import type { Automation, TableField } from "@/types/database"
import type { TriggerType, ActionType, ActionConfig, TriggerConfig } from "@/lib/automations/types"
import AutomationConditionBuilder from "./AutomationConditionBuilder"
import VisualWorkflowBuilder from "./VisualWorkflowBuilder"
import ConditionalWorkflowBuilder from "./ConditionalWorkflowBuilder"
import AutomationPropertiesSidebar from "./AutomationPropertiesSidebar"
import VariablePicker from "./VariablePicker"
import ScheduleBuilder from "./ScheduleBuilder"
import AutomationTestMode from "./AutomationTestMode"
import WebhookManager from "./WebhookManager"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { ActionGroup } from "@/lib/automations/types"
import { filterTreeToFormula } from "@/lib/automations/condition-formula"
import FormulaEditor from "@/components/fields/FormulaEditor"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
  const [actionGroups, setActionGroups] = useState<ActionGroup[]>([])
  const [enabled, setEnabled] = useState(true)
  const [conditionFilterTree, setConditionFilterTree] = useState<FilterTree>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<{ type: 'trigger' | 'action' | 'group', id: string | number } | null>(null)
  const [category, setCategory] = useState<string>("")
  const [tags, setTags] = useState<string[]>([])
  const [showTestMode, setShowTestMode] = useState(false)
  const [editingConditionGroupIndex, setEditingConditionGroupIndex] = useState<number | null>(null)
  const [showActionTypePicker, setShowActionTypePicker] = useState<{ groupIndex: number; buttonRef: HTMLElement | null } | null>(null)

  // Helper to generate unique IDs
  function generateId(): string {
    return `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  useEffect(() => {
    if (automation) {
      setName(automation.name || "")
      setDescription(automation.description || "")
      setTriggerType((automation.trigger_type as TriggerType) || "row_created")
      setTriggerConfig(automation.trigger_config || {})
      setEnabled(automation.enabled ?? true)
      setCategory(automation.category || "")
      setTags(automation.tags || [])
      
      // Convert actions to actionGroups (migration logic)
      if (automation.actions && Array.isArray(automation.actions) && automation.actions.length > 0) {
        // Check if already in new format (actionGroups)
        if (automation.actions[0] && 'actions' in automation.actions[0] && Array.isArray(automation.actions[0].actions)) {
          // Already in new format
          setActionGroups(automation.actions as ActionGroup[])
        } else {
          // Old format: flat actions array - convert to single "always run" group
          // Also check if there's a global condition
          const conditions = automation.conditions?.[0]
          let groupCondition: FilterTree = null
          if (conditions) {
            if (conditions.filter_tree) {
              groupCondition = conditions.filter_tree as FilterTree
            }
          }
          
          setActionGroups([{
            id: generateId(),
            condition: groupCondition,
            actions: automation.actions as ActionConfig[],
            order: 0,
          }])
        }
      } else {
        // No actions - start with empty groups
        setActionGroups([])
      }
      
      // Handle legacy global conditions (now moved to first group)
      // This is handled above in the migration logic
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
      // Save actionGroups as actions (they're compatible)
      // For backward compatibility, if there's a single group with no condition,
      // we could also save as flat array, but we'll use groups format for now
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        trigger_type: triggerType,
        trigger_config: triggerConfig,
        actions: actionGroups as any, // Save as actionGroups
        enabled,
        conditions: undefined, // Conditions are now in actionGroups
        category: category || undefined,
        tags: tags.length > 0 ? tags : undefined,
      })
    } catch (err: any) {
      setError(err.message || "Failed to save automation")
    } finally {
      setLoading(false)
    }
  }

  function addActionGroup() {
    const newGroup: ActionGroup = {
      id: generateId(),
      condition: null, // Always run by default
      actions: [],
      order: actionGroups.length,
    }
    setActionGroups([...actionGroups, newGroup])
    setSelectedItem({ type: 'group', id: newGroup.id })
  }

  function addAction(groupIndex: number, actionType?: ActionType) {
    const newAction: ActionConfig = {
      type: actionType || 'log_message',
      message: 'Action executed',
    }
    const newGroups = [...actionGroups]
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      actions: [...newGroups[groupIndex].actions, newAction],
    }
    setActionGroups(newGroups)
    setSelectedItem({ type: 'action', id: `${newGroups[groupIndex].id}-${newGroups[groupIndex].actions.length - 1}` })
    setShowActionTypePicker(null)
  }

  function updateAction(groupIndex: number, actionIndex: number, updates: Partial<ActionConfig>) {
    const newGroups = [...actionGroups]
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      actions: newGroups[groupIndex].actions.map((action, idx) => 
        idx === actionIndex ? { ...action, ...updates } : action
      ),
    }
    setActionGroups(newGroups)
  }

  function deleteAction(groupIndex: number, actionIndex: number) {
    const newGroups = [...actionGroups]
    newGroups[groupIndex] = {
      ...newGroups[groupIndex],
      actions: newGroups[groupIndex].actions.filter((_, i) => i !== actionIndex),
    }
    setActionGroups(newGroups)
    setSelectedItem(null)
  }

  function updateGroup(groupIndex: number, updates: Partial<ActionGroup>) {
    const newGroups = [...actionGroups]
    newGroups[groupIndex] = { ...newGroups[groupIndex], ...updates }
    setActionGroups(newGroups)
  }

  function deleteGroup(groupIndex: number) {
    setActionGroups(actionGroups.filter((_, i) => i !== groupIndex))
    setSelectedItem(null)
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

  // Legacy action rendering functions removed - actions are now handled by ConditionalWorkflowBuilder
  // and AutomationPropertiesSidebar components. These functions are no longer used.
  // The renderActionConfig function is defined in AutomationPropertiesSidebar.tsx instead.

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm m-4">
          <div className="flex items-start gap-2 text-red-700">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium mb-1">Error</div>
              <div>{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Save/Test buttons */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between bg-white">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-xl font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1 -mx-2 -my-1 w-full max-w-md"
            placeholder="Enter automation name"
          />
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors flex items-center gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          {onTest && (
            <button
              onClick={() => setShowTestMode(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Test automation
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={loading || !name.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Two-Panel Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Workflow */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          <ConditionalWorkflowBuilder
            triggerType={triggerType}
            triggerConfig={triggerConfig}
            actionGroups={actionGroups}
            selectedItem={selectedItem}
            tableFields={tableFields}
            onSelectTrigger={() => setSelectedItem({ type: 'trigger', id: 'trigger' })}
            onSelectGroup={(groupIndex) => setSelectedItem({ type: 'group', id: actionGroups[groupIndex].id })}
            onSelectAction={(groupIndex, actionIndex) => 
              setSelectedItem({ type: 'action', id: `${actionGroups[groupIndex].id}-${actionIndex}` })
            }
            onAddGroup={addActionGroup}
            onAddAction={addAction}
            onEditCondition={(groupIndex) => setEditingConditionGroupIndex(groupIndex)}
            onDeleteGroup={deleteGroup}
            onShowActionTypePicker={(groupIndex) => setShowActionTypePicker({ groupIndex, buttonRef: null })}
          />
        </div>

        {/* Right Panel: Properties Sidebar */}
        <AutomationPropertiesSidebar
          selectedItem={selectedItem}
          triggerType={triggerType}
          triggerConfig={triggerConfig}
          actionGroups={actionGroups}
          tableFields={tableFields}
          onUpdateTrigger={setTriggerConfig}
          onUpdateTriggerType={setTriggerType}
          onUpdateAction={updateAction}
          onUpdateGroup={updateGroup}
          onClose={() => setSelectedItem(null)}
        />
      </div>


      {/* Test Mode Modal */}
      {showTestMode && automation && (
        <AutomationTestMode
          automation={automation}
          onClose={() => setShowTestMode(false)}
        />
      )}

      {/* Action Type Picker Dialog */}
      <Dialog open={!!showActionTypePicker} onOpenChange={(open) => !open && setShowActionTypePicker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Action Type</DialogTitle>
            <DialogDescription>
              Select the type of action you want to add to this automation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 py-4">
            {ACTION_TYPES.map((actionType) => {
              const Icon = actionType.icon
              return (
                <button
                  key={actionType.value}
                  onClick={() => {
                    if (showActionTypePicker) {
                      addAction(showActionTypePicker.groupIndex, actionType.value)
                    }
                  }}
                  className="flex items-start gap-3 p-3 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-gray-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{actionType.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{actionType.description}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
