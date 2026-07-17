import { createClient } from '@/lib/supabase/server'
import type { TriggerType, TriggerConfig, AutomationContext } from './types'
import { Tokenizer } from '@/lib/formulas/tokenizer'
import { Parser } from '@/lib/formulas/parser'
import { Evaluator } from '@/lib/formulas/evaluator'
import type { TableField } from '@/types/fields'

export interface TriggerEvaluationResult {
  shouldRun: boolean
  context?: AutomationContext
}

/**
 * Evaluate if a trigger should fire
 */
export async function evaluateTrigger(
  triggerType: TriggerType,
  triggerConfig: TriggerConfig,
  eventData?: Record<string, any>
): Promise<TriggerEvaluationResult> {
  switch (triggerType) {
    case 'row_created':
      return {
        shouldRun: true,
        context: {
          automation_id: '', // Will be set by engine
          trigger_type: triggerType,
          trigger_data: eventData?.record || {},
          table_id: triggerConfig.table_id,
          record_id: eventData?.record?.id,
        }
      }

    case 'row_updated':
      // Check if watched fields changed
      if (triggerConfig.watch_fields && triggerConfig.watch_fields.length > 0) {
        const oldRecord = eventData?.old_record || {}
        const newRecord = eventData?.record || {}
        
        const fieldsChanged = triggerConfig.watch_fields.some(field => {
          return oldRecord[field] !== newRecord[field]
        })

        if (!fieldsChanged) {
          return { shouldRun: false }
        }
      }

      return {
        shouldRun: true,
        context: {
          automation_id: '',
          trigger_type: triggerType,
          trigger_data: {
            old: eventData?.old_record || {},
            new: eventData?.record || {},
            ...(eventData?.record || {})
          },
          table_id: triggerConfig.table_id,
          record_id: eventData?.record?.id,
        }
      }

    case 'row_deleted':
      return {
        shouldRun: true,
        context: {
          automation_id: '',
          trigger_type: triggerType,
          trigger_data: eventData?.record || {},
          table_id: triggerConfig.table_id,
          record_id: eventData?.record?.id,
        }
      }

    case 'schedule':
      // Schedule evaluation is done by scheduler
      return {
        shouldRun: true,
        context: {
          automation_id: '',
          trigger_type: triggerType,
          trigger_data: {},
        }
      }

    case 'webhook':
      return {
        shouldRun: true,
        context: {
          automation_id: '',
          trigger_type: triggerType,
          trigger_data: eventData?.payload || {},
        }
      }

    case 'condition':
      // Evaluate formula condition
      if (!triggerConfig.formula) {
        return { shouldRun: false }
      }

      try {
        const supabase = await createClient()
        
        // Get table fields for context
        let fields: TableField[] = []
        if (triggerConfig.table_id) {
          const { data: tableFields } = await supabase
            .from('table_fields')
            .select('*')
            .eq('table_id', triggerConfig.table_id)
          
          fields = (tableFields || []) as TableField[]
        }

        // Evaluate formula
        const tokenizer = new Tokenizer(triggerConfig.formula)
        const tokens = tokenizer.tokenize()
        const parser = new Parser(tokens)
        const ast = parser.parse()

        const evaluator = new Evaluator({
          row: eventData?.record || {},
          fields: fields.map(f => ({ name: f.name, type: f.type }))
        })

        const result = evaluator.evaluate(ast)
        const shouldRun = Boolean(result) && result !== '#ERROR!' && result !== '#FIELD!'

        return {
          shouldRun,
          context: {
            automation_id: '',
            trigger_type: triggerType,
            trigger_data: eventData?.record || {},
            table_id: triggerConfig.table_id,
            record_id: eventData?.record?.id,
          }
        }
      } catch (error) {
        console.error('Error evaluating condition trigger:', error)
        return { shouldRun: false }
      }

    default:
      return { shouldRun: false }
  }
}

/**
 * Check if a scheduled automation should run now
 */
export function shouldRunScheduled(
  triggerConfig: TriggerConfig,
  lastRun?: string
): boolean {
  if (!triggerConfig.interval) {
    return false
  }

  const now = new Date()
  const lastRunDate = lastRun ? new Date(lastRun) : null

  switch (triggerConfig.interval) {
    case 'minute':
      if (!lastRunDate) return true
      const minutesSince = (now.getTime() - lastRunDate.getTime()) / (1000 * 60)
      return minutesSince >= (triggerConfig.interval_value || 1)

    case 'hour':
      if (!lastRunDate) return true
      const hoursSince = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60)
      return hoursSince >= (triggerConfig.interval_value || 1)

    case 'day':
      if (!lastRunDate) return true
      const daysSince = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince < 1) return false
      
      // Check time if specified
      if (triggerConfig.time) {
        const [hours, minutes] = triggerConfig.time.split(':').map(Number)
        const targetTime = new Date(now)
        targetTime.setHours(hours, minutes, 0, 0)
        
        // If we haven't passed the target time today, don't run
        if (now < targetTime) return false
      }
      
      return daysSince >= 1

    case 'week':
      if (!lastRunDate) return true
      const weeksSince = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
      if (weeksSince < 1) return false
      
      // Check day of week if specified
      if (triggerConfig.day_of_week !== undefined) {
        if (now.getDay() !== triggerConfig.day_of_week) return false
      }
      
      return weeksSince >= 1

    case 'month':
      if (!lastRunDate) return true
      const monthsSince = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
      if (monthsSince < 1) return false
      
      // Check day of month if specified
      if (triggerConfig.day_of_month !== undefined) {
        if (now.getDate() !== triggerConfig.day_of_month) return false
      }
      
      return monthsSince >= 1

    default:
      return false
  }
}
