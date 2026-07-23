import { describe, expect, it } from 'vitest'
import { seedCrmEmailAccount } from '@/src/__tests__/factories/crm-email-sync.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr } from '@/src/__tests__/helpers/result.helpers'
import { CrmEmailAccountRepository } from '../crm-email-sync.repository'

describe('CrmEmailAccountRepository', () => {
  describe('create()', () => {
    it('should return CRM_EMAIL_ACCOUNT_CONFLICT on duplicate provider for the same user', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmEmailAccount(workspace.id, user.id, { provider: 'GMAIL' })

      const result = await CrmEmailAccountRepository.create({
        workspaceId: workspace.id,
        userId: user.id,
        provider: 'GMAIL',
        email: 'other@acme.com',
      })

      expectErr(result, 'CRM_EMAIL_ACCOUNT_CONFLICT')
    })
  })
})
