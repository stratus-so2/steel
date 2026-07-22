import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppMessageRepository } from '../whatsapp-message.repository'

let counter = 0
async function seedConversation() {
  counter += 1
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'ZAPI',
      label: 'Suporte',
      phoneNumber: '5511999999999',
      zapiInstanceId: `instance-${counter}`,
      encryptedZapiToken: 'enc:token',
      createdById: user.id,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: { workspaceId: workspace.id, waId: '5511988887777' },
  })
  const conversation = await prisma.whatsAppConversation.create({
    data: {
      workspaceId: workspace.id,
      connectionId: connection.id,
      contactId: contact.id,
    },
  })
  return { workspace, conversation }
}

describe('WhatsAppMessageRepository', () => {
  describe('create() + listByConversation()', () => {
    it('should list messages for a conversation in chronological order', async () => {
      const { workspace, conversation } = await seedConversation()

      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Primeira mensagem',
      })
      await new Promise((resolve) => setTimeout(resolve, 5))
      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'OUT',
        type: 'TEXT',
        text: 'Segunda mensagem',
      })

      const result = expectOk(
        await WhatsAppMessageRepository.listByConversation(conversation.id, {
          limit: 50,
        }),
      )

      expect(result.map((m) => m.text)).toEqual([
        'Primeira mensagem',
        'Segunda mensagem',
      ])
    })

    it('should exclude soft-deleted messages', async () => {
      const { workspace, conversation } = await seedConversation()
      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Visível',
      })
      const deleted = expectOk(
        await WhatsAppMessageRepository.create({
          workspaceId: workspace.id,
          conversationId: conversation.id,
          direction: 'IN',
          type: 'TEXT',
          text: 'Apagada',
        }),
      )
      await WhatsAppMessageRepository.update(deleted.id, {
        deletedAt: new Date(),
      })

      const result = expectOk(
        await WhatsAppMessageRepository.listByConversation(conversation.id, {
          limit: 50,
        }),
      )

      expect(result.map((m) => m.text)).toEqual(['Visível'])
    })

    it('should only return messages created after the "after" cursor', async () => {
      const { workspace, conversation } = await seedConversation()
      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Antes de limpar',
      })
      const cursor = new Date()
      await new Promise((resolve) => setTimeout(resolve, 5))
      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Depois de limpar',
      })

      const result = expectOk(
        await WhatsAppMessageRepository.listByConversation(conversation.id, {
          limit: 50,
          after: cursor,
        }),
      )

      expect(result.map((m) => m.text)).toEqual(['Depois de limpar'])
    })
  })

  describe('findByProviderMessageId()', () => {
    it('should support dedupe lookups', async () => {
      const { workspace, conversation } = await seedConversation()
      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Olá',
        providerMessageId: 'pm-unique-1',
      })

      const found = expectOk(
        await WhatsAppMessageRepository.findByProviderMessageId('pm-unique-1'),
      )
      const missing = expectOk(
        await WhatsAppMessageRepository.findByProviderMessageId('unknown'),
      )

      expect(found?.text).toBe('Olá')
      expect(missing).toBeNull()
    })
  })

  describe('updateStatusByProviderMessageId()', () => {
    it('should update the status of the matching message', async () => {
      const { workspace, conversation } = await seedConversation()
      await WhatsAppMessageRepository.create({
        workspaceId: workspace.id,
        conversationId: conversation.id,
        direction: 'OUT',
        type: 'TEXT',
        text: 'Olá',
        providerMessageId: 'pm-status-1',
        status: 'SENT',
      })

      const updated = expectOk(
        await WhatsAppMessageRepository.updateStatusByProviderMessageId(
          'pm-status-1',
          'READ',
        ),
      )

      expect(updated?.status).toBe('READ')
    })

    it('should return null instead of throwing for an unknown providerMessageId', async () => {
      const result = expectOk(
        await WhatsAppMessageRepository.updateStatusByProviderMessageId(
          'never-existed',
          'READ',
        ),
      )

      expect(result).toBeNull()
    })
  })
})
