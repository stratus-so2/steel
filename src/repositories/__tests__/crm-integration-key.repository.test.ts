import { describe, expect, it } from 'vitest'
import { seedCrmIntegrationKey } from '@/src/__tests__/factories/crm-integration-key.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
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
  })
})
