"use client"

import { CheckCircle2, Play, Plus, MoreVertical, Edit } from "lucide-react"
import type { TriggerType, ActionType, ActionConfig, TriggerConfig, ActionGroup } from "@/lib/automations/types"
import type { TableField } from "@/types/database"
import { generateConditionSummary } from "@/lib/automations/condition-formula"
import { isEmptyFilterTree } from "@/lib/filters/canonical-model"

interface ConditionalWorkflowBuilderProps {
  triggerType: TriggerType
  triggerConfig: TriggerConfig
  actionGroups: ActionGroup[]
  selectedItem: { type: 'trigger' | 'action' | 'group', id: string | number } | null
  tableFields: TableField[]
  onSelectTrigger: () => void
  onSelectGroup: (groupIndex: number) => void
  onSelectAction: (groupIndex: number, actionIndex: number) => void
  onAddGroup: () => void
  onAddAction: (groupIndex: number) => void
  onEditCondition: (groupIndex: number) => void
}

const TRIGGER_LABELS: Record<TriggerType, string> = {
  row_created: 'When a record is created',
  row_updated: 'When a record is updated',
  row_deleted: 'When a record is deleted',
  schedule: 'On a schedule',
  webhook: 'When webhook is called',
  condition: 'When conditions match',
}

const ACTION_LABELS: Record<ActionType, string> = {
  update_record: 'Update a record',
  create_record: 'Create a record',
  delete_record: 'Delete a record',
  send_email: 'Send an email',
  call_webhook: 'Call a webhook',
  run_script: 'Run a script',
  delay: 'Wait',
  log_message: 'Log a message',
  stop_execution: 'Stop execution',
}

const ACTION_ICONS: Record<ActionType, string> = {
  update_record: '✏️',
  create_record: '➕',
  delete_record: '🗑️',
  send_email: '📧',
  call_webhook: '🔗',
  run_script: '💻',
  delay: '⏳',
  log_message: '📝',
  stop_execution: '⏹️',
}

