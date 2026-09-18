import { describe, expect, it, vi } from 'vitest'
import { seedCrmIntegrationKey } from '@/src/__tests__/factories/crm-integration-key.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmIntegrationKeyRepository } from '../crm-integration-key.repository'

describe('CrmIntegrationKeyRepository', () => {
  describe('findActiveByHash()', () => {
    it('should not return a revoked key', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const key = await seedCrmIntegrationKey(workspace.id, user.id, {
        keyHash: 'hash-1',
        revokedAt: new Date(),
      })

      const found = expectOk(
        await CrmIntegrationKeyRepository.findActiveByHash('hash-1'),
      )
      expect(found).toBeNull()
      expect(key.revokedAt).not.toBeNull()
    })

    it('should return an active key', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmIntegrationKey(workspace.id, user.id, {
        keyHash: 'hash-2',
      })

      const found = expectOk(
        await CrmIntegrationKeyRepository.findActiveByHash('hash-2'),
      )
      expect(found?.keyHash).toBe('hash-2')
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmIntegrationApiKey, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmIntegrationKeyRepository.findActiveByHash('h'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list only the workspace keys, newest first', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const older = await seedCrmIntegrationKey(workspace.id, user.id)
      await prisma.crmIntegrationApiKey.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const newer = await seedCrmIntegrationKey(workspace.id, user.id)
      await seedCrmIntegrationKey(other.id, user.id)

      const list = expectOk(
        await CrmIntegrationKeyRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((k) => k.id)).toEqual([newer.id, older.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmIntegrationApiKey, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmIntegrationKeyRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find a key of the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const key = await seedCrmIntegrationKey(workspace.id, user.id)

      const found = expectOk(
        await CrmIntegrationKeyRepository.findById(key.id, workspace.id),
      )
      expect(found.id).toBe(key.id)
    })

    it('should return NOT_FOUND for a key of another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const key = await seedCrmIntegrationKey(other.id, user.id)

      expectErr(
        await CrmIntegrationKeyRepository.findById(key.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmIntegrationApiKey, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmIntegrationKeyRepository.findById('k', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('should persist a new active key', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const key = expectOk(
        await CrmIntegrationKeyRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Zapier',
          keyHash: 'hash-new',
          prefix: 'crm_live_zz',
        }),
      )
      expect(key).toMatchObject({
        name: 'Zapier',
        revokedAt: null,
        lastUsedAt: null,
      })
    })

    it('should return DATABASE_ERROR when the creator does not exist', async () => {
      const workspace = await seedWorkspace()
      expectErr(
        await CrmIntegrationKeyRepository.create({
          workspaceId: workspace.id,
          createdById: 'missing-user',
          name: 'x',
          keyHash: 'h',
          prefix: 'p',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('markUsed() / revoke()', () => {
    it('should stamp lastUsedAt and then revoke the key', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const key = await seedCrmIntegrationKey(workspace.id, user.id, {
        keyHash: 'hash-use',
      })

      expectOk(await CrmIntegrationKeyRepository.markUsed(key.id))
      const used = expectOk(
        await CrmIntegrationKeyRepository.findById(key.id, workspace.id),
      )
      expect(used.lastUsedAt).toBeInstanceOf(Date)

      expectOk(await CrmIntegrationKeyRepository.revoke(key.id))
      expect(
        expectOk(
          await CrmIntegrationKeyRepository.findActiveByHash('hash-use'),
        ),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR for an unknown key', async () => {
      expectErr(
        await CrmIntegrationKeyRepository.markUsed('missing'),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmIntegrationKeyRepository.revoke('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
