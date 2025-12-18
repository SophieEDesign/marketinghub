import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { executeAutomation } from '@/lib/automations/engine'
import type { Automation } from '@/types/database'

/**
 * Webhook endpoint for triggering automations
 * POST /api/hooks/[id]
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()

    // Find automation with matching webhook_id
    const { data: automations, error } = await supabase
      .from('automations')
      .select('*')
      .eq('enabled', true)
      .eq('trigger_type', 'webhook')
      .contains('trigger_config', { webhook_id: params.id })

    if (error) {
      return NextResponse.json(
        { error: `Failed to find automation: ${error.message}` },
        { status: 500 }
      )
    }

    if (!automations || automations.length === 0) {
      return NextResponse.json(
        { error: 'No automation found for this webhook ID' },
        { status: 404 }
      )
    }

    // Get request payload
    const payload = await request.json().catch(() => ({}))
    const headers = Object.fromEntries(request.headers.entries())

    // Execute each matching automation
    const results = []
    for (const automation of automations as Automation[]) {
      const result = await executeAutomation(automation, {
        payload,
        headers,
      })

      results.push({
        automation_id: automation.id,
        automation_name: automation.name,
        success: result.success,
        run_id: result.runId,
        error: result.error,
      })
    }

    return NextResponse.json({
      success: true,
      executed: results.length,
      results,
    })
  } catch (error: any) {
    console.error('Error handling webhook:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to handle webhook',
      },
      { status: 500 }
    )
  }
}
