import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmAiConversation } from '@/src/__tests__/factories/crm-ai.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-ai.repository')
vi.mock('@/lib/env/server', () => ({ OPENAI_API_KEY: undefined }))

import { CrmAiConversationRepository } from '@/src/repositories/crm-ai.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmAiConversationService } from '../crm-ai.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConversationRepo = vi.mocked(CrmAiConversationRepository)

describe('CrmAiConversationService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmAiConversationService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return conversations for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.listByUser.mockResolvedValue(
        ok([createFakeCrmAiConversation({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmAiConversationService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })

  describe('sendMessage()', () => {
    it('should return CRM_AI_NOT_CONFIGURED when OPENAI_API_KEY is missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(
        ok(createFakeCrmAiConversation({ id: 'c1' })),
      )

      expectErr(
        await CrmAiConversationService.sendMessage('u1', 'ws1', 'c1', 'Oi'),
        'CRM_AI_NOT_CONFIGURED',
      )
    })
  })
})
