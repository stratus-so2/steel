import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmEmailCampaignRecipient } from '@/src/__tests__/factories/crm-email-marketing.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { notFound } from '@/src/errors'
import { createCrmUnsubscribeToken } from '@/src/lib/crm-email-unsubscribe'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-email-campaign.repository')
vi.mock('@/src/repositories/crm-email-opt-out.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { CrmEmailCampaignRecipientRepository } from '@/src/repositories/crm-email-campaign.repository'
import { CrmEmailOptOutRepository } from '@/src/repositories/crm-email-opt-out.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmEmailOptOutService } from '../crm-email-opt-out.service'

const mockedRecipientRepo = vi.mocked(CrmEmailCampaignRecipientRepository)
const mockedOptOutRepo = vi.mocked(CrmEmailOptOutRepository)
const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedAudit = vi.mocked(auditMutation)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)

function recipientWithCampaign() {
  return {
    ...createFakeCrmEmailCampaignRecipient({
      id: 'r1',
      campaignId: 'c1',
      personId: 'p1',
      email: 'Jane@Acme.com',
    }),
    campaign: { id: 'c1', workspaceId: 'ws1' },
  }
}

function fakeOptOut(source: 'LINK' | 'ONE_CLICK') {
  return {
    id: 'o1',
    workspaceId: 'ws1',
    email: 'jane@acme.com',
    personId: 'p1',
    campaignId: 'c1',
    source,
    createdAt: new Date(),
  }
}

describe('CrmEmailOptOutService', () => {
  describe('unsubscribe()', () => {
    it('should record the opt-out and audit it as LGPD-sensitive', async () => {
      mockedRecipientRepo.findByIdWithCampaign.mockResolvedValue(
        ok(recipientWithCampaign()),
      )
      mockedOptOutRepo.upsert.mockResolvedValue(
        ok({ optOut: fakeOptOut('ONE_CLICK'), created: true }),
      )

      const dto = expectOk(
        await CrmEmailOptOutService.unsubscribe(
          createCrmUnsubscribeToken('r1'),
          'ONE_CLICK',
        ),
      )

      expect(dto).toEqual({ email: 'jane@acme.com', alreadyOptedOut: false })
      expect(mockedOptOutRepo.upsert).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        email: 'Jane@Acme.com',
        personId: 'p1',
        campaignId: 'c1',
        source: 'ONE_CLICK',
      })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'crm_email_opt_out',
          action: 'opt_out',
          actorId: null,
          targetId: 'o1',
          meta: expect.objectContaining({
            workspaceId: 'ws1',
            campaignId: 'c1',
            source: 'ONE_CLICK',
          }),
        }),
      )
    })

    it('should be idempotent for an address already opted out', async () => {
      mockedRecipientRepo.findByIdWithCampaign.mockResolvedValue(
        ok(recipientWithCampaign()),
      )
      mockedOptOutRepo.upsert.mockResolvedValue(
        ok({ optOut: fakeOptOut('LINK'), created: false }),
      )

      const dto = expectOk(
        await CrmEmailOptOutService.unsubscribe(
          createCrmUnsubscribeToken('r1'),
          'LINK',
        ),
      )
      expect(dto.alreadyOptedOut).toBe(true)
      expect(mockedAudit).not.toHaveBeenCalled()
    })

    it('should return MODULE_DISABLED when the CRM is off for the token workspace', async () => {
      mockedRecipientRepo.findByIdWithCampaign.mockResolvedValue(
        ok(recipientWithCampaign()),
      )
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))

      expectErr(
        await CrmEmailOptOutService.unsubscribe(
          createCrmUnsubscribeToken('r1'),
          'LINK',
        ),
        'MODULE_DISABLED',
      )
      expect(mockedModuleAccess.isEnabled).toHaveBeenCalledWith('ws1', 'CRM')
      expect(mockedOptOutRepo.upsert).not.toHaveBeenCalled()
    })

    it('should reject a forged token without touching the database', async () => {
      const [, signature] = createCrmUnsubscribeToken('r1').split('.')
      const forged = `${Buffer.from('r2').toString('base64url')}.${signature}`

      expectErr(
        await CrmEmailOptOutService.unsubscribe(forged, 'LINK'),
        'CRM_EMAIL_UNSUBSCRIBE_INVALID',
      )
      expect(mockedRecipientRepo.findByIdWithCampaign).not.toHaveBeenCalled()
      expect(mockedOptOutRepo.upsert).not.toHaveBeenCalled()
    })

    it('should reject a validly signed token for a deleted recipient', async () => {
      mockedRecipientRepo.findByIdWithCampaign.mockResolvedValue(
        err(notFound('CrmEmailCampaignRecipient')),
      )

      expectErr(
        await CrmEmailOptOutService.unsubscribe(
          createCrmUnsubscribeToken('gone'),
          'LINK',
        ),
        'CRM_EMAIL_UNSUBSCRIBE_INVALID',
      )
    })
  })

  describe('preview()', () => {
    it('should resolve the address without recording anything', async () => {
      mockedRecipientRepo.findByIdWithCampaign.mockResolvedValue(
        ok(recipientWithCampaign()),
      )

      const dto = expectOk(
        await CrmEmailOptOutService.preview(createCrmUnsubscribeToken('r1')),
      )
      expect(dto.email).toBe('jane@acme.com')
      expect(mockedOptOutRepo.upsert).not.toHaveBeenCalled()
    })
  })

  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(await CrmEmailOptOutService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))

      expectErr(
        await CrmEmailOptOutService.list('u1', 'ws1'),
        'MODULE_DISABLED',
      )
    })

    it('should list the workspace opt-outs for a member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedOptOutRepo.listByWorkspace.mockResolvedValue(
        ok([fakeOptOut('LINK')]),
      )

      const list = expectOk(await CrmEmailOptOutService.list('u1', 'ws1'))
      expect(list).toEqual([
        expect.objectContaining({
          email: 'jane@acme.com',
          personId: 'p1',
          source: 'LINK',
        }),
      ])
    })
  })
})
