import { NextResponse } from 'next/server'
import { runScheduledAutomations } from '@/lib/automations/scheduler'

/**
 * API endpoint for Vercel Cron to trigger scheduled automations.
 * Exempt from session middleware - auth via CRON_SECRET bearer token only.
 *
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/automations/run-scheduled",
 *     "schedule": "every minute" or use cron syntax
 *   }]
 * }
 *
 * Production: Set CRON_SECRET in Vercel env. Vercel adds "Authorization: Bearer <CRON_SECRET>"
 * to cron requests automatically when CRON_SECRET is configured.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isProd = process.env.NODE_ENV === 'production'

  if (isProd) {
    if (!cronSecret) {
      console.error('[run-scheduled] CRON_SECRET must be set in production')
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
