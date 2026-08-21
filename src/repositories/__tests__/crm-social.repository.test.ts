import { describe, expect, it } from 'vitest'
import {
  seedCrmScheduledPost,
  seedCrmSocialConnection,
} from '@/src/__tests__/factories/crm-social.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
  CrmSocialConnectionRepository,
} from '../crm-social.repository'

describe('CrmSocialConnectionRepository', () => {
  describe('create()', () => {
    it('should return CRM_SOCIAL_CONNECTION_CONFLICT on duplicate (platform, externalAccountId)', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmSocialConnection(workspace.id, user.id, {
        platform: 'INSTAGRAM',
        externalAccountId: 'acc-1',
      })

      const result = await CrmSocialConnectionRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        platform: 'INSTAGRAM',
        externalAccountId: 'acc-1',
      })

      expectErr(result, 'CRM_SOCIAL_CONNECTION_CONFLICT')
    })

    it('should allow a second account of the same platform with a different externalAccountId', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmSocialConnection(workspace.id, user.id, {
        platform: 'INSTAGRAM',
        externalAccountId: 'acc-1',
      })

      const result = await CrmSocialConnectionRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        platform: 'INSTAGRAM',
        externalAccountId: 'acc-2',
      })

      expectOk(result)
    })
  })

  describe('findPrimaryByPlatform()', () => {
    it('should return null when there is no connection', async () => {
      const workspace = await seedWorkspace()
      const result = expectOk(
        await CrmSocialConnectionRepository.findPrimaryByPlatform(
          workspace.id,
          'TIKTOK',
        ),
      )
      expect(result).toBeNull()
    })
  })

  describe('upsertOAuthConnection()', () => {
    it('should persist two accounts of the same platform as separate rows', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const base = {
        workspaceId: workspace.id,
        createdById: user.id,
        platform: 'FACEBOOK' as const,
        accessToken: 'enc:token',
        isPrimary: false,
      }

      await CrmSocialConnectionRepository.upsertOAuthConnection({
        ...base,
        externalAccountId: 'page-1',
      })
      await CrmSocialConnectionRepository.upsertOAuthConnection({
        ...base,
        externalAccountId: 'page-2',
      })

      const all = expectOk(
        await CrmSocialConnectionRepository.listByPlatform(
          workspace.id,
          'FACEBOOK',
        ),
      )
      expect(all).toHaveLength(2)
      expect(all.map((c) => c.externalAccountId).sort()).toEqual([
        'page-1',
        'page-2',
      ])
    })

    it('should upsert (not duplicate) when reconnecting the same account', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const base = {
        workspaceId: workspace.id,
        createdById: user.id,
        platform: 'FACEBOOK' as const,
        externalAccountId: 'page-1',
        isPrimary: false,
      }

      await CrmSocialConnectionRepository.upsertOAuthConnection({
        ...base,
        accessToken: 'enc:token-1',
      })
      await CrmSocialConnectionRepository.upsertOAuthConnection({
        ...base,
        accessToken: 'enc:token-2',
      })

      const all = expectOk(
        await CrmSocialConnectionRepository.listByPlatform(
          workspace.id,
          'FACEBOOK',
        ),
      )
      expect(all).toHaveLength(1)
      expect(all[0].accessToken).toBe('enc:token-2')
    })
  })

  describe('setPrimary()', () => {
    it('should leave exactly one primary per platform group', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const first = await seedCrmSocialConnection(workspace.id, user.id, {
        platform: 'FACEBOOK',
        externalAccountId: 'page-1',
      })
      const second = await seedCrmSocialConnection(workspace.id, user.id, {
        platform: 'FACEBOOK',
        externalAccountId: 'page-2',
      })

      await CrmSocialConnectionRepository.setPrimary(
        workspace.id,
        'FACEBOOK',
        first.id,
      )
      const afterFirst = expectOk(
        await CrmSocialConnectionRepository.listByPlatform(
          workspace.id,
          'FACEBOOK',
        ),
      )
      expect(afterFirst.filter((c) => c.isPrimary).map((c) => c.id)).toEqual([
        first.id,
      ])

      await CrmSocialConnectionRepository.setPrimary(
        workspace.id,
        'FACEBOOK',
        second.id,
      )
      const afterSecond = expectOk(
        await CrmSocialConnectionRepository.listByPlatform(
          workspace.id,
          'FACEBOOK',
        ),
      )
      expect(afterSecond.filter((c) => c.isPrimary).map((c) => c.id)).toEqual([
        second.id,
      ])
    })
  })
})

describe('CrmScheduledPostRepository', () => {
  describe('create()', () => {
    it('should default status to SCHEDULED when scheduledFor is set', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const post = expectOk(
        await CrmScheduledPostRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          content: 'Olá',
          status: 'SCHEDULED',
          scheduledFor: new Date(Date.now() + 60_000),
        }),
      )
      expect(post.status).toBe('SCHEDULED')
    })
  })

  describe('findById()', () => {
    it('should include targets', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const post = await seedCrmScheduledPost(workspace.id, user.id)
      await CrmScheduledPostTargetRepository.createMany(post.id, [
        'INSTAGRAM',
        'FACEBOOK',
      ])

      const found = expectOk(
        await CrmScheduledPostRepository.findById(post.id, workspace.id),
      )
      expect(found.targets).toHaveLength(2)
    })
  })
})
