"use client"

import { useState, useRef } from "react"
import { X, Edit, Play, ChevronDown, ChevronUp } from "lucide-react"
import type { TriggerType, ActionType, ActionConfig, TriggerConfig, ActionGroup } from "@/lib/automations/types"
import type { TableField } from "@/types/database"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import AutomationConditionBuilder from "./AutomationConditionBuilder"
import VariablePicker from "./VariablePicker"
import { generateConditionSummary } from "@/lib/automations/condition-formula"
import { isEmptyFilterTree } from "@/lib/filters/canonical-model"

const TRIGGER_OPTIONS: { value: TriggerType; label: string }[] = [
  { value: 'row_created', label: 'When a record is created' },
  { value: 'row_updated', label: 'When a record is updated' },
  { value: 'row_deleted', label: 'When a record is deleted' },
  { value: 'schedule', label: 'On a schedule' },
  { value: 'webhook', label: 'When webhook is called' },
  { value: 'condition', label: 'When conditions match' },
]

interface AutomationPropertiesSidebarProps {
  selectedItem: { type: 'trigger' | 'action' | 'group', id: string | number } | null
  triggerType: TriggerType
  triggerConfig: TriggerConfig
  actionGroups: ActionGroup[]
  tableFields: TableField[]
  onUpdateTrigger: (config: TriggerConfig) => void
  onUpdateTriggerType?: (type: TriggerType) => void
  onUpdateAction: (groupIndex: number, actionIndex: number, updates: Partial<ActionConfig>) => void
  onUpdateGroup: (groupIndex: number, updates: Partial<ActionGroup>) => void
  onClose: () => void
}

const ACTION_TYPES: { value: ActionType; label: string; icon: string }[] = [
  { value: 'update_record', label: 'Update a record', icon: '✏️' },
  { value: 'create_record', label: 'Create a record', icon: '➕' },
  { value: 'delete_record', label: 'Delete a record', icon: '🗑️' },
  { value: 'send_email', label: 'Send email', icon: '📧' },
  { value: 'call_webhook', label: 'Call a webhook', icon: '🔗' },
  { value: 'run_script', label: 'Run a script', icon: '💻' },
  { value: 'delay', label: 'Wait', icon: '⏳' },
  { value: 'log_message', label: 'Log a message', icon: '📝' },
  { value: 'stop_execution', label: 'Stop execution', icon: '⏹️' },
]