export default function ConditionalWorkflowBuilder({
  triggerType,
  triggerConfig,
  actionGroups,
  selectedItem,
  tableFields,
  onSelectTrigger,
  onSelectGroup,
  onSelectAction,
  onAddAction,
  onAddGroup,
  onEditCondition,
}: ConditionalWorkflowBuilderProps) {
  
  function getConditionLabel(group: ActionGroup, index: number): { prefix: string; condition: string; values: string[] } {
    if (!group.condition || isEmptyFilterTree(group.condition)) {
      return { prefix: 'Always run', condition: '', values: [] }
    }

    const summary = generateConditionSummary(group.condition, tableFields)
    const prefix = index === 0 ? 'If' : 'Otherwise if'
    
    // Extract highlighted values from condition summary
    // This is a simplified version - in production you'd parse the filter tree more carefully
    const values: string[] = []
    const normalized = group.condition
    if (normalized && 'children' in normalized) {
      normalized.children.forEach((child) => {
        if ('field_id' in child && 'value' in child && child.value !== null && child.value !== undefined) {
          values.push(String(child.value))
        }
      })
    }

    return { prefix, condition: summary, values }
  }

  function getActionDescription(action: ActionConfig): string {
    switch (action.type) {
      case 'send_email':
        return action.subject || action.to || 'Send an email'
      case 'update_record':
        return action.field_update_mappings?.[0]?.field || 'Update record'
      case 'create_record':
        return 'Create new record'
      case 'delete_record':
        return 'Delete record'
      default:
        return ACTION_LABELS[action.type]
    }
  }

  function isSelected(type: 'trigger' | 'action' | 'group', id: string | number): boolean {
    return selectedItem?.type === type && selectedItem?.id === id
  }

  return (
    <div className="space-y-6">
      {/* TRIGGER Section */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">TRIGGER</div>
        <button
          onClick={onSelectTrigger}
          className={`w-full p-4 bg-white border-2 rounded-lg transition-all text-left ${
            isSelected('trigger', 'trigger')
              ? 'border-blue-500 shadow-md'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{TRIGGER_LABELS[triggerType]}</div>
              {triggerConfig.watch_fields && triggerConfig.watch_fields.length > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  Watching: {triggerConfig.watch_fields.join(', ')}
                </div>
              )}
            </div>
            <Edit className="h-4 w-4 text-gray-400" />
          </div>
        </button>
      </div>

      {/* ACTIONS Section */}
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">ACTIONS</div>
        
        {actionGroups.length === 0 ? (
          <button
            onClick={onAddGroup}
            className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center text-gray-500 hover:text-blue-600"
          >
            <Plus className="h-5 w-5 mx-auto mb-2" />
            <div className="text-sm font-medium">Add condition</div>
          </button>
        ) : (
          <div className="space-y-4">
            {actionGroups.map((group, groupIndex) => {
              const { prefix, condition, values } = getConditionLabel(group, groupIndex)
              const isGroupSelected = isSelected('group', group.id)
              
              return (
                <div key={group.id} className="relative">
                  {/* Connecting line */}
                  {groupIndex > 0 && (
                    <div className="absolute left-6 top-0 -mt-4 w-0.5 h-4 bg-gray-300">
                      <div className="absolute -left-1.5 top-1/2 -translate-y-1/2">
                        <CheckCircle2 className="h-3 w-3 text-gray-400" />
                      </div>
                    </div>
                  )}

                  {/* Group Card */}
                  <div
                    className={`bg-white border-2 rounded-lg transition-all ${
                      isGroupSelected
                        ? 'border-blue-500 shadow-md'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <button
                      onClick={() => onSelectGroup(groupIndex)}
                      className="w-full p-4 text-left"
                    >
                      {/* Condition Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <Play className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm mb-1">
                            {prefix}{' '}
                            {condition && (
                              <span>
                                {condition.split(' ').map((word, i) => {
                                  const isValue = values.some(v => word.includes(v))
                                  if (isValue) {
                                    return (
                                      <span key={i} className="bg-blue-100 text-blue-700 px-1 rounded">
                                        {word}
                                      </span>
                                    )
                                  }
                                  return <span key={i}>{word} </span>
                                })}
                              </span>
                            )}
                            {!condition && <span className="text-gray-500">Always run</span>}
                          </div>
                          {group.description && (
                            <div className="text-xs text-gray-500">{group.description}</div>
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditCondition(groupIndex)
                          }}
                          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded"
                        >
                          <Edit className="h-4 w-4 text-gray-400" />
                        </button>
                      </div>

                      {/* Actions in Group */}
                      {group.actions.length > 0 ? (
                        <div className="space-y-2 ml-7">
                          {group.actions.map((action, actionIndex) => {
                            const isActionSelected = isSelected('action', `${group.id}-${actionIndex}`)
                            return (
                              <div
                                key={actionIndex}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectAction(groupIndex, actionIndex)
                                }}
                                className={`p-3 border rounded-lg transition-all cursor-pointer ${
                                  isActionSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-lg">{ACTION_ICONS[action.type]}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{ACTION_LABELS[action.type]}</div>
                                    <div className="text-xs text-gray-500">{getActionDescription(action)}</div>
                                  </div>
                                  <MoreVertical className="h-4 w-4 text-gray-400" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="ml-7">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onAddAction(groupIndex)
                            }}
                            className="w-full p-2 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors"
                          >
                            + Add action
                          </button>
                        </div>
                      )}
                    </button>

                    {/* Add action button in group */}
                    {group.actions.length > 0 && (
                      <div className="px-4 pb-3 ml-7">
                        <button
                          onClick={() => onAddAction(groupIndex)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <Plus className="h-4 w-4" />
                          Add action
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Add condition button */}
            <button
              onClick={onAddGroup}
              className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center text-gray-500 hover:text-blue-600"
            >
              <Plus className="h-4 w-4 inline mr-2" />
              <span className="text-sm font-medium">Add condition</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
