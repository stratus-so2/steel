import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmEmailAccount } from '@/src/__tests__/factories/crm-email-sync.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-email-sync.repository')

import { CrmEmailAccountRepository } from '@/src/repositories/crm-email-sync.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmEmailAccountService } from '../crm-email-sync.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedAccountRepo = vi.mocked(CrmEmailAccountRepository)

describe('CrmEmailAccountService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmEmailAccountService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should scope the account to the acting user', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ role: 'MEMBER', isPrivileged: false } as never),
      )
      mockedAccountRepo.create.mockResolvedValue(
        ok(createFakeCrmEmailAccount({ userId: 'u1' })),
      )

      expectOk(
        await CrmEmailAccountService.create('u1', 'ws1', {
          provider: 'GMAIL',
          email: 'u1@acme.com',
        }),
      )
      expect(mockedAccountRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
      )
    })
  })
})
