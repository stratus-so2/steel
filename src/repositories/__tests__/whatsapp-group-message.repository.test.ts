import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppGroupMessageRepository } from '../whatsapp-group-message.repository'

let counter = 0
async function seedGroup() {
  counter += 1
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'ZAPI',
      label: 'Suporte',
      phoneNumber: '5511999999999',
      zapiInstanceId: `instance-group-msg-${counter}`,
      encryptedZapiToken: 'enc:token',
      createdById: user.id,
    },
  })
  const group = await prisma.whatsAppGroup.create({
    data: {
      workspaceId: workspace.id,
      connectionId: connection.id,
      groupJid: `120363000000000${counter}@g.us`,
      name: 'Time de Suporte',
    },
  })
  return { workspace, group }
}

describe('WhatsAppGroupMessageRepository', () => {
  describe('create() + listByGroup()', () => {
    it('should list messages for a group in chronological order', async () => {
      const { workspace, group } = await seedGroup()

      await WhatsAppGroupMessageRepository.create({
        workspaceId: workspace.id,
        groupId: group.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Primeira mensagem',
        senderWaId: '5511988887777',
        senderName: 'Maria',
      })
      await new Promise((resolve) => setTimeout(resolve, 5))
      await WhatsAppGroupMessageRepository.create({
        workspaceId: workspace.id,
        groupId: group.id,
        direction: 'OUT',
        type: 'TEXT',
        text: 'Segunda mensagem',
      })

      const result = expectOk(
        await WhatsAppGroupMessageRepository.listByGroup(group.id, {
          limit: 50,
        }),
      )

      expect(result.map((m) => m.text)).toEqual([
        'Primeira mensagem',
        'Segunda mensagem',
      ])
      expect(result[0].senderName).toBe('Maria')
    })

    it('should exclude soft-deleted messages', async () => {
      const { workspace, group } = await seedGroup()
      await WhatsAppGroupMessageRepository.create({
        workspaceId: workspace.id,
        groupId: group.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Visível',
      })
      const deleted = expectOk(
        await WhatsAppGroupMessageRepository.create({
          workspaceId: workspace.id,
          groupId: group.id,
          direction: 'IN',
          type: 'TEXT',
          text: 'Apagada',
        }),
      )
      await WhatsAppGroupMessageRepository.update(deleted.id, {
        deletedAt: new Date(),
      })

      const result = expectOk(
        await WhatsAppGroupMessageRepository.listByGroup(group.id, {
          limit: 50,
        }),
      )

      expect(result.map((m) => m.text)).toEqual(['Visível'])
    })
  })

  describe('findByProviderMessageId()', () => {
    it('should support dedupe lookups', async () => {
      const { workspace, group } = await seedGroup()
      await WhatsAppGroupMessageRepository.create({
        workspaceId: workspace.id,
        groupId: group.id,
        direction: 'IN',
        type: 'TEXT',
        text: 'Olá',
        providerMessageId: 'pm-group-unique-1',
      })

      const found = expectOk(
        await WhatsAppGroupMessageRepository.findByProviderMessageId(
          'pm-group-unique-1',
        ),
      )
      const missing = expectOk(
        await WhatsAppGroupMessageRepository.findByProviderMessageId('unknown'),
      )

      expect(found?.text).toBe('Olá')
      expect(missing).toBeNull()
    })
  })

  describe('updateStatusByProviderMessageId()', () => {
    it('should update the status of the matching message', async () => {
      const { workspace, group } = await seedGroup()
      await WhatsAppGroupMessageRepository.create({
        workspaceId: workspace.id,
        groupId: group.id,
        direction: 'OUT',
        type: 'TEXT',
        text: 'Olá',
        providerMessageId: 'pm-group-status-1',
        status: 'SENT',
      })

      const updated = expectOk(
        await WhatsAppGroupMessageRepository.updateStatusByProviderMessageId(
          'pm-group-status-1',
          'READ',
        ),
      )

      expect(updated?.status).toBe('READ')
    })

    it('should return null instead of throwing for an unknown providerMessageId', async () => {
      const result = expectOk(
        await WhatsAppGroupMessageRepository.updateStatusByProviderMessageId(
          'never-existed',
          'READ',
        ),
      )

      expect(result).toBeNull()
    })
  })
})
