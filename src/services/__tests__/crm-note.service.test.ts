import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmNote } from '@/src/__tests__/factories/crm-note.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-note.repository')

import { CrmNoteRepository } from '@/src/repositories/crm-note.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmNoteService } from '../crm-note.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedNoteRepo = vi.mocked(CrmNoteRepository)

describe('CrmNoteService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmNoteService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return notes for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedNoteRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmNote({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmNoteService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })
  })
})
