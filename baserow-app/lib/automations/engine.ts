import { createClient } from '@/lib/supabase/server'
import { evaluateTrigger } from './triggers'
import { executeAction } from './actions'
import { evaluateConditions } from './evaluate-conditions'
import type { Automation } from '@/types/database'
import type {
  AutomationContext,
  AutomationRun,
  AutomationLog,
  TriggerType,
  ActionConfig,
} from './types'
import type { TableField } from '@/types/fields'
import { getUserFriendlyError } from './error-messages'

export interface AutomationExecutionResult {
  success: boolean
  runId: string
  error?: string
  logs: AutomationLog[]
}

/**
 * Execute an automation
 */
export async function executeAutomation(
  automation: Automation,
  eventData?: Record<string, any>
): Promise<AutomationExecutionResult> {
  const supabase = await createClient()
  const logs: AutomationLog[] = []

  // Create automation run
  const { data: run, error: runError } = await supabase
    .from('automation_runs')
    .insert([
      {
        automation_id: automation.id,
        status: 'running',
        started_at: new Date().toISOString(),
        context: {
          automation_id: automation.id,
          trigger_type: automation.trigger_type as TriggerType,
          trigger_data: eventData,
        },
      },
    ])
    .select()
    .single()

  if (runError || !run) {
    return {
      success: false,
      runId: '',
      error: `Failed to create automation run: ${runError?.message}`,
      logs: [],
    }
  }

  const runId = run.id

  try {
    // Evaluate trigger
    const triggerResult = await evaluateTrigger(
      automation.trigger_type as TriggerType,
      automation.trigger_config || {},
      eventData
    )

    if (!triggerResult.shouldRun) {
      await supabase
        .from('automation_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', runId)

      return {
        success: true,
        runId,
        logs: [{
          id: '',
          automation_id: automation.id,
          run_id: runId,
          level: 'info',
          message: 'Trigger condition not met, automation skipped',
          created_at: new Date().toISOString(),
        }],
      }
    }

    const context: AutomationContext = {
      ...triggerResult.context!,
      automation_id: automation.id,
    }

    // Evaluate conditions if present
    if (automation.conditions && automation.conditions.length > 0) {
      const condition = automation.conditions[0]
      
      // Get table fields for condition evaluation
      let tableFields: TableField[] = []
      if (context.table_id) {
        const { data: fields } = await supabase
          .from('table_fields')
          .select('*')
          .eq('table_id', context.table_id)
        
        tableFields = (fields || []) as TableField[]
      }

      // Get the record data for evaluation
      const record = context.trigger_data || {}
      
      // Support both new format (filter_tree) and old format (formula)
      let conditionMet = true
      
      if (condition.filter_tree) {
        // New format: evaluate filter tree
        conditionMet = await evaluateConditions(
          condition.filter_tree as any,
          record,
          tableFields
        )
      } else if (condition.formula) {
        // Old format: evaluate formula directly
        // Use the same evaluation logic as evaluateConditions
        try {
          const { Tokenizer } = await import('@/lib/formulas/tokenizer')
          const { Parser } = await import('@/lib/formulas/parser')
          const { Evaluator } = await import('@/lib/formulas/evaluator')
          
          const tokenizer = new Tokenizer(condition.formula)
          const tokens = tokenizer.tokenize()
          const parser = new Parser(tokens)
          const ast = parser.parse()

          const evaluator = new Evaluator({
            row: record,
            fields: tableFields.map(f => ({ name: f.name, type: f.type }))
          })

          const result = evaluator.evaluate(ast)
          conditionMet = Boolean(result) && !(typeof result === 'string' && result.startsWith('#'))
        } catch (error) {
          console.error('Error evaluating condition formula:', error)
          conditionMet = false
        }
      }

      if (!conditionMet) {
        await supabase
          .from('automation_runs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', runId)

        return {
          success: true,
          runId,
          logs: [{
            id: '',
            automation_id: automation.id,
            run_id: runId,
            level: 'info',
            message: 'Conditions not met, automation skipped',
            created_at: new Date().toISOString(),
          }],
        }
      }
    }

    // Execute actions - support both actionGroups (new format) and flat actions (old format)
    const actionsOrGroups = automation.actions || []
    
    // Check if it's the new format (actionGroups)
    const isActionGroups = Array.isArray(actionsOrGroups) && 
                          actionsOrGroups.length > 0 && 
                          actionsOrGroups[0] && 
                          'actions' in actionsOrGroups[0] && 
                          Array.isArray(actionsOrGroups[0].actions)
    
    if (isActionGroups) {
      // New format: actionGroups with If/Otherwise if logic
      const actionGroups = actionsOrGroups as any[] // ActionGroup[]
      
      for (let groupIndex = 0; groupIndex < actionGroups.length; groupIndex++) {
        const group = actionGroups[groupIndex]
        
        // Evaluate group condition
        let shouldRun = true
        if (group.condition) {
          // Get table fields for condition evaluation
          let tableFields: TableField[] = []
          if (context.table_id) {
            const { data: fields } = await supabase
              .from('table_fields')
              .select('*')
              .eq('table_id', context.table_id)
            
            tableFields = (fields || []) as TableField[]
          }
          
          const record = context.trigger_data || {}
          shouldRun = await evaluateConditions(
            group.condition as any,
            record,
            tableFields
          )
        }
        
        if (shouldRun) {
          // Execute all actions in this group
          await logMessage(supabase, automation.id, runId, 'info', `Executing action group ${groupIndex + 1} (${group.actions?.length || 0} actions)`)
          
          const groupActions = group.actions || []
          for (let actionIndex = 0; actionIndex < groupActions.length; actionIndex++) {
            const action = groupActions[actionIndex]
            
            await logMessage(supabase, automation.id, runId, 'info', `Executing action ${actionIndex + 1} in group ${groupIndex + 1}: ${action.type}`)
            
            try {
              const actionResult = await executeAction(action, context)
              
              if (actionResult.success) {
                // Merge action result into context for next actions
                if (actionResult.data) {
                  context.variables = {
                    ...context.variables,
                    [`action_${groupIndex}_${actionIndex}_result`]: actionResult.data,
                  }
                }
                
                // Add action logs
                if (actionResult.logs) {
                  for (const log of actionResult.logs) {
                    await logMessage(supabase, automation.id, runId, log.level, log.message, log.data)
                    logs.push({
                      id: '',
                      automation_id: automation.id,
                      run_id: runId,
                      level: log.level,
                      message: log.message,
                      data: log.data,
                      created_at: new Date().toISOString(),
                    })
                  }
                }
              } else {
                throw new Error(actionResult.error || 'Action failed')
              }
            } catch (actionError: any) {
              const errorMessage = actionError.message || 'Unknown error executing action'
              await logMessage(supabase, automation.id, runId, 'error', `Action failed: ${errorMessage}`)
              logs.push({
                id: '',
                automation_id: automation.id,
                run_id: runId,
                level: 'error',
                message: `Action failed: ${errorMessage}`,
                created_at: new Date().toISOString(),
              })
              
              // Continue with next action (don't stop on single action failure)
            }
          }
          
          // First matching group wins - break after executing this group
          break
        } else {
          await logMessage(supabase, automation.id, runId, 'info', `Action group ${groupIndex + 1} condition not met, skipping`)
        }
      }
    } else {
      // Old format: flat actions array
      const actions = actionsOrGroups as ActionConfig[]
      
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i]

        // Log action start
        await logMessage(supabase, automation.id, runId, 'info', `Executing action ${i + 1}: ${action.type}`)
        logs.push({
          id: '',
          automation_id: automation.id,
          run_id: runId,
          level: 'info',
          message: `Executing action ${i + 1}: ${action.type}`,
        created_at: new Date().toISOString(),
      })

      const result = await executeAction(action, context)

      // Log action result
      if (result.logs) {
        for (const log of result.logs) {
          await logMessage(supabase, automation.id, runId, log.level, log.message)
          logs.push({
            id: '',
            automation_id: automation.id,
            run_id: runId,
            level: log.level,
            message: log.message,
            created_at: new Date().toISOString(),
          })
        }
      }

      if (!result.success) {
        await logMessage(supabase, automation.id, runId, 'error', `Action failed: ${result.error}`)
        logs.push({
          id: '',
          automation_id: automation.id,
          run_id: runId,
          level: 'error',
          message: `Action failed: ${result.error}`,
          created_at: new Date().toISOString(),
        })

        // Update context with error
        if (!context.variables) {
          context.variables = {}
        }
        context.variables.last_error = result.error

        // Continue or stop based on action type
        // For now, continue to next action
      } else {
        // Update context with action result
        if (!context.variables) {
          context.variables = {}
        }
        context.variables[`action_${i}_result`] = result.data

        // If action created a record, add it to context
        if (result.data?.record_id) {
          context.record_id = result.data.record_id
        }

        // Check if action stopped execution
        if (result.data?.stopped) {
          await supabase
            .from('automation_runs')
            .update({
              status: 'stopped',
              completed_at: new Date().toISOString(),
            })
            .eq('id', runId)

          return {
            success: true,
            runId,
            logs,
          }
        }
      }
    }

    // Mark run as completed
    await supabase
      .from('automation_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return {
      success: true,
      runId,
      logs,
    }
  } catch (error: any) {
    // Convert to user-friendly error
    const friendlyError = getUserFriendlyError(error, {
      triggerType: automation.trigger_type
    })
    
    // Mark run as failed
    await supabase
      .from('automation_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: friendlyError.message,
      })
      .eq('id', runId)

    await logMessage(supabase, automation.id, runId, 'error', `Automation failed: ${friendlyError.message}`)

    return {
      success: false,
      runId,
      error: friendlyError.message,
      logs: [
        ...logs,
        {
          id: '',
          automation_id: automation.id,
          run_id: runId,
          level: 'error',
          message: `Automation failed: ${friendlyError.message}`,
          created_at: new Date().toISOString(),
        },
      ],
    }
  }
}

async function logMessage(
  supabase: any,
  automationId: string,
  runId: string | undefined,
  level: 'info' | 'warning' | 'error',
  message: string
) {
  try {
    await supabase
      .from('automation_logs')
      .insert([
        {
          automation_id: automationId,
          run_id: runId,
          level,
          message,
        },
      ])
  } catch (error) {
    console.error('Failed to log message:', error)
  }
}
