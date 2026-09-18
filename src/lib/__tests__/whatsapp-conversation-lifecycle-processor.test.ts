import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { closeInactiveMock, loggerMock } = vi.hoisted(() => ({
  closeInactiveMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/whatsapp-conversation.service', () => ({
  WhatsAppConversationService: { closeInactive: closeInactiveMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processWhatsappConversationLifecycle } from '@/src/lib/queue/processors/whatsapp-conversation-lifecycle'

function fakeJob(name = 'auto-close-inactive'): Job {
  return { id: 'job-1', name, data: {} } as unknown as Job
}

describe('processWhatsappConversationLifecycle', () => {
  it('delegates to WhatsAppConversationService.closeInactive', async () => {
    closeInactiveMock.mockResolvedValue({ ok: true, value: { closed: 3 } })

    const result = await processWhatsappConversationLifecycle(fakeJob())

    expect(result).toEqual({ closed: 3 })
    expect(closeInactiveMock).toHaveBeenCalledWith(expect.any(Date))
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_conversation_lifecycle.auto_close_completed',
      expect.objectContaining({ closed: 3 }),
    )
  })

  it('throws on failure so BullMQ retries', async () => {
    closeInactiveMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    await expect(
      processWhatsappConversationLifecycle(fakeJob()),
    ).rejects.toThrow('DATABASE_ERROR')
  })

  it('rejects unknown job names', async () => {
    await expect(
      processWhatsappConversationLifecycle(fakeJob('nope')),
    ).rejects.toThrow('Unknown whatsapp-conversation-lifecycle job')
  })
})
