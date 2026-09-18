import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { generateReplyMock, loggerMock } = vi.hoisted(() => ({
  generateReplyMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/whatsapp-ai-reply.service', () => ({
  WhatsAppAiReplyService: { generateReply: generateReplyMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processWhatsappAiReply } from '@/src/lib/queue/processors/whatsapp-ai-reply'

function fakeJob(name = 'generate-ai-reply'): Job {
  return {
    id: 'job-1',
    name,
    data: { conversationId: 'conv1', messageId: 'm1' },
  } as unknown as Job
}

describe('processWhatsappAiReply', () => {
  it('delegates to WhatsAppAiReplyService.generateReply with the job payload', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'sent', messageId: 'out1', handoff: false },
    })

    await processWhatsappAiReply(fakeJob())

    expect(generateReplyMock).toHaveBeenCalledWith({
      conversationId: 'conv1',
      messageId: 'm1',
    })
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.sent',
      expect.objectContaining({ conversationId: 'conv1' }),
    )
  })

  it('logs the handoff when the AI transferred to a human', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'sent', messageId: 'out1', handoff: true },
    })

    await processWhatsappAiReply(fakeJob())

    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.handoff',
      expect.anything(),
    )
  })

  it('logs quota skips as warnings and does not throw', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'ai_quota_exceeded' },
    })

    await expect(processWhatsappAiReply(fakeJob())).resolves.toBeUndefined()
    expect(loggerMock.warn).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.skipped',
      expect.objectContaining({ reason: 'ai_quota_exceeded' }),
    )
  })

  it('logs ordinary skips as info', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'ai_inactive' },
    })

    await processWhatsappAiReply(fakeJob())

    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.skipped',
      expect.objectContaining({ reason: 'ai_inactive' }),
    )
  })

  it('logs provider failures without throwing (no retry)', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: {
        status: 'failed',
        reason: 'provider_failed',
        detail: 'boom',
        provider: 'openai',
        model: 'gpt-4o-mini',
      },
    })

    await processWhatsappAiReply(fakeJob())

    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.provider_failed',
      expect.objectContaining({ message: 'boom', provider: 'openai' }),
    )
  })

  it('throws on database errors so BullMQ retries', async () => {
    generateReplyMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'db down' },
    })

    await expect(processWhatsappAiReply(fakeJob())).rejects.toThrow(
      'DATABASE_ERROR',
    )
  })

  it('rejects unknown job names', async () => {
    await expect(processWhatsappAiReply(fakeJob('nope'))).rejects.toThrow(
      'Unknown whatsapp-ai-reply job',
    )
  })

  it('warns about empty completions', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'empty_completion' },
    })

    await processWhatsappAiReply(fakeJob())

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.empty_completion',
      expect.objectContaining({ conversationId: 'conv1' }),
    )
  })

  it('logs send failures (not provider failures) with the detail', async () => {
    generateReplyMock.mockResolvedValue({
      ok: true,
      value: { status: 'failed', reason: 'send_failed', detail: 'meta 500' },
    })

    await expect(processWhatsappAiReply(fakeJob())).resolves.toBeUndefined()
    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.whatsapp_ai_reply.send_failed',
      expect.objectContaining({ reason: 'meta 500' }),
    )
  })

  it('reports an unknown id for unknown jobs without an id', async () => {
    await expect(
      processWhatsappAiReply({ name: 'nope', data: {} } as unknown as Job),
    ).rejects.toThrow('Unknown whatsapp-ai-reply job: nope (id=unknown)')
  })
})
