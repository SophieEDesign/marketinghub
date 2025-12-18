import { NextResponse } from 'next/server'
import { runScheduledAutomations } from '@/lib/automations/scheduler'

/**
 * API endpoint for Vercel Cron to trigger scheduled automations
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/automations/run-scheduled",
 *     "schedule": "every minute" or use cron syntax
 *   }]
 * }
 */
export async function GET(request: Request) {
  // Verify cron secret if needed
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runScheduledAutomations()

    return NextResponse.json({
      success: true,
      executed: result.executed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error running scheduled automations:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to run scheduled automations',
      },
      { status: 500 }
    )
  }
}
