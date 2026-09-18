import { describe, expect, it, vi } from 'vitest'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppConversation } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { createFakeWhatsAppMessage } from '@/src/__tests__/factories/whatsapp-message.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/whatsapp-conversation.repository')
vi.mock('@/src/repositories/whatsapp-message.repository')
vi.mock('@/src/lib/whatsapp/media', () => ({
  downloadRemoteMediaToStorage: vi.fn(),
  resolveInboundMediaSource: vi.fn(),
}))
vi.mock('@/src/lib/whatsapp/realtime', () => ({
  publishWhatsAppEvent: vi.fn(async () => undefined),
}))

import { storageError } from '@/src/errors'
import {
  downloadRemoteMediaToStorage,
  resolveInboundMediaSource,
} from '@/src/lib/whatsapp/media'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'
import { WhatsAppMediaService } from '../whatsapp-media.service'

const mockedMessageRepo = vi.mocked(WhatsAppMessageRepository)
const mockedConversationRepo = vi.mocked(WhatsAppConversationRepository)
const mockedDownload = vi.mocked(downloadRemoteMediaToStorage)
const mockedResolve = vi.mocked(resolveInboundMediaSource)

function arrange() {
  mockedMessageRepo.findById.mockResolvedValue(
    ok(
      createFakeWhatsAppMessage({
        id: 'm1',
        workspaceId: 'ws1',
        conversationId: 'conv1',
        type: 'IMAGE',
        mediaUrl: 'meta-media-id',
      }),
    ),
  )
  mockedConversationRepo.findByIdWithConnection.mockResolvedValue(
    ok({
      ...createFakeWhatsAppConversation({ id: 'conv1' }),
      connection: createFakeWhatsAppConnection({ provider: 'META' }),
    }),
  )
}

describe('WhatsAppMediaService.downloadInboundMedia()', () => {
  it('should skip messages without media', async () => {
    mockedMessageRepo.findById.mockResolvedValue(
      ok(createFakeWhatsAppMessage({ mediaUrl: null })),
    )
    expect(
      expectOk(await WhatsAppMediaService.downloadInboundMedia('m1')),
    ).toEqual({ status: 'skipped', reason: 'no_media' })
  })

  it('should skip when the conversation is gone', async () => {
    arrange()
    mockedConversationRepo.findByIdWithConnection.mockResolvedValue(ok(null))
    expect(
      expectOk(await WhatsAppMediaService.downloadInboundMedia('m1')),
    ).toEqual({ status: 'skipped', reason: 'conversation_missing' })
  })

  it('should store the media, update the message and publish the change', async () => {
    arrange()
    mockedResolve.mockResolvedValue({
      url: 'https://lookaside.fbsbx.com/x',
      headers: { Authorization: 'Bearer t' },
    })
    mockedDownload.mockResolvedValue(
      ok({ url: 'https://cdn/media/ws1/a.jpg', contentType: 'image/jpeg' }),
    )
    mockedMessageRepo.update.mockResolvedValue(
      ok(createFakeWhatsAppMessage({ id: 'm1' })),
    )

    const outcome = expectOk(
      await WhatsAppMediaService.downloadInboundMedia('m1'),
    )

    expect(outcome).toEqual({
      status: 'downloaded',
      url: 'https://cdn/media/ws1/a.jpg',
    })
    expect(mockedDownload).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      url: 'https://lookaside.fbsbx.com/x',
      headers: { Authorization: 'Bearer t' },
    })
    expect(mockedMessageRepo.update).toHaveBeenCalledWith('m1', {
      mediaUrl: 'https://cdn/media/ws1/a.jpg',
    })
    expect(publishWhatsAppEvent).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ type: 'message.updated' }),
    )
  })

  it('should return WHATSAPP_PROVIDER_ERROR when the provider lookup fails', async () => {
    arrange()
    mockedResolve.mockRejectedValue(new Error('Meta 500'))

    expectErr(
      await WhatsAppMediaService.downloadInboundMedia('m1'),
      'WHATSAPP_PROVIDER_ERROR',
    )
  })

  it('should propagate storage failures', async () => {
    arrange()
    mockedResolve.mockResolvedValue({ url: 'https://x' })
    mockedDownload.mockResolvedValue(err(storageError('down')))

    expectErr(
      await WhatsAppMediaService.downloadInboundMedia('m1'),
      'STORAGE_ERROR',
    )
    expect(mockedMessageRepo.update).not.toHaveBeenCalled()
  })
})
