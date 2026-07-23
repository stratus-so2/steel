import { describe, expect, it } from 'vitest'
import {
  seedCrmMailingList,
  seedCrmMailingListMember,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmMailingListMemberRepository,
  CrmMailingListRepository,
} from '../crm-mailing-list.repository'

describe('CrmMailingListRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted lists', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmMailingList(workspace.id, user.id)
      await seedCrmMailingList(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmMailingListRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((l) => l.id)).toEqual([kept.id])
    })
  })
})

describe('CrmMailingListMemberRepository', () => {
  describe('add()', () => {
    it('should return CRM_MAILING_LIST_MEMBER_CONFLICT on duplicate email', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const list = await seedCrmMailingList(workspace.id, user.id)
      await seedCrmMailingListMember(list.id, { email: 'jane@acme.com' })

      const result = await CrmMailingListMemberRepository.add({
        mailingListId: list.id,
        email: 'jane@acme.com',
      })

      expectErr(result, 'CRM_MAILING_LIST_MEMBER_CONFLICT')
    })
  })
})
