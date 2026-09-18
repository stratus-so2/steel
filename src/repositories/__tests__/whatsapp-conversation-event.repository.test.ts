import { describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppConversationEventRepository } from '../whatsapp-conversation-event.repository'

let counter = 0

async function seedConversation() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  counter += 1
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'ZAPI',
      label: 'Suporte',
      phoneNumber: '5511999999999',
      zapiInstanceId: `event-instance-${counter}`,
      encryptedZapiToken: 'enc:token',
      createdById: user.id,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: { workspaceId: workspace.id, waId: '5511988887777', name: 'Maria' },
  })
  const conversation = await prisma.whatsAppConversation.create({
    data: {
      workspaceId: workspace.id,
      connectionId: connection.id,
      contactId: contact.id,
    },
  })
  return { workspace, user, conversation }
}

describe('WhatsAppConversationEventRepository', () => {
  describe('create()', () => {
    it('should persist an event with its actor', async () => {
      const { workspace, user, conversation } = await seedConversation()

      const event = expectOk(
        await WhatsAppConversationEventRepository.create({
          workspaceId: workspace.id,
          conversationId: conversation.id,
          kind: 'CLOSED',
          source: 'AGENT',
          actorUserId: user.id,
          reason: 'resolvido',
        }),
      )
      expect(event.kind).toBe('CLOSED')
      expect(event.actorUserId).toBe(user.id)
    })

    it('should return DATABASE_ERROR when the conversation does not exist', async () => {
      const workspace = await seedWorkspace()
      expectErr(
        await WhatsAppConversationEventRepository.create({
          workspaceId: workspace.id,
          conversationId: 'missing',
          kind: 'REOPENED',
          source: 'CONTACT',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByConversation()', () => {
    it('should list events oldest first with the actor name, scoped to the workspace', async () => {
      const { workspace, user, conversation } = await seedConversation()
      const closed = await prisma.whatsAppConversationEvent.create({
        data: {
          workspaceId: workspace.id,
          conversationId: conversation.id,
          kind: 'CLOSED',
          source: 'INACTIVITY',
          createdAt: new Date('2026-01-01T10:00:00Z'),
        },
      })
      const reopened = await prisma.whatsAppConversationEvent.create({
        data: {
          workspaceId: workspace.id,
          conversationId: conversation.id,
          kind: 'REOPENED',
          source: 'AGENT',
          actorUserId: user.id,
          createdAt: new Date('2026-01-02T10:00:00Z'),
        },
      })

      const events = expectOk(
        await WhatsAppConversationEventRepository.listByConversation(
          conversation.id,
          workspace.id,
        ),
      )
      expect(events.map((e) => e.id)).toEqual([closed.id, reopened.id])
      expect(events[0].actorUser).toBeNull()
      expect(events[1].actorUser).toEqual({ id: user.id, name: user.name })

      const other = await seedWorkspace()
      expect(
        expectOk(
          await WhatsAppConversationEventRepository.listByConversation(
            conversation.id,
            other.id,
          ),
        ),
      ).toEqual([])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(
        prisma.whatsAppConversationEvent,
        'findMany',
      ).mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await WhatsAppConversationEventRepository.listByConversation('c', 'w'),
        'DATABASE_ERROR',
      )
    })
  })
})
