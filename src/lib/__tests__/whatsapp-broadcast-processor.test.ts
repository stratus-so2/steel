import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { sendMock, tickMock, loggerMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  tickMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/whatsapp-broadcast.service', () => ({
  WhatsAppBroadcastService: {
    sendToRecipient: sendMock,
    enqueueDueScheduledRecipients: tickMock,
  },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processWhatsappBroadcast } from '@/src/lib/queue/processors/whatsapp-broadcast'

function sendJob(): Job {
  return {
    id: 'job-1',
    name: 'send-broadcast-message',
    data: { broadcastListId: 'list1', recipientId: 'r1' },
  } as unknown as Job
}

describe('processWhatsappBroadcast', () => {
  it('delegates a send to WhatsAppBroadcastService.sendToRecipient', async () => {
    sendMock.mockResolvedValue({
      ok: true,
      value: { status: 'sent', providerMessageId: 'wamid' },
    })

    await processWhatsappBroadcast(sendJob())

    expect(sendMock).toHaveBeenCalledWith('list1', 'r1')
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_broadcast.processed',
      expect.objectContaining({ ok: true }),
    )
  })

  it('logs LGPD opt-out skips', async () => {
    sendMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'opted_out' },
    })

    await processWhatsappBroadcast(sendJob())

    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_broadcast.skipped_opted_out',
      expect.anything(),
    )
  })

  it('logs failed sends without throwing', async () => {
    sendMock.mockResolvedValue({
      ok: true,
      value: { status: 'failed', reason: 'WHATSAPP_PROVIDER_ERROR' },
    })

    await expect(processWhatsappBroadcast(sendJob())).resolves.toBeUndefined()
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_broadcast.processed',
      expect.objectContaining({ ok: false }),
    )
  })

  it('throws on database errors so BullMQ retries', async () => {
    sendMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    await expect(processWhatsappBroadcast(sendJob())).rejects.toThrow(
      'DATABASE_ERROR',
    )
  })

  it('runs the schedule tick through the service', async () => {
    tickMock.mockResolvedValue({ ok: true, value: { due: 2 } })

    await processWhatsappBroadcast({
      id: 'job-2',
      name: 'run-schedule-tick',
      data: {},
    } as unknown as Job)

    expect(tickMock).toHaveBeenCalledWith(expect.any(Date))
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_broadcast.tick_completed',
      expect.objectContaining({ due: 2 }),
    )
  })

  it('rejects unknown job names', async () => {
    await expect(
      processWhatsappBroadcast({ id: 'x', name: 'nope' } as unknown as Job),
    ).rejects.toThrow('Unknown whatsapp-broadcast job')
  })
})
