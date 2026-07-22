import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppGroupRepository } from '../whatsapp-group.repository'

let counter = 0
async function seedConnection() {
  counter += 1
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'ZAPI',
      label: 'Suporte',
      phoneNumber: '5511999999999',
      zapiInstanceId: `instance-group-${counter}`,
      encryptedZapiToken: 'enc:token',
      createdById: user.id,
    },
  })
  return { workspace, connection }
}

describe('WhatsAppGroupRepository', () => {
  describe('create() + findById()', () => {
    it('should persist a group and include empty participants/messages', async () => {
      const { workspace, connection } = await seedConnection()

      const created = expectOk(
        await WhatsAppGroupRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          groupJid: '120363000000000001@g.us',
          name: 'Time de Suporte',
        }),
      )

      const found = expectOk(
        await WhatsAppGroupRepository.findById(created.id, workspace.id),
      )
      expect(found?.name).toBe('Time de Suporte')
      expect(found?.participants).toEqual([])
      expect(found?.messages).toEqual([])
    })
  })

  describe('findByGroupJid()', () => {
    it('should find a group scoped to the workspace', async () => {
      const { workspace, connection } = await seedConnection()
      await WhatsAppGroupRepository.create({
        workspaceId: workspace.id,
        connectionId: connection.id,
        groupJid: '120363000000000002@g.us',
        name: 'Time de Suporte',
      })

      const found = expectOk(
        await WhatsAppGroupRepository.findByGroupJid(
          workspace.id,
          '120363000000000002@g.us',
        ),
      )
      expect(found?.name).toBe('Time de Suporte')

      const missing = expectOk(
        await WhatsAppGroupRepository.findByGroupJid(
          workspace.id,
          'unknown@g.us',
        ),
      )
      expect(missing).toBeNull()
    })
  })

  describe('replaceParticipants()', () => {
    it('should replace the full participant set atomically', async () => {
      const { workspace, connection } = await seedConnection()
      const group = expectOk(
        await WhatsAppGroupRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          groupJid: '120363000000000003@g.us',
          name: 'Time de Suporte',
        }),
      )

      expectOk(
        await WhatsAppGroupRepository.replaceParticipants(group.id, [
          { waId: '5511988887777', name: 'Maria', role: 'ADMIN' },
          { waId: '5511977776666', name: 'João', role: 'MEMBER' },
        ]),
      )

      const afterFirstSync = expectOk(
        await WhatsAppGroupRepository.findById(group.id, workspace.id),
      )
      expect(afterFirstSync?.participants).toHaveLength(2)

      expectOk(
        await WhatsAppGroupRepository.replaceParticipants(group.id, [
          { waId: '5511988887777', name: 'Maria', role: 'MEMBER' },
        ]),
      )

      const afterSecondSync = expectOk(
        await WhatsAppGroupRepository.findById(group.id, workspace.id),
      )
      expect(afterSecondSync?.participants).toHaveLength(1)
      expect(afterSecondSync?.participants[0].role).toBe('MEMBER')
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter archived groups', async () => {
      const { workspace, connection } = await seedConnection()
      const active = expectOk(
        await WhatsAppGroupRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          groupJid: '120363000000000004@g.us',
          name: 'Ativo',
        }),
      )
      const archived = expectOk(
        await WhatsAppGroupRepository.create({
          workspaceId: workspace.id,
          connectionId: connection.id,
          groupJid: '120363000000000005@g.us',
          name: 'Arquivado',
        }),
      )
      await WhatsAppGroupRepository.update(archived.id, {
        archivedAt: new Date(),
      })

      const activeList = expectOk(
        await WhatsAppGroupRepository.listByWorkspace(workspace.id),
      )
      expect(activeList.map((g) => g.id)).toEqual([active.id])

      const archivedList = expectOk(
        await WhatsAppGroupRepository.listByWorkspace(workspace.id, {
          archived: true,
        }),
      )
      expect(archivedList.map((g) => g.id)).toEqual([archived.id])
    })
  })
})
