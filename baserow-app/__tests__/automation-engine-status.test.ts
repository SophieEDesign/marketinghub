import { describe, expect, it, vi, beforeEach } from 'vitest'

const evaluateTriggerMock = vi.fn()
const executeActionMock = vi.fn()

const runUpdates: Array<Record<string, any>> = []

function makeSupabaseMock() {
  return {
    from: (tableName: string) => {
      if (tableName === 'automation_runs') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: 'run_1' },
                error: null,
              }),
            }),
          }),
          update: (payload: Record<string, any>) => {
            runUpdates.push(payload)
            return {
              eq: async () => ({ data: null, error: null }),
            }
          },
        }
      }

      if (tableName === 'automation_logs') {
        return {
          insert: async () => ({ data: null, error: null }),
        }
      }

      if (tableName === 'table_fields') {
        return {
          select: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${tableName}`)
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => makeSupabaseMock()),
}))

vi.mock('@/lib/automations/triggers', () => ({
  evaluateTrigger: evaluateTriggerMock,
}))

vi.mock('@/lib/automations/actions', () => ({
  executeAction: executeActionMock,
}))

describe('executeAutomation final run status', () => {
  beforeEach(() => {
    runUpdates.length = 0
    evaluateTriggerMock.mockReset()
    executeActionMock.mockReset()
  })

  it('marks run completed when all actions succeed', async () => {
    evaluateTriggerMock.mockResolvedValue({
      shouldRun: true,
      context: {
        trigger_type: 'row_updated',
        trigger_data: {},
      },
    })
    executeActionMock.mockResolvedValue({
      success: true,
      data: {},
      logs: [],
    })

    const { executeAutomation } = await import('@/lib/automations/engine')
    const result = await executeAutomation(
      {
        id: 'automation_1',
        trigger_type: 'row_updated',
        trigger_config: {},
        conditions: [],
        actions: [{ type: 'log_message', message: 'ok' }],
      } as any,
      {}
    )

    expect(result.success).toBe(true)
    expect(runUpdates.at(-1)?.status).toBe('completed')
  })

  it('marks run failed when an action fails', async () => {
    evaluateTriggerMock.mockResolvedValue({
      shouldRun: true,
      context: {
        trigger_type: 'row_updated',
        trigger_data: {},
      },
    })
    executeActionMock.mockResolvedValue({
      success: false,
      error: 'provider down',
      logs: [],
    })

    const { executeAutomation } = await import('@/lib/automations/engine')
    const result = await executeAutomation(
      {
        id: 'automation_1',
        trigger_type: 'row_updated',
        trigger_config: {},
        conditions: [],
        actions: [{ type: 'send_email', to: 'a@b.com', subject: 'x', email_body: 'y' }],
      } as any,
      {}
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('actions failed')
    expect(runUpdates.at(-1)?.status).toBe('failed')
  })
})
