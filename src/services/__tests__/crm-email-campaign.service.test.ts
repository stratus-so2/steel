import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmEmailCampaign } from '@/src/__tests__/factories/crm-email-marketing.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-email-campaign.repository')
vi.mock('@/src/repositories/crm-person.repository')

import {
  CrmEmailCampaignRecipientRepository,
  CrmEmailCampaignRepository,
} from '@/src/repositories/crm-email-campaign.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmEmailCampaignService } from '../crm-email-campaign.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCampaignRepo = vi.mocked(CrmEmailCampaignRepository)
const mockedRecipientRepo = vi.mocked(CrmEmailCampaignRecipientRepository)
const mockedPersonRepo = vi.mocked(CrmPersonRepository)

describe('CrmEmailCampaignService', () => {
  describe('update()', () => {
    it('should return CRM_EMAIL_CAMPAIGN_ALREADY_SENT for a sent campaign', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCampaignRepo.findById.mockResolvedValue(
        ok(createFakeCrmEmailCampaign({ id: 'c1', status: 'SENT' })),
      )

      expectErr(
        await CrmEmailCampaignService.update('u1', 'ws1', 'c1', {}),
        'CRM_EMAIL_CAMPAIGN_ALREADY_SENT',
      )
    })
  })

  describe('create()', () => {
    it('should create a campaign with recipients from all people with an email', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCampaignRepo.create.mockResolvedValue(
        ok(createFakeCrmEmailCampaign({ id: 'c1' })),
      )
      mockedPersonRepo.listByWorkspace.mockResolvedValue(
        ok([
          {
            id: 'p1',
            name: 'Jane',
            emails: ['jane@acme.com'],
            phones: [],
            city: null,
            jobTitle: null,
            linkedin: null,
            avatar: null,
            companyId: null,
            workspaceId: 'ws1',
            createdById: 'u1',
            updatedById: null,
            position: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
          },
        ]),
      )
      mockedRecipientRepo.createMany.mockResolvedValue(ok(1))

      const dto = expectOk(
        await CrmEmailCampaignService.create('u1', 'ws1', {
          subject: 'Promo',
          contentHtml: '<p>Oi</p>',
          fromAddress: 'crm@stratustelecom.com.br',
          recipientScope: 'ALL',
        }),
      )
      expect(dto.id).toBe('c1')
      expect(mockedRecipientRepo.createMany).toHaveBeenCalledWith('c1', [
        { email: 'jane@acme.com', name: 'Jane', personId: 'p1' },
      ])
    })
  })
})
