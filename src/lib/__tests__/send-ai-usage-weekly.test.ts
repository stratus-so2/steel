import { beforeEach, describe, expect, it, vi } from 'vitest'

const { resendSend, consume, loggerMock, env } = vi.hoisted(() => ({
  resendSend: vi.fn(),
  consume: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  env: { MAIL_DRY_RUN: 'true' as string, NODE_ENV: 'production' as string },
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/env/server', () => ({
  get MAIL_DRY_RUN() {
    return env.MAIL_DRY_RUN
  },
}))
vi.mock('@/lib/env/env', () => ({
  get NODE_ENV() {
    return env.NODE_ENV
  },
  NEXT_PUBLIC_URL: 'https://steel.test',
}))
vi.mock('@/src/lib/mail/client', () => ({
  resend: { emails: { send: resendSend } },
  defaultFrom: 'Steel <notificacoes@stratustelecom.com.br>',
}))
vi.mock('@/src/lib/rate-limit', () => ({ consume, emailLimiter: {} }))

import { AiUsageWeekly } from '@/components/emails/steel-ai/ai-usage-weekly'

const props = AiUsageWeekly.PreviewProps

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  consume.mockResolvedValue({ ok: true, value: undefined })
  resendSend.mockResolvedValue({ data: { id: 'resend-1' }, error: null })
})

async function load() {
  return import('@/src/lib/mail/steel-ai/send-ai-usage-weekly')
}

describe('sendAiUsageWeeklyEmail', () => {
  it('names the workspace and the UTC week in the subject', async () => {
    const { aiUsageWeeklySubject } = await load()
    expect(aiUsageWeeklySubject(props)).toBe(
      'Consumo do Steel AI em Stratus — semana 28/09 – 04/10',
    )
  })

  it('does not reach Resend under MAIL_DRY_RUN', async () => {
    env.MAIL_DRY_RUN = 'true'
    const { sendAiUsageWeeklyEmail } = await load()

    const result = await sendAiUsageWeeklyEmail({
      ...props,
      email: 'owner@stratustelecom.com.br',
    })

    expect(result.id).toMatch(/^dry-run-/)
    expect(resendSend).not.toHaveBeenCalled()
    expect(loggerMock.info).toHaveBeenCalledWith(
      'email_dry_run',
      expect.objectContaining({ recipient: 'owner@stratustelecom.com.br' }),
    )
  })

  it('sends through Resend to the owner when dry run is off', async () => {
    env.MAIL_DRY_RUN = 'false'
    const { sendAiUsageWeeklyEmail } = await load()

    await sendAiUsageWeeklyEmail({
      ...props,
      email: 'owner@stratustelecom.com.br',
    })

    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['owner@stratustelecom.com.br'],
        subject: 'Consumo do Steel AI em Stratus — semana 28/09 – 04/10',
      }),
    )
  })
})
