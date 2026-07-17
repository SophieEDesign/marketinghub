import { createClient } from '@/lib/supabase/server'
import { shouldRunScheduled } from './triggers'
import { executeAutomation } from './engine'
import type { Automation } from '@/types/database'

/**
 * Find and execute scheduled automations that should run
 */
export async function runScheduledAutomations(): Promise<{
  executed: number
  errors: string[]
}> {
  const supabase = await createClient()
  const errors: string[] = []
  let executed = 0

  try {
    // Get all enabled automations with schedule triggers
    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('enabled', true)
      .eq('trigger_type', 'schedule')

    if (error) {
      console.error('Error loading scheduled automations:', error)
      return { executed: 0, errors: [error.message] }
    }

    if (!automations || automations.length === 0) {
      return { executed: 0, errors: [] }
    }

    // Check each automation
    for (const automation of automations as Automation[]) {
      try {
        // Get last run
        const { data: lastRun } = await supabase
          .from('automation_runs')
          .select('started_at')
          .eq('automation_id', automation.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1)
          .single()

        const lastRunTime = lastRun?.started_at

        // Check if should run
        if (shouldRunScheduled(automation.trigger_config || {}, lastRunTime)) {
          // Execute automation
          const result = await executeAutomation(automation, {})
          
          if (result.success) {
            executed++
          } else {
            errors.push(`Automation ${automation.name}: ${result.error}`)
          }
        }
      } catch (error: any) {
        errors.push(`Automation ${automation.name}: ${error.message}`)
      }
    }

    return { executed, errors }
  } catch (error: any) {
    return {
      executed: 0,
      errors: [error.message || 'Failed to run scheduled automations'],
    }
  }
}
