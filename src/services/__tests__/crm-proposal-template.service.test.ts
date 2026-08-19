import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProposalTemplate } from '@/src/__tests__/factories/crm-proposal-template.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-proposal-template.repository')

import { CrmProposalTemplateRepository } from '@/src/repositories/crm-proposal-template.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmProposalTemplateService } from '../crm-proposal-template.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedTemplateRepo = vi.mocked(CrmProposalTemplateRepository)

describe('CrmProposalTemplateService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmProposalTemplateService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should create a template with the given sections', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedTemplateRepo.create.mockResolvedValue(
        ok({
          ...createFakeCrmProposalTemplate({ id: 't1', name: 'Template X' }),
          sections: [],
        }),
      )

      const dto = expectOk(
        await CrmProposalTemplateService.create('u1', 'ws1', {
          name: 'Template X',
          sections: [],
        }),
      )
      expect(dto.name).toBe('Template X')
    })
  })

  describe('createFromProposal()', () => {
    it('should map proposal sections into template defaultContent', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok({ id: 'm1' } as never),
      )
      mockedTemplateRepo.create.mockResolvedValue(
        ok({
          ...createFakeCrmProposalTemplate({ id: 't1', name: 'Proposta X' }),
          sections: [],
        }),
      )

      await CrmProposalTemplateService.createFromProposal('u1', 'ws1', {
        name: 'Proposta X',
        sections: [
          {
            id: 's1',
            type: 'COVER',
            order: 0,
            enabled: true,
            content: { type: 'COVER', title: 'Proposta X' },
          },
        ],
      })

      expect(mockedTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: [
            expect.objectContaining({
              type: 'COVER',
              defaultContent: { type: 'COVER', title: 'Proposta X' },
            }),
          ],
        }),
      )
    })
  })
})
