import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppConversationRepository } from '../whatsapp-conversation.repository'

async function seedFixtures() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'ZAPI',
      label: 'Suporte',
      phoneNumber: '5511999999999',
      zapiInstanceId: `instance-${connectionSuffix()}`,
      encryptedZapiToken: 'enc:token',
      createdById: user.id,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: { workspaceId: workspace.id, waId: '5511988887777', name: 'Maria' },
  })
  return { workspace, user, connection, contact }
}

let counter = 0
function connectionSuffix() {
  counter += 1
  return counter
}

describe('WhatsAppConversationRepository', () => {
  describe('create() + findById()', () => {
    it('should persist a conversation and include the joined contact', async () => {
      const { workspace, connection, contact } = await seedFixtures()

      const created = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
          status: 'NEW',
        }),
      )

      const found = expectOk(
        await WhatsAppConversationRepository.findById(created.id, workspace.id),
      )
      expect(found?.contact.waId).toBe('5511988887777')
      expect(found?.messages).toEqual([])
    })
  })

  describe('findActiveByContact()', () => {
    it('should find a NEW/IN_PROGRESS conversation but ignore CLOSED ones', async () => {
      const { workspace, connection, contact } = await seedFixtures()
      const closed = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
          status: 'CLOSED',
        }),
      )

      const noneActive = expectOk(
        await WhatsAppConversationRepository.findActiveByContact(
          workspace.id,
          contact.id,
        ),
      )
      expect(noneActive).toBeNull()

      const active = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
          status: 'IN_PROGRESS',
        }),
      )

      const found = expectOk(
        await WhatsAppConversationRepository.findActiveByContact(
          workspace.id,
          contact.id,
        ),
      )
      expect(found?.id).toBe(active.id)
      expect(found?.id).not.toBe(closed.id)
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by status', async () => {
      const { workspace, connection, contact } = await seedFixtures()
      await WhatsAppConversationRepository.create({
        workspaceId: workspace.id,
        connectionId: connection.id,
        contactId: contact.id,
        status: 'NEW',
      })
      await WhatsAppConversationRepository.create({
        workspaceId: workspace.id,
        connectionId: connection.id,
        contactId: contact.id,
        status: 'CLOSED',
      })

      const result = expectOk(
        await WhatsAppConversationRepository.listByWorkspace(workspace.id, {
          status: 'CLOSED',
        }),
      )

      expect(result).toHaveLength(1)
      expect(result[0].status).toBe('CLOSED')
    })

    it('should exclude soft-deleted conversations by default', async () => {
      const { workspace, connection, contact } = await seedFixtures()
      const active = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
        }),
      )
      const deleted = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
        }),
      )
      await WhatsAppConversationRepository.update(deleted.id, {
        deletedAt: new Date(),
      })

      const result = expectOk(
        await WhatsAppConversationRepository.listByWorkspace(workspace.id),
      )

      expect(result.map((c) => c.id)).toEqual([active.id])
    })

    it('should only return archived conversations when archived: true', async () => {
      const { workspace, connection, contact } = await seedFixtures()
      const active = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
        }),
      )
      const archived = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
        }),
      )
      await WhatsAppConversationRepository.update(archived.id, {
        archivedAt: new Date(),
      })

      const activeList = expectOk(
        await WhatsAppConversationRepository.listByWorkspace(workspace.id),
      )
      expect(activeList.map((c) => c.id)).toEqual([active.id])

      const archivedList = expectOk(
        await WhatsAppConversationRepository.listByWorkspace(workspace.id, {
          archived: true,
        }),
      )
      expect(archivedList.map((c) => c.id)).toEqual([archived.id])
    })

    it('should sort pinned conversations first', async () => {
      const { workspace, connection, contact } = await seedFixtures()
      const unpinned = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
          lastMessageAt: new Date(),
        }),
      )
      const pinned = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
        }),
      )
      await WhatsAppConversationRepository.update(pinned.id, {
        pinnedAt: new Date(),
      })

      const result = expectOk(
        await WhatsAppConversationRepository.listByWorkspace(workspace.id),
      )

      expect(result[0].id).toBe(pinned.id)
      expect(result[1].id).toBe(unpinned.id)
    })
  })

  describe('update()', () => {
    it('should support incrementing unreadCount', async () => {
      const { workspace, connection, contact } = await seedFixtures()
      const created = expectOk(
        await WhatsAppConversationRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
          unreadCount: 1,
        }),
      )

      const updated = expectOk(
        await WhatsAppConversationRepository.update(created.id, {
          unreadCount: { increment: 1 },
        }),
      )

      expect(updated.unreadCount).toBe(2)
    })
  })
})
