import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppConnectionRepository } from '../whatsapp-connection.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

async function seedWorkspaceAndUser() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  return { workspace, user }
}

describe('WhatsAppConnectionRepository', () => {
  describe('create()', () => {
    it('should persist a ZAPI connection with an auto-generated webhook secret', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()

      const result = await WhatsAppConnectionRepository.create({
        workspaceId: workspace.id,
        provider: 'ZAPI',
        label: 'Suporte',
        phoneNumber: '5511999999999',
        zapiInstanceId: 'instance-1',
        encryptedZapiToken: 'enc:token',
        createdById: user.id,
      })

      const connection = expectOk(result)
      expect(connection.provider).toBe('ZAPI')
      expect(connection.webhookSecret).toBeTruthy()
    })

    it('should return WHATSAPP_CONNECTION_CONFLICT for a duplicate provider+phoneNumber', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      const data = {
        workspaceId: workspace.id,
        provider: 'ZAPI' as const,
        label: 'Suporte',
        phoneNumber: '5511999999999',
        zapiInstanceId: 'instance-1',
        encryptedZapiToken: 'enc:token',
        createdById: user.id,
      }
      expectOk(await WhatsAppConnectionRepository.create(data))

      const result = await WhatsAppConnectionRepository.create(data)

      expectErr(result, 'WHATSAPP_CONNECTION_CONFLICT')
    })
  })

  describe('findById()', () => {
    it('should scope lookups to the given workspace', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      const otherWorkspace = await seedWorkspace()
      const created = expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: workspace.id,
          provider: 'ZAPI',
          label: 'Suporte',
          phoneNumber: '5511999999999',
          zapiInstanceId: 'instance-1',
          encryptedZapiToken: 'enc:token',
          createdById: user.id,
        }),
      )

      const found = await WhatsAppConnectionRepository.findById(
        created.id,
        workspace.id,
      )
      const notFound = await WhatsAppConnectionRepository.findById(
        created.id,
        otherWorkspace.id,
      )

      expect(expectOk(found)?.id).toBe(created.id)
      expect(expectOk(notFound)).toBeNull()
    })
  })

  describe('findByZapiInstanceId()', () => {
    it('should resolve the connection used by an inbound Z-API webhook', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      await WhatsAppConnectionRepository.create({
        workspaceId: workspace.id,
        provider: 'ZAPI',
        label: 'Suporte',
        phoneNumber: '5511999999999',
        zapiInstanceId: 'webhook-instance',
        encryptedZapiToken: 'enc:token',
        createdById: user.id,
      })

      const result =
        await WhatsAppConnectionRepository.findByZapiInstanceId(
          'webhook-instance',
        )

      expect(expectOk(result)?.zapiInstanceId).toBe('webhook-instance')
    })
  })

  describe('delete()', () => {
    it('should remove the connection', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      const created = expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: workspace.id,
          provider: 'ZAPI',
          label: 'Suporte',
          phoneNumber: '5511999999999',
          zapiInstanceId: 'instance-1',
          encryptedZapiToken: 'enc:token',
          createdById: user.id,
        }),
      )

      expectOk(await WhatsAppConnectionRepository.delete(created.id))

      const found = await prisma.whatsAppConnection.findUnique({
        where: { id: created.id },
      })
      expect(found).toBeNull()
    })
  })
})
