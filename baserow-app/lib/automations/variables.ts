import type { AutomationContext } from './types'

/**
 * Replace {{variable}} syntax with actual values
 */
export function replaceVariables(
  template: string,
  context: AutomationContext
): string {
  let result = template

  // Replace {{field}} with field values from trigger_data
  if (context.trigger_data) {
    for (const [key, value] of Object.entries(context.trigger_data)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      result = result.replace(regex, String(value ?? ''))
    }
  }

  // Replace {{record_id}}
  if (context.record_id) {
    result = result.replace(/\{\{record_id\}\}/g, context.record_id)
  }

  // Replace custom variables
  if (context.variables) {
    for (const [key, value] of Object.entries(context.variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
      result = result.replace(regex, String(value ?? ''))
    }
  }

  return result
}

/**
 * Replace variables in an object recursively
 */
export function replaceVariablesInObject(
  obj: any,
  context: AutomationContext
): any {
  if (typeof obj === 'string') {
    return replaceVariables(obj, context)
  }

  if (Array.isArray(obj)) {
    return obj.map(item => replaceVariablesInObject(item, context))
  }

  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = replaceVariablesInObject(value, context)
    }
    return result
  }

  return obj
}