export default function AutomationPropertiesSidebar({
  selectedItem,
  triggerType,
  triggerConfig,
  actionGroups,
  tableFields,
  onUpdateTrigger,
  onUpdateTriggerType,
  onUpdateAction,
  onUpdateGroup,
  onClose,
}: AutomationPropertiesSidebarProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [variablePickerOpen, setVariablePickerOpen] = useState<{ field: string; inputRef: HTMLInputElement | null } | null>(null)
  const conditionBuilderRef = useRef<HTMLDivElement>(null)

  if (!selectedItem) {
    return (
      <div className="w-80 border-l border-gray-200 bg-gray-50 p-6">
        <div className="text-center text-gray-500 text-sm">
          Select an item from the workflow to configure it
        </div>
      </div>
    )
  }

  // Find the selected group and action
  let selectedGroup: ActionGroup | null = null
  let selectedAction: ActionConfig | null = null
  let groupIndex = -1
  let actionIndex = -1

  if (selectedItem.type === 'group') {
    groupIndex = actionGroups.findIndex(g => g.id === selectedItem.id)
    if (groupIndex >= 0) {
      selectedGroup = actionGroups[groupIndex]
    }
  } else if (selectedItem.type === 'action') {
    // Parse action ID format: "groupId-actionIndex"
    const [groupId, actIdx] = String(selectedItem.id).split('-')
    groupIndex = actionGroups.findIndex(g => g.id === groupId)
    if (groupIndex >= 0) {
      selectedGroup = actionGroups[groupIndex]
      actionIndex = parseInt(actIdx, 10)
      if (actionIndex >= 0 && actionIndex < selectedGroup.actions.length) {
        selectedAction = selectedGroup.actions[actionIndex]
      }
    }
  }

  function renderTriggerProperties() {
    return (
      <div className="space-y-4">
        <div>
          <Label>Trigger Type</Label>
          {onUpdateTriggerType ? (
            <Select
              value={triggerType}
              onValueChange={(value) => onUpdateTriggerType(value as TriggerType)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="mt-1 text-sm text-gray-600">
              {TRIGGER_OPTIONS.find((o) => o.value === triggerType)?.label ?? triggerType}
            </div>
          )}
        </div>
        {/* Trigger-specific config would go here */}
      </div>
    )
  }

  function renderGroupProperties() {
    if (!selectedGroup) return null

    const conditionSummary = selectedGroup.condition && !isEmptyFilterTree(selectedGroup.condition)
      ? generateConditionSummary(selectedGroup.condition, tableFields)
      : 'Always run'

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2">CONFIGURATION</h3>
          <p className="text-xs text-gray-600 mb-4">
            This group of actions will run if the conditions defined below are met at the time the automation is triggered.
          </p>
        </div>

        {/* Conditions */}
        <div ref={conditionBuilderRef}>
          <div className="flex items-center justify-between mb-2">
            <Label>Conditions</Label>
            <button
              type="button"
              onClick={() => conditionBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Edit className="h-3 w-3" />
              Edit conditions
            </button>
          </div>
          <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm">
            <span className="font-medium">If {conditionSummary}</span>
            <div className="mt-2">
              <AutomationConditionBuilder
                filterTree={selectedGroup.condition ?? { operator: 'AND', children: [] }}
                tableFields={tableFields}
                onChange={(tree) => {
                  onUpdateGroup(groupIndex, { condition: tree })
                }}
              />
            </div>
          </div>
        </div>

        {/* Labels */}
        <div>
          <Label>LABELS</Label>
          <div className="mt-2 space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <input type="radio" checked={!selectedGroup.name} readOnly />
                <Label className="text-xs">Auto-generate from condition</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="radio" checked={!!selectedGroup.name} readOnly />
                <Label className="text-xs">Custom</Label>
              </div>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <input
                type="text"
                value={selectedGroup.name || conditionSummary}
                onChange={(e) => onUpdateGroup(groupIndex, { name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <textarea
                value={selectedGroup.description || ''}
                onChange={(e) => onUpdateGroup(groupIndex, { description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                rows={2}
                placeholder="Describe when this group runs..."
              />
            </div>
          </div>
        </div>

        {/* Test Step */}
        <div>
          <Label>TEST STEP</Label>
          <p className="text-xs text-gray-600 mt-1 mb-3">
            Test the conditions of this group of conditional actions to see if they match the data from earlier steps.
          </p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm flex items-center gap-2">
            <Play className="h-4 w-4" />
            Test conditions
          </button>
        </div>
      </div>
    )
  }

  function renderActionProperties() {
    if (!selectedAction || groupIndex < 0 || actionIndex < 0) return null

    const group = actionGroups[groupIndex]
    const conditionSummary = group.condition && !isEmptyFilterTree(group.condition)
      ? generateConditionSummary(group.condition, tableFields)
      : null

    return (
      <div className="space-y-6">
        {/* Action Type */}
        <div>
          <Label>Action type</Label>
          <Select
            value={selectedAction.type}
            onValueChange={(value) => {
              const newAction: ActionConfig = {
                type: value as ActionType,
                // Preserve common fields
                ...(selectedAction.type === value ? selectedAction : {}),
              }
              onUpdateAction(groupIndex, actionIndex, newAction)
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  <div className="flex items-center gap-2">
                    <span>{type.icon}</span>
                    <span>{type.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Labels */}
        <div>
          <Label>LABELS</Label>
          <div className="mt-2">
            <Label className="text-xs">Description</Label>
            <input
              type="text"
              value={getActionDescription(selectedAction) || ''}
              onChange={(e) => {
                // Store description in a custom field or use subject/name
                if (selectedAction.type === 'send_email') {
                  onUpdateAction(groupIndex, actionIndex, { subject: e.target.value })
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
              placeholder="Action description"
            />
          </div>
        </div>

        {/* Action will run context */}
        {conditionSummary && (
          <div>
            <Label>Action will run...</Label>
            <div className="mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              If {conditionSummary}
            </div>
          </div>
        )}

        {/* Action-specific configuration */}
        <div>
          <Label>Configuration</Label>
          <div className="mt-2 space-y-3">
            {renderActionConfig(selectedAction, groupIndex, actionIndex)}
          </div>
        </div>
      </div>
    )
  }

  function renderActionConfig(action: ActionConfig, groupIdx: number, actionIdx: number) {
    switch (action.type) {
      case 'send_email':
        return (
          <>
            <div>
              <Label className="text-xs">
                * To <span className="text-gray-500 text-xs">(Separate multiple emails with commas)</span>
              </Label>
              <div className="relative mt-1">
                <input
                  type="text"
                  value={action.to || ''}
                  onChange={(e) => onUpdateAction(groupIdx, actionIdx, { to: e.target.value })}
                  className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm"
                  placeholder="email@example.com"
                />
                <button
                  type="button"
                  onClick={() => setVariablePickerOpen({ field: 'to', inputRef: null })}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                >
                  <span className="text-xs text-blue-600">+</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowMoreOptions(!showMoreOptions)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {showMoreOptions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Show more options
            </button>

            {showMoreOptions && (
              <>
                <div>
                  <Label className="text-xs">CC</Label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={action.cc || ''}
                      onChange={(e) => onUpdateAction(groupIdx, actionIdx, { cc: e.target.value })}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm"
                      placeholder="cc@example.com"
                    />
                    <button
                      type="button"
                      onClick={() => setVariablePickerOpen({ field: 'cc', inputRef: null })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    >
                      <span className="text-xs text-blue-600">+</span>
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">BCC</Label>
                  <div className="relative mt-1">
                    <input
                      type="text"
                      value={action.bcc || ''}
                      onChange={(e) => onUpdateAction(groupIdx, actionIdx, { bcc: e.target.value })}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm"
                      placeholder="bcc@example.com"
                    />
                    <button
                      type="button"
                      onClick={() => setVariablePickerOpen({ field: 'bcc', inputRef: null })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    >
                      <span className="text-xs text-blue-600">+</span>
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">From name</Label>
                  <input
                    type="text"
                    value={action.from_name || ''}
                    onChange={(e) => onUpdateAction(groupIdx, actionIdx, { from_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                    placeholder="Your Name"
                  />
                </div>

                <div>
                  <Label className="text-xs">Reply to</Label>
                  <p className="text-xs text-gray-500 mt-0.5 mb-1">
                    Email address(es) to use in replies to this email.
                  </p>
                  <div className="relative">
                    <input
                      type="email"
                      value={action.reply_to || ''}
                      onChange={(e) => onUpdateAction(groupIdx, actionIdx, { reply_to: e.target.value })}
                      className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm"
                      placeholder="reply@example.com"
                    />
                    <button
                      type="button"
                      onClick={() => setVariablePickerOpen({ field: 'reply_to', inputRef: null })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
                    >
                      <span className="text-xs text-blue-600">+</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Subject</Label>
              <input
                type="text"
                value={action.subject || ''}
                onChange={(e) => onUpdateAction(groupIdx, actionIdx, { subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                placeholder="Email subject"
              />
            </div>

            <div>
              <Label className="text-xs">Body</Label>
              <div className="relative mt-1">
                <textarea
                  value={action.email_body || ''}
                  onChange={(e) => onUpdateAction(groupIdx, actionIdx, { email_body: e.target.value })}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md text-sm"
                  rows={4}
                  placeholder="Email body (supports {{variables}})"
                />
                <button
                  type="button"
                  onClick={() => setVariablePickerOpen({ field: 'email_body', inputRef: null })}
                  className="absolute right-2 top-2 p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600"
                >
                  <span className="text-xs">+</span>
                </button>
              </div>
            </div>
          </>
        )

      // Add other action types as needed
      default:
        return <div className="text-sm text-gray-500">Configuration for this action type coming soon</div>
    }
  }

  function getActionDescription(action: ActionConfig): string {
    switch (action.type) {
      case 'send_email':
        return action.subject || action.to || 'Send an email'
      case 'update_record':
        return action.field_update_mappings?.[0]?.field || 'Update record'
      default:
        return ''
    }
  }

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Properties</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {selectedItem.type === 'trigger' && renderTriggerProperties()}
        {selectedItem.type === 'group' && renderGroupProperties()}
        {selectedItem.type === 'action' && renderActionProperties()}
      </div>

      {/* Variable Picker */}
      {variablePickerOpen && (
        <div className="absolute right-80 top-20 z-50">
          <VariablePicker
            tableFields={tableFields}
            onInsert={(variable) => {
              // Insert variable into the appropriate field
              // This is simplified - in production you'd handle each field type
              if (selectedAction && groupIndex >= 0 && actionIndex >= 0) {
                const field = variablePickerOpen.field
                const currentValue = (selectedAction as any)[field] || ''
                const newValue = currentValue + variable
                onUpdateAction(groupIndex, actionIndex, { [field]: newValue } as any)
              }
              setVariablePickerOpen(null)
            }}
            onClose={() => setVariablePickerOpen(null)}
          />
        </div>
      )}
    </div>
  )
}
