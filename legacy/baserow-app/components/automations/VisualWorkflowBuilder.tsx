"use client"

import { useState } from "react"
import { ArrowRight, Plus, Settings, Filter, Play } from "lucide-react"
import type { TriggerType, ActionType, ActionConfig, TriggerConfig } from "@/lib/automations/types"
import type { Automation } from "@/types/database"

interface VisualWorkflowBuilderProps {
  automation?: Automation | null
  triggerType: TriggerType
  triggerConfig: TriggerConfig
  actions: ActionConfig[]
  conditions?: any[]
  onEditTrigger: () => void
  onEditConditions: () => void
  onEditAction: (index: number) => void
  onAddAction: () => void
  onReorderActions?: (fromIndex: number, toIndex: number) => void
}

const TRIGGER_ICONS: Record<TriggerType, string> = {
  row_created: '✨',
  row_updated: '🔄',
  row_deleted: '🗑️',
  schedule: '⏰',
  webhook: '🔗',
  condition: '🔍',
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

export default function VisualWorkflowBuilder({
  automation,
  triggerType,
  triggerConfig,
  actions,
  conditions,
  onEditTrigger,
  onEditConditions,
  onAddAction,
  onEditAction,
}: VisualWorkflowBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  function getTriggerLabel(type: TriggerType): string {
    const labels: Record<TriggerType, string> = {
      row_created: 'When a record is created',
      row_updated: 'When a record is updated',
      row_deleted: 'When a record is deleted',
      schedule: 'On a schedule',
      webhook: 'When webhook is called',
      condition: 'When conditions match',
    }
    return labels[type]
  }

  function getActionLabel(type: ActionType): string {
    const labels: Record<ActionType, string> = {
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
    return labels[type]
  }

  function hasConditions(): boolean {
    return conditions && conditions.length > 0 && conditions[0] && 
           (conditions[0].filter_tree || conditions[0].formula)
  }

  return (
    <div className="space-y-6">
      {/* Visual Flow */}
      <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
        <div className="flex items-center gap-4 overflow-x-auto pb-4">
          {/* Trigger */}
          <div className="flex-shrink-0">
            <button
              onClick={onEditTrigger}
              className="group relative bg-white border-2 border-blue-500 rounded-lg p-4 min-w-[200px] hover:border-blue-600 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{TRIGGER_ICONS[triggerType]}</span>
                <div className="text-left flex-1">
                  <div className="text-xs text-gray-500 mb-1">TRIGGER</div>
                  <div className="font-semibold text-sm">{getTriggerLabel(triggerType)}</div>
                </div>
                <Settings className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
              </div>
            </button>
          </div>

          <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />

          {/* Conditions (optional) */}
          {hasConditions() && (
            <>
              <div className="flex-shrink-0">
                <button
                  onClick={onEditConditions}
                  className="group relative bg-white border-2 border-purple-500 rounded-lg p-4 min-w-[200px] hover:border-purple-600 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Filter className="h-5 w-5 text-purple-600" />
                    <div className="text-left flex-1">
                      <div className="text-xs text-gray-500 mb-1">CONDITIONS</div>
                      <div className="font-semibold text-sm">Only run when...</div>
                    </div>
                    <Settings className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                  </div>
                </button>
              </div>
              <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {actions.length === 0 ? (
              <button
                onClick={onAddAction}
                className="flex-shrink-0 bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 min-w-[200px] hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-500 hover:text-blue-600"
              >
                <div className="flex items-center gap-3">
                  <Plus className="h-5 w-5" />
                  <div className="text-left">
                    <div className="text-xs text-gray-500 mb-1">ACTION</div>
                    <div className="font-semibold text-sm">Add action</div>
                  </div>
                </div>
              </button>
            ) : (
              <>
                {actions.map((action, index) => (
                  <div key={index} className="flex items-center gap-3 flex-shrink-0">
                    <button
                      onClick={() => onEditAction(index)}
                      className="group relative bg-white border-2 border-green-500 rounded-lg p-4 min-w-[200px] hover:border-green-600 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{ACTION_ICONS[action.type]}</span>
                        <div className="text-left flex-1">
                          <div className="text-xs text-gray-500 mb-1">ACTION {index + 1}</div>
                          <div className="font-semibold text-sm">{getActionLabel(action.type)}</div>
                        </div>
                        <Settings className="h-4 w-4 text-gray-400 group-hover:text-gray-600" />
                      </div>
                    </button>
                    {index < actions.length - 1 && (
                      <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                ))}
                <button
                  onClick={onAddAction}
                  className="flex-shrink-0 bg-white border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-green-500 hover:bg-green-50 transition-all text-gray-500 hover:text-green-600"
                  title="Add another action"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Play className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <div className="font-semibold text-sm text-blue-900 mb-1">How it works</div>
            <div className="text-sm text-blue-800">
              This automation will <strong>{getTriggerLabel(triggerType).toLowerCase()}</strong>
              {hasConditions() && ' when the specified conditions are met'}
              {actions.length > 0 && (
                <>
                  , then it will {actions.length === 1 ? 'execute' : 'execute'} {actions.length === 1 ? 'this action' : `these ${actions.length} actions`}:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {actions.map((action, index) => (
                      <li key={index}>{getActionLabel(action.type)}</li>
                    ))}
                  </ul>
                </>
              )}
              {actions.length === 0 && '. Add actions to define what happens next.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
