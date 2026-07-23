import { describe, expect, it } from 'vitest'
import { seedCrmEmailTemplate } from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { CrmEmailTemplateRepository } from '../crm-email-template.repository'

describe('CrmEmailTemplateRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted templates', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmEmailTemplate(workspace.id, user.id)
      await seedCrmEmailTemplate(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmEmailTemplateRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((t) => t.id)).toEqual([kept.id])
    })
  })
})
