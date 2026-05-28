import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.fn()

vi.mock('resend', () => {
  return {
    Resend: vi.fn().mockImplementation(() => ({
      emails: {
        send: sendMock,
      },
    })),
  }
})

describe('executeAction send_email', () => {
  beforeEach(() => {
    sendMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends email successfully through provider', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@example.com')
    sendMock.mockResolvedValue({ data: { id: 'msg_123' }, error: null })

    const { executeAction } = await import('@/lib/automations/actions')
    const result = await executeAction(
      {
        type: 'send_email',
        to: 'person@example.com',
        subject: 'Automation test',
        email_body: 'Body text',
      },
      {
        automation_id: 'automation_1',
        trigger_type: 'row_updated',
      }
    )

    expect(result.success).toBe(true)
    expect(result.data?.provider).toBe('resend')
    expect(result.data?.provider_message_id).toBe('msg_123')
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('fails fast when provider configuration is missing', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    const { executeAction } = await import('@/lib/automations/actions')
    const result = await executeAction(
      {
        type: 'send_email',
        to: 'person@example.com',
        subject: 'Automation test',
        email_body: 'Body text',
      },
      {
        automation_id: 'automation_1',
        trigger_type: 'row_updated',
      }
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('RESEND_API_KEY')
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('returns provider error when request is rejected', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    sendMock.mockResolvedValue({
      data: null,
      error: { message: 'Domain not verified' },
    })

    const { executeAction } = await import('@/lib/automations/actions')
    const result = await executeAction(
      {
        type: 'send_email',
        to: 'person@example.com',
        subject: 'Automation test',
        email_body: 'Body text',
      },
      {
        automation_id: 'automation_1',
        trigger_type: 'row_updated',
      }
    )

    expect(result.success).toBe(false)
    expect(result.error).toContain('Domain not verified')
    expect(result.logs?.[0]?.level).toBe('error')
  })

  it('interpolates variables before sending', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-key')
    sendMock.mockResolvedValue({ data: { id: 'msg_456' }, error: null })

    const { executeAction } = await import('@/lib/automations/actions')
    const result = await executeAction(
      {
        type: 'send_email',
        to: '{{email}}',
        subject: 'Status: {{status}}',
        email_body: 'Record {{record_id}} for {{name}}',
      },
      {
        automation_id: 'automation_1',
        trigger_type: 'row_updated',
        record_id: 'record_99',
        trigger_data: {
          email: 'dynamic@example.com',
          status: 'approved',
          name: 'Sophie',
        },
      }
    )

    expect(result.success).toBe(true)
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['dynamic@example.com'],
        subject: 'Status: approved',
      })
    )
    expect((sendMock.mock.calls[0]?.[0]?.html as string) || '').toContain('Record record_99 for Sophie')
  })
})
