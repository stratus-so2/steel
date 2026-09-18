import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { downloadMock, loggerMock } = vi.hoisted(() => ({
  downloadMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/whatsapp-media.service', () => ({
  WhatsAppMediaService: { downloadInboundMedia: downloadMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processWhatsappMedia } from '@/src/lib/queue/processors/whatsapp-media'

function fakeJob(name = 'download-inbound-media'): Job {
  return { id: 'job-1', name, data: { messageId: 'm1' } } as unknown as Job
}

describe('processWhatsappMedia', () => {
  it('delegates to WhatsAppMediaService.downloadInboundMedia', async () => {
    downloadMock.mockResolvedValue({
      ok: true,
      value: { status: 'downloaded', url: 'https://cdn/x.jpg' },
    })

    await processWhatsappMedia(fakeJob())

    expect(downloadMock).toHaveBeenCalledWith('m1')
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_media.downloaded',
      expect.objectContaining({ messageId: 'm1' }),
    )
  })

  it('logs a skip without throwing', async () => {
    downloadMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'no_media' },
    })

    await expect(processWhatsappMedia(fakeJob())).resolves.toBeUndefined()
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.whatsapp_media.skipped',
      expect.anything(),
    )
  })

  it('throws when the download fails so BullMQ retries', async () => {
    downloadMock.mockResolvedValue({
      ok: false,
      error: { code: 'STORAGE_ERROR', message: 'minio down' },
    })

    await expect(processWhatsappMedia(fakeJob())).rejects.toThrow('minio down')
    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.whatsapp_media.download_failed',
      expect.objectContaining({ reason: 'STORAGE_ERROR' }),
    )
  })

  it('rejects unknown job names', async () => {
    await expect(processWhatsappMedia(fakeJob('nope'))).rejects.toThrow(
      'Unknown whatsapp-media job',
    )
  })

  it('warns when the conversation disappeared before the download', async () => {
    downloadMock.mockResolvedValue({
      ok: true,
      value: { status: 'skipped', reason: 'conversation_missing' },
    })

    await processWhatsappMedia(fakeJob())

    expect(loggerMock.warn).toHaveBeenCalledWith(
      'queue.whatsapp_media.conversation_missing',
      expect.objectContaining({ messageId: 'm1' }),
    )
  })

  it('reports an unknown id for unknown jobs without an id', async () => {
    await expect(
      processWhatsappMedia({ name: 'nope' } as unknown as Job),
    ).rejects.toThrow('Unknown whatsapp-media job: nope (id=unknown)')
  })
})
