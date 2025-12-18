import { createClient } from '@/lib/supabase/server'
import { evaluateTrigger } from './triggers'
import { executeAction } from './actions'
import type { Automation } from '@/types/database'
import type {
  AutomationContext,
  AutomationRun,
  AutomationLog,
  TriggerType,
  ActionConfig,
} from './types'

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
      // Conditions are evaluated using formula engine
      // For now, we'll skip if any condition fails
      // In a full implementation, you'd evaluate each condition
    }

    // Execute actions
    const actions = (automation.actions || []) as ActionConfig[]
    
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
    // Mark run as failed
    await supabase
      .from('automation_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error: error.message || 'Automation execution failed',
      })
      .eq('id', runId)

    await logMessage(supabase, automation.id, runId, 'error', `Automation failed: ${error.message}`)

    return {
      success: false,
      runId,
      error: error.message || 'Automation execution failed',
      logs: [
        ...logs,
        {
          id: '',
          automation_id: automation.id,
          run_id: runId,
          level: 'error',
          message: `Automation failed: ${error.message}`,
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
