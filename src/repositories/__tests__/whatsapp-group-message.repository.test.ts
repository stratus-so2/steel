import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppGroupMessageRepository } from '../whatsapp-group-message.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

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

  describe('listByGroup() pagination', () => {
    it('should page backwards from a cursor, returning chronological pages', async () => {
      const { workspace, group } = await seedGroup()
      const base = Date.now()
      const ids: string[] = []
      for (let i = 0; i < 4; i++) {
        const message = expectOk(
          await WhatsAppGroupMessageRepository.create({
            workspaceId: workspace.id,
            groupId: group.id,
            direction: 'IN',
            type: 'TEXT',
            text: `m${i}`,
            createdAt: new Date(base + i * 1000),
          }),
        )
        ids.push(message.id)
      }

      const newest = expectOk(
        await WhatsAppGroupMessageRepository.listByGroup(group.id, {
          limit: 2,
        }),
      )
      expect(newest.map((m) => m.text)).toEqual(['m2', 'm3'])

      const older = expectOk(
        await WhatsAppGroupMessageRepository.listByGroup(group.id, {
          limit: 2,
          cursor: newest[0].id,
        }),
      )
      expect(older.map((m) => m.text)).toEqual(['m0', 'm1'])
    })
  })

  describe('findById() / update()', () => {
    it('should find and update a message', async () => {
      const { workspace, group } = await seedGroup()
      const message = expectOk(
        await WhatsAppGroupMessageRepository.create({
          workspaceId: workspace.id,
          groupId: group.id,
          direction: 'OUT',
          type: 'TEXT',
          text: 'Oi',
        }),
      )

      expect(
        expectOk(await WhatsAppGroupMessageRepository.findById(message.id))
          ?.text,
      ).toBe('Oi')
      expect(
        expectOk(await WhatsAppGroupMessageRepository.findById('missing')),
      ).toBeNull()

      const updated = expectOk(
        await WhatsAppGroupMessageRepository.update(message.id, {
          text: 'Oi, editado',
          deletedAt: new Date(),
        }),
      )
      expect(updated.text).toBe('Oi, editado')
      expect(updated.deletedAt).not.toBeNull()
    })
  })

  describe('database failures', () => {
    it('should return DATABASE_ERROR when writes hit missing rows or FKs', async () => {
      const workspace = await seedWorkspace()
      expectErr(
        await WhatsAppGroupMessageRepository.create({
          workspaceId: workspace.id,
          groupId: 'missing-group',
          direction: 'IN',
          type: 'TEXT',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppGroupMessageRepository.update('missing', { text: 'x' }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      vi.spyOn(prisma.whatsAppGroupMessage, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      vi.spyOn(prisma.whatsAppGroupMessage, 'findUnique')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))

      expectErr(
        await WhatsAppGroupMessageRepository.listByGroup('g', { limit: 1 }),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppGroupMessageRepository.findById('m'),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppGroupMessageRepository.findByProviderMessageId('p'),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppGroupMessageRepository.updateStatusByProviderMessageId(
          'p',
          'READ',
        ),
        'DATABASE_ERROR',
      )
    })
  })
})
