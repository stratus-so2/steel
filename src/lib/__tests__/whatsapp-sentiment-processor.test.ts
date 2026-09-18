import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { analyzeMock, loggerMock } = vi.hoisted(() => ({
  analyzeMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/whatsapp-sentiment.service', () => ({
  WhatsAppSentimentService: { analyzeMessage: analyzeMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processWhatsappSentiment } from '@/src/lib/queue/processors/whatsapp-sentiment'

function fakeJob(name = 'analyze-message'): Job {
  return { id: 'job-1', name, data: { messageId: 'm1' } } as unknown as Job
}

describe('processWhatsappSentiment', () => {
  it('delegates to WhatsAppSentimentService.analyzeMessage', async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      value: {
        status: 'classified',
        sentiment: 'POSITIVE',
        score: 0.9,
        conversationId: 'c1',
        workspaceId: 'ws1',
        avgSentimentScore: 0.9,
      },
    })

    await processWhatsappSentiment(fakeJob())

    expect(analyzeMock).toHaveBeenCalledWith('m1')
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_sentiment.classified',
      expect.objectContaining({ sentiment: 'POSITIVE' }),
    )
  })

  it('logs quota skips as warnings', async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'ai_quota_exceeded' },
    })

    await processWhatsappSentiment(fakeJob())

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'queue.whatsapp_sentiment.skipped',
      expect.objectContaining({ reason: 'ai_quota_exceeded' }),
    )
  })

  it('logs provider failures without throwing', async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      value: {
        status: 'failed',
        reason: 'provider_failed',
        detail: 'x',
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    })

    await expect(processWhatsappSentiment(fakeJob())).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.whatsapp_sentiment.provider_failed',
      expect.anything(),
    )
  })

  it('throws on database errors so BullMQ retries', async () => {
    analyzeMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    await expect(processWhatsappSentiment(fakeJob())).rejects.toThrow(
      'DATABASE_ERROR',
    )
  })

  it('rejects unknown job names', async () => {
    await expect(processWhatsappSentiment(fakeJob('nope'))).rejects.toThrow(
      'Unknown whatsapp-sentiment job',
    )
  })
})
