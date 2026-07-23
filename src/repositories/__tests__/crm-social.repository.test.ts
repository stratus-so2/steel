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
    it('should return CRM_SOCIAL_CONNECTION_CONFLICT on duplicate platform', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmSocialConnection(workspace.id, user.id, {
        platform: 'INSTAGRAM',
      })

      const result = await CrmSocialConnectionRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        platform: 'INSTAGRAM',
        externalAccountId: 'acc-2',
      })

      expectErr(result, 'CRM_SOCIAL_CONNECTION_CONFLICT')
    })
  })

  describe('findByPlatform()', () => {
    it('should return null when there is no connection', async () => {
      const workspace = await seedWorkspace()
      const result = expectOk(
        await CrmSocialConnectionRepository.findByPlatform(
          workspace.id,
          'TIKTOK',
        ),
      )
      expect(result).toBeNull()
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
