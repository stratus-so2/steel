import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppBroadcastListWithRecipients } from '@/src/__tests__/factories/whatsapp-broadcast.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/src/repositories/whatsapp-broadcast.repository')

const { addBulk } = vi.hoisted(() => ({
  addBulk: vi.fn(async (_jobs: unknown[]) => []),
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getWhatsappBroadcastQueue: vi.fn(() => ({ addBulk })),
}))

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppBroadcastRepository } from '@/src/repositories/whatsapp-broadcast.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppBroadcastService } from '../whatsapp-broadcast.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WhatsAppConnectionRepository)
const mockedBroadcastRepo = vi.mocked(WhatsAppBroadcastRepository)

describe('WhatsAppBroadcastService', () => {
  describe('create()', () => {
    it('should create the broadcast with deduplicated contact ids', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConnectionRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppConnection({ id: 'conn1' })),
      )
      const created = createFakeWhatsAppBroadcastListWithRecipients(
        { id: 'b1' },
        2,
      )
      mockedBroadcastRepo.create.mockResolvedValue(ok(created))

      const result = await WhatsAppBroadcastService.create('u1', 'ws1', {
        connectionId: 'conn1',
        name: 'Promoção',
        messageBody: 'Aproveite!',
        contactIds: ['c1', 'c1', 'c2'],
      })

      expectOk(result)
      expect(mockedBroadcastRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ connectionId: 'conn1', createdById: 'u1' }),
        ['c1', 'c2'],
      )
    })

    it('should return WHATSAPP_CONNECTION_NOT_FOUND for an unknown connection', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConnectionRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppBroadcastService.create('u1', 'ws1', {
        connectionId: 'conn1',
        name: 'Promoção',
        messageBody: 'Aproveite!',
        contactIds: ['c1'],
      })

      expectErr(result, 'WHATSAPP_CONNECTION_NOT_FOUND')
    })
  })

  describe('start()', () => {
    it('should enqueue one staggered job per recipient and mark the list RUNNING', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const draft = createFakeWhatsAppBroadcastListWithRecipients(
        { id: 'b1', status: 'DRAFT' },
        3,
      )
      mockedBroadcastRepo.findById
        .mockResolvedValueOnce(ok(draft))
        .mockResolvedValueOnce(ok({ ...draft, status: 'RUNNING' }))
      mockedBroadcastRepo.updateStatus.mockResolvedValue(ok(undefined))

      const result = await WhatsAppBroadcastService.start('u1', 'ws1', 'b1')

      expectOk(result)
      expect(addBulk).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({ broadcastListId: 'b1' }),
          }),
        ]),
      )
      expect(addBulk.mock.calls[0][0]).toHaveLength(3)
      expect(mockedBroadcastRepo.updateStatus).toHaveBeenCalledWith(
        'b1',
        'RUNNING',
      )
    })

    it('should reject starting a broadcast that already left DRAFT status', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const running = createFakeWhatsAppBroadcastListWithRecipients(
        { id: 'b1', status: 'RUNNING' },
        1,
      )
      mockedBroadcastRepo.findById.mockResolvedValue(ok(running))

      const result = await WhatsAppBroadcastService.start('u1', 'ws1', 'b1')

      expectErr(result, 'WHATSAPP_BROADCAST_LOCKED')
      expect(addBulk).not.toHaveBeenCalled()
    })
  })
})
