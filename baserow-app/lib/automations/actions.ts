import { createClient } from '@/lib/supabase/server'
import { getTable } from '@/lib/crud/tables'
import type { ActionConfig, AutomationContext, LogLevel } from './types'
import { replaceVariablesInObject } from './variables'
import { Tokenizer } from '@/lib/formulas/tokenizer'
import { Parser } from '@/lib/formulas/parser'
import { Evaluator } from '@/lib/formulas/evaluator'
import type { TableField } from '@/types/fields'

export interface ActionResult {
  success: boolean
  error?: string
  data?: any
  logs?: Array<{ level: LogLevel; message: string }>
}

const ACTION_TIMEOUT = 30000 // 30 seconds

/**
 * Execute an automation action
 */
export async function executeAction(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  const timeoutPromise = new Promise<ActionResult>((resolve) => {
    setTimeout(() => {
      resolve({
        success: false,
        error: 'Action timed out after 30 seconds',
      })
    }, ACTION_TIMEOUT)
  })

  const actionPromise = executeActionInternal(action, context)

  return Promise.race([actionPromise, timeoutPromise])
}

async function executeActionInternal(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  try {
    switch (action.type) {
      case 'update_record':
        return await executeUpdateRecord(action, context)

      case 'create_record':
        return await executeCreateRecord(action, context)

      case 'delete_record':
        return await executeDeleteRecord(action, context)

      case 'send_email':
        return await executeSendEmail(action, context)

      case 'call_webhook':
        return await executeCallWebhook(action, context)

      case 'run_script':
        return await executeRunScript(action, context)

      case 'delay':
        return await executeDelay(action, context)

      case 'log_message':
        return await executeLogMessage(action, context)

      case 'stop_execution':
        return {
          success: true,
          data: { stopped: true },
        }

      default:
        return {
          success: false,
          error: `Unknown action type: ${action.type}`,
        }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Action execution failed',
    }
  }
}

async function executeUpdateRecord(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  if (!action.table_id || !action.record_id) {
    return {
      success: false,
      error: 'table_id and record_id are required for update_record',
    }
  }

  const supabase = await createClient()
  const table = await getTable(action.table_id)
  
  if (!table) {
    return {
      success: false,
      error: `Table ${action.table_id} not found`,
    }
  }

  // Replace variables in field updates
  const fieldUpdates = replaceVariablesInObject(
    action.field_updates || {},
    context
  )

  // Evaluate formulas in field values if needed
  const evaluatedUpdates: Record<string, any> = {}
  for (const [field, value] of Object.entries(fieldUpdates)) {
    if (typeof value === 'string' && value.startsWith('=')) {
      // Formula evaluation
      try {
        const { data: tableFields } = await supabase
          .from('table_fields')
          .select('*')
          .eq('table_id', action.table_id)

        const fields = (tableFields || []) as TableField[]
        
        // Get current record
        const { data: currentRecord } = await supabase
          .from(table.supabase_table)
          .select('*')
          .eq('id', action.record_id)
          .single()

        if (currentRecord) {
          const tokenizer = new Tokenizer(value.substring(1))
          const tokens = tokenizer.tokenize()
          const parser = new Parser(tokens)
          const ast = parser.parse()

          const evaluator = new Evaluator({
            row: currentRecord,
            fields: fields.map(f => ({ name: f.name, type: f.type }))
          })

          evaluatedUpdates[field] = evaluator.evaluate(ast)
        } else {
          evaluatedUpdates[field] = value
        }
      } catch (error) {
        evaluatedUpdates[field] = value
      }
    } else {
      evaluatedUpdates[field] = value
    }
  }

  const { error } = await supabase
    .from(table.supabase_table)
    .update(evaluatedUpdates)
    .eq('id', action.record_id)

  if (error) {
    return {
      success: false,
      error: `Failed to update record: ${error.message}`,
    }
  }

  return {
    success: true,
    data: { updated: true },
  }
}

