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

  describe('listByWorkspace()', () => {
    it('should list only the workspace connections, oldest first', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      const other = await seedWorkspace()
      const first = expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: workspace.id,
          provider: 'ZAPI',
          label: 'Primeira',
          phoneNumber: '5511900000101',
          zapiInstanceId: 'inst-list-1',
          encryptedZapiToken: 'enc',
          createdById: user.id,
        }),
      )
      await prisma.whatsAppConnection.update({
        where: { id: first.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const second = expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: workspace.id,
          provider: 'META',
          label: 'Segunda',
          phoneNumber: '5511900000102',
          metaPhoneNumberId: 'phone-list-2',
          metaWabaId: 'waba-list-2',
          encryptedMetaAccessToken: 'enc',
          createdById: user.id,
        }),
      )
      expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: other.id,
          provider: 'ZAPI',
          label: 'Outra',
          phoneNumber: '5511900000103',
          zapiInstanceId: 'inst-list-3',
          encryptedZapiToken: 'enc',
          createdById: user.id,
        }),
      )

      const list = expectOk(
        await WhatsAppConnectionRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((c) => c.id)).toEqual([first.id, second.id])
    })
  })

  describe('findByMetaPhoneNumberId()', () => {
    it('should resolve only META connections by phone number id', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      const meta = expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: workspace.id,
          provider: 'META',
          label: 'Meta',
          phoneNumber: '5511900000201',
          metaPhoneNumberId: 'phone-201',
          metaWabaId: 'waba-201',
          encryptedMetaAccessToken: 'enc',
          createdById: user.id,
        }),
      )

      expect(
        expectOk(
          await WhatsAppConnectionRepository.findByMetaPhoneNumberId(
            'phone-201',
          ),
        )?.id,
      ).toBe(meta.id)
      expect(
        expectOk(
          await WhatsAppConnectionRepository.findByMetaPhoneNumberId('unknown'),
        ),
      ).toBeNull()
    })
  })

  describe('update()', () => {
    it('should update the connection fields', async () => {
      const { workspace, user } = await seedWorkspaceAndUser()
      const connection = expectOk(
        await WhatsAppConnectionRepository.create({
          workspaceId: workspace.id,
          provider: 'ZAPI',
          label: 'Antes',
          phoneNumber: '5511900000301',
          zapiInstanceId: 'inst-301',
          encryptedZapiToken: 'enc',
          createdById: user.id,
        }),
      )

      const updated = expectOk(
        await WhatsAppConnectionRepository.update(connection.id, {
          label: 'Depois',
        }),
      )
      expect(updated.label).toBe('Depois')
    })

    it('should return DATABASE_ERROR for a missing connection', async () => {
      expectErr(
        await WhatsAppConnectionRepository.update('missing', { label: 'x' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppConnectionRepository.delete('missing'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('database failures', () => {
    it('should return DATABASE_ERROR on non-unique create failures', async () => {
      const user = await seedUser()
      expectErr(
        await WhatsAppConnectionRepository.create({
          workspaceId: 'missing',
          provider: 'ZAPI',
          label: 'x',
          phoneNumber: '5511900000401',
          zapiInstanceId: 'inst-401',
          encryptedZapiToken: 'enc',
          createdById: user.id,
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      vi.spyOn(prisma.whatsAppConnection, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      vi.spyOn(prisma.whatsAppConnection, 'findFirst')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))

      expectErr(
        await WhatsAppConnectionRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppConnectionRepository.findById('c', 'w'),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppConnectionRepository.findByZapiInstanceId('i'),
        'DATABASE_ERROR',
      )
      expectErr(
        await WhatsAppConnectionRepository.findByMetaPhoneNumberId('p'),
        'DATABASE_ERROR',
      )
    })
  })
})
