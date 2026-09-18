import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppContactRepository } from '../whatsapp-contact.repository'

describe('WhatsAppContactRepository', () => {
  describe('create()', () => {
    it('should persist a contact', async () => {
      const workspace = await seedWorkspace()

      const result = await WhatsAppContactRepository.create({
        workspaceId: workspace.id,
        waId: '5511988887777',
        name: 'Maria Silva',
      })

      const contact = expectOk(result)
      expect(contact.waId).toBe('5511988887777')
    })

    it('should return CONFLICT for a duplicate waId in the same workspace', async () => {
      const workspace = await seedWorkspace()
      expectOk(
        await WhatsAppContactRepository.create({
          workspaceId: workspace.id,
          waId: '5511988887777',
        }),
      )

      const result = await WhatsAppContactRepository.create({
        workspaceId: workspace.id,
        waId: '5511988887777',
      })

      expectErr(result, 'CONFLICT')
    })
  })

  describe('upsertByWaId()', () => {
    it('should create the contact when it does not exist', async () => {
      const workspace = await seedWorkspace()

      const result = await WhatsAppContactRepository.upsertByWaId({
        workspaceId: workspace.id,
        waId: '5511988887777',
        name: 'Maria Silva',
      })

      expect(expectOk(result).name).toBe('Maria Silva')
    })

    it('should update the name on an existing contact without duplicating it', async () => {
      const workspace = await seedWorkspace()
      await WhatsAppContactRepository.upsertByWaId({
        workspaceId: workspace.id,
        waId: '5511988887777',
        name: 'Maria',
      })

      const result = await WhatsAppContactRepository.upsertByWaId({
        workspaceId: workspace.id,
        waId: '5511988887777',
        name: 'Maria Silva',
      })

      const contact = expectOk(result)
      expect(contact.name).toBe('Maria Silva')

      const list = expectOk(
        await WhatsAppContactRepository.listByWorkspace(workspace.id),
      )
      expect(list).toHaveLength(1)
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by search term across name and waId', async () => {
      const workspace = await seedWorkspace()
      await WhatsAppContactRepository.create({
        workspaceId: workspace.id,
        waId: '5511988887777',
        name: 'Maria Silva',
      })
      await WhatsAppContactRepository.create({
        workspaceId: workspace.id,
        waId: '5511977776666',
        name: 'João Souza',
      })

      const result = await WhatsAppContactRepository.listByWorkspace(
        workspace.id,
        'maria',
      )

      const list = expectOk(result)
      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('Maria Silva')
    })
  })

  describe('listByWorkspace() conversation count', () => {
    it('should include the number of conversations for each contact', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const contact = expectOk(
        await WhatsAppContactRepository.create({
          workspaceId: workspace.id,
          waId: '5511988887777',
        }),
      )
      const connection = await prisma.whatsAppConnection.create({
        data: {
          workspaceId: workspace.id,
          provider: 'ZAPI',
          label: 'Suporte',
          phoneNumber: '5511999999999',
          zapiInstanceId: 'instance-count-test',
          encryptedZapiToken: 'enc:token',
          createdById: user.id,
        },
      })
      await prisma.whatsAppConversation.create({
        data: {
          workspaceId: workspace.id,
          connectionId: connection.id,
          contactId: contact.id,
        },
      })

      const list = expectOk(
        await WhatsAppContactRepository.listByWorkspace(workspace.id),
      )

      expect(list[0]._count.conversations).toBe(1)
    })
  })

  describe('description field', () => {
    it('should persist and update the description', async () => {
      const workspace = await seedWorkspace()
      const created = expectOk(
        await WhatsAppContactRepository.create({
          workspaceId: workspace.id,
          waId: '5511988887777',
          description: 'Cliente VIP',
        }),
      )
      expect(created.description).toBe('Cliente VIP')

      const updated = expectOk(
        await WhatsAppContactRepository.update(created.id, {
          description: 'Cliente VIP — renovar contrato',
        }),
      )
      expect(updated.description).toBe('Cliente VIP — renovar contrato')
    })
  })

  describe('delete()', () => {
    it('should remove the contact', async () => {
      const workspace = await seedWorkspace()
      const created = expectOk(
        await WhatsAppContactRepository.create({
          workspaceId: workspace.id,
          waId: '5511988887777',
        }),
      )

      expectOk(await WhatsAppContactRepository.delete(created.id))

      const found = await WhatsAppContactRepository.findById(
        created.id,
        workspace.id,
      )
      expect(expectOk(found)).toBeNull()
    })
  })

  describe('setBroadcastOptOut()', () => {
    it('should record and clear the opt-out', async () => {
      const workspace = await seedWorkspace()
      const contact = expectOk(
        await WhatsAppContactRepository.create({
          workspaceId: workspace.id,
          waId: '5511911112222',
        }),
      )
      const at = new Date('2026-09-18T10:00:00.000Z')

      const optedOut = expectOk(
        await WhatsAppContactRepository.setBroadcastOptOut(contact.id, {
          at,
          source: 'KEYWORD',
        }),
      )
      expect(optedOut.broadcastOptedOutAt).toEqual(at)
      expect(optedOut.broadcastOptOutSource).toBe('KEYWORD')

      const cleared = expectOk(
        await WhatsAppContactRepository.setBroadcastOptOut(contact.id, null),
      )
      expect(cleared.broadcastOptedOutAt).toBeNull()
      expect(cleared.broadcastOptOutSource).toBeNull()
    })
  })

  describe('listBroadcastEligibleIds()', () => {
    it('should drop opted-out contacts and contacts from other workspaces', async () => {
      const [workspace, other] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
      ])
      const [active, optedOut, foreign] = await Promise.all([
        prisma.whatsAppContact.create({
          data: { workspaceId: workspace.id, waId: '5511900000001' },
        }),
        prisma.whatsAppContact.create({
          data: {
            workspaceId: workspace.id,
            waId: '5511900000002',
            broadcastOptedOutAt: new Date(),
            broadcastOptOutSource: 'KEYWORD',
          },
        }),
        prisma.whatsAppContact.create({
          data: { workspaceId: other.id, waId: '5511900000003' },
        }),
      ])

      const ids = expectOk(
        await WhatsAppContactRepository.listBroadcastEligibleIds(workspace.id, [
          active.id,
          optedOut.id,
          foreign.id,
        ]),
      )
      expect(ids).toEqual([active.id])
    })
  })
})