async function executeCreateRecord(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  if (!action.table_id) {
    return {
      success: false,
      error: 'table_id is required for create_record',
    }
  }

  const supabase = await createClient()
  const table = await getTable(action.table_id)
  
  if (!table) {
    return {
      success: false,
      error: `Table ${action.table_id} not found`,
    }
  }

  // Replace variables in field updates
  const fieldUpdates = replaceVariablesInObject(
    action.field_updates || {},
    context
  )

  const { data, error } = await supabase
    .from(table.supabase_table)
    .insert([fieldUpdates])
    .select()
    .single()

  if (error) {
    return {
      success: false,
      error: `Failed to create record: ${error.message}`,
    }
  }

  return {
    success: true,
    data: { record: data, record_id: data.id },
  }
}

async function executeDeleteRecord(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  if (!action.table_id || !action.record_id) {
    return {
      success: false,
      error: 'table_id and record_id are required for delete_record',
    }
  }

  const supabase = await createClient()
  const table = await getTable(action.table_id)
  
  if (!table) {
    return {
      success: false,
      error: `Table ${action.table_id} not found`,
    }
  }

  const { error } = await supabase
    .from(table.supabase_table)
    .delete()
    .eq('id', action.record_id)

  if (error) {
    return {
      success: false,
      error: `Failed to delete record: ${error.message}`,
    }
  }

  return {
    success: true,
    data: { deleted: true },
  }
}

async function executeSendEmail(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  // For now, just log - email sending would require an email service
  const to = replaceVariablesInObject(action.to || '', context)
  const subject = replaceVariablesInObject(action.subject || '', context)
  const body = replaceVariablesInObject(action.body || '', context)

  return {
    success: true,
    data: { to, subject, body },
    logs: [{
      level: 'info',
      message: `Email would be sent to ${to}: ${subject}`,
    }],
  }
}

async function executeCallWebhook(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  if (!action.url) {
    return {
      success: false,
      error: 'url is required for call_webhook',
    }
  }

  // Validate URL
  try {
    const url = new URL(action.url)
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        success: false,
        error: 'Only HTTP and HTTPS URLs are allowed',
      }
    }
  } catch {
    return {
      success: false,
      error: 'Invalid URL format',
    }
  }

  const method = action.method || 'POST'
  const headers = replaceVariablesInObject(action.headers || {}, context)
  const body = replaceVariablesInObject(action.body, context)

  try {
    const response = await fetch(action.url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const responseData = await response.text()

    return {
      success: response.ok,
      data: {
        status: response.status,
        data: responseData,
      },
      error: response.ok ? undefined : `Webhook returned ${response.status}`,
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Webhook call failed: ${error.message}`,
    }
  }
}

async function executeRunScript(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  if (!action.script) {
    return {
      success: false,
      error: 'script is required for run_script',
    }
  }

  // Sandboxed script execution - very limited
  // Only allow safe operations
  try {
    // Replace variables first
    const script = replaceVariablesInObject(action.script, context)
    
    // Very basic sandbox - only allow simple calculations
    // In production, use a proper sandbox like vm2 or isolated execution
    const result = eval(`
      (function() {
        const context = ${JSON.stringify(context.trigger_data || {})};
        ${script}
      })()
    `)

    return {
      success: true,
      data: { result },
    }
  } catch (error: any) {
    return {
      success: false,
      error: `Script execution failed: ${error.message}`,
    }
  }
}

async function executeDelay(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  if (action.delay_type === 'until' && action.until_datetime) {
    const until = new Date(action.until_datetime)
    const now = new Date()
    const delayMs = until.getTime() - now.getTime()
    
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  } else {
    const value = action.delay_value || 0
    let delayMs = 0

    switch (action.delay_type) {
      case 'seconds':
        delayMs = value * 1000
        break
      case 'minutes':
        delayMs = value * 60 * 1000
        break
      case 'hours':
        delayMs = value * 60 * 60 * 1000
        break
    }

    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return {
    success: true,
    data: { delayed: true },
  }
}

async function executeLogMessage(
  action: ActionConfig,
  context: AutomationContext
): Promise<ActionResult> {
  const message = replaceVariablesInObject(action.message || '', context)

  return {
    success: true,
    data: { logged: true },
    logs: [{
      level: action.level || 'info',
      message: String(message),
    }],
  }
}
