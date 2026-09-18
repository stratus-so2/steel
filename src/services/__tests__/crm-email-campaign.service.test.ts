import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmEmailCampaign,
  createFakeCrmEmailCampaignRecipient,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-email-campaign.repository')
vi.mock('@/src/repositories/crm-person.repository')
vi.mock('@/src/repositories/crm-mailing-list.repository')
vi.mock('@/src/repositories/crm-email-opt-out.repository')
vi.mock('@/src/lib/mail/send', () => ({
  sendEmail: vi.fn(async () => ({ id: 'resend-1' })),
}))

import { sendEmail } from '@/src/lib/mail/send'
import {
  CrmEmailCampaignRecipientRepository,
  CrmEmailCampaignRepository,
} from '@/src/repositories/crm-email-campaign.repository'
import { CrmEmailOptOutRepository } from '@/src/repositories/crm-email-opt-out.repository'
import { CrmMailingListMemberRepository } from '@/src/repositories/crm-mailing-list.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmEmailCampaignService } from '../crm-email-campaign.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCampaignRepo = vi.mocked(CrmEmailCampaignRepository)
const mockedRecipientRepo = vi.mocked(CrmEmailCampaignRecipientRepository)
const mockedPersonRepo = vi.mocked(CrmPersonRepository)
const mockedMailingListMemberRepo = vi.mocked(CrmMailingListMemberRepository)
const mockedOptOutRepo = vi.mocked(CrmEmailOptOutRepository)
const mockedSendEmail = vi.mocked(sendEmail)

function optOutIndex(emails: string[] = [], personIds: string[] = []) {
  return ok({ emails: new Set(emails), personIds: new Set(personIds) })
}

function fakePerson(id: string, name: string, email: string) {
  return {
    id,
    name,
    emails: [email],
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
  }
}

beforeEach(() => {
  mockedOptOutRepo.indexByWorkspace.mockResolvedValue(optOutIndex())
})

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

    // Bug: "Selecionados" sem ninguém marcado disparava pra todo mundo com
    // e-mail no workspace. Seleção vazia nunca pode virar "todos".
    it('should reject a SELECTED scope with an empty selection without fanning out to everyone', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCampaignRepo.create.mockResolvedValue(
        ok(createFakeCrmEmailCampaign({ id: 'c1' })),
      )
      mockedPersonRepo.listByWorkspace.mockResolvedValue(ok([]))

      expectErr(
        await CrmEmailCampaignService.create('u1', 'ws1', {
          subject: 'Promo',
          contentHtml: '<p>Oi</p>',
          fromAddress: 'crm@stratustelecom.com.br',
          recipientScope: 'SELECTED',
          personIds: [],
          mailingListIds: [],
          extraEmails: [],
        }),
        'CRM_EMAIL_CAMPAIGN_NO_RECIPIENTS',
      )
      expect(mockedPersonRepo.listByWorkspace).not.toHaveBeenCalled()
      expect(mockedCampaignRepo.create).not.toHaveBeenCalled()
      expect(mockedRecipientRepo.createMany).not.toHaveBeenCalled()
    })

    it('should combine personIds + mailingListIds + extraEmails, deduping by email', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCampaignRepo.create.mockResolvedValue(
        ok(createFakeCrmEmailCampaign({ id: 'c1' })),
      )
      mockedPersonRepo.findById.mockResolvedValue(
        ok({
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
        }),
      )
      mockedMailingListMemberRepo.listByList.mockResolvedValue(
        ok([
          {
            id: 'm1',
            mailingListId: 'l1',
            email: 'JANE@ACME.COM',
            name: null,
            personId: null,
            createdAt: new Date(),
          },
          {
            id: 'm2',
            mailingListId: 'l1',
            email: 'list-member@acme.com',
            name: 'List Member',
            personId: null,
            createdAt: new Date(),
          },
        ]),
      )
      mockedRecipientRepo.createMany.mockResolvedValue(ok(2))

      expectOk(
        await CrmEmailCampaignService.create('u1', 'ws1', {
          subject: 'Promo',
          contentHtml: '<p>Oi</p>',
          fromAddress: 'crm@stratustelecom.com.br',
          recipientScope: 'SELECTED',
          personIds: ['p1'],
          mailingListIds: ['l1'],
          extraEmails: ['avulso@acme.com'],
        }),
      )

      // jane@acme.com vem tanto do personId quanto (com outra caixa) da
      // lista — só deve aparecer uma vez.
      expect(mockedRecipientRepo.createMany).toHaveBeenCalledWith('c1', [
        { email: 'jane@acme.com', name: 'Jane', personId: 'p1' },
        {
          email: 'list-member@acme.com',
          name: 'List Member',
          personId: undefined,
        },
        { email: 'avulso@acme.com' },
      ])
    })
  })

  describe('create() with LGPD opt-outs', () => {
    it('should exclude opted-out addresses and people from ALL', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCampaignRepo.create.mockResolvedValue(
        ok(createFakeCrmEmailCampaign({ id: 'c1' })),
      )
      mockedPersonRepo.listByWorkspace.mockResolvedValue(
        ok([
          fakePerson('p1', 'Jane', 'jane@acme.com'),
          fakePerson('p2', 'Saiu por e-mail', 'SAIU@acme.com'),
          fakePerson('p3', 'Saiu por pessoa', 'outro@acme.com'),
        ]),
      )
      mockedOptOutRepo.indexByWorkspace.mockResolvedValue(
        optOutIndex(['saiu@acme.com'], ['p3']),
      )
      mockedRecipientRepo.createMany.mockResolvedValue(ok(1))

      expectOk(
        await CrmEmailCampaignService.create('u1', 'ws1', {
          subject: 'Promo',
          contentHtml: '<p>Oi</p>',
          fromAddress: 'crm@stratustelecom.com.br',
          recipientScope: 'ALL',
        }),
      )
      expect(mockedOptOutRepo.indexByWorkspace).toHaveBeenCalledWith('ws1')
      expect(mockedRecipientRepo.createMany).toHaveBeenCalledWith('c1', [
        { email: 'jane@acme.com', name: 'Jane', personId: 'p1' },
      ])
    })

    it('should exclude opted-out extra emails and fail when nobody is left', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedOptOutRepo.indexByWorkspace.mockResolvedValue(
        optOutIndex(['avulso@acme.com']),
      )

      expectErr(
        await CrmEmailCampaignService.create('u1', 'ws1', {
          subject: 'Promo',
          contentHtml: '<p>Oi</p>',
          fromAddress: 'crm@stratustelecom.com.br',
          recipientScope: 'SELECTED',
          extraEmails: ['Avulso@acme.com'],
        }),
        'CRM_EMAIL_CAMPAIGN_NO_RECIPIENTS',
      )
      expect(mockedCampaignRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('send()', () => {
    it('should add the unsubscribe footer and RFC 8058 headers, and skip opted-out recipients', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const campaign = createFakeCrmEmailCampaign({
        id: 'c1',
        status: 'DRAFT',
        contentHtml: '<html><body><p>Oi</p></body></html>',
      })
      mockedCampaignRepo.findById.mockResolvedValue(ok(campaign))
      mockedCampaignRepo.setStatus.mockResolvedValue(
        ok({ ...campaign, status: 'SENT' }),
      )
      mockedRecipientRepo.listByCampaign.mockResolvedValue(
        ok([
          createFakeCrmEmailCampaignRecipient({
            id: 'r1',
            campaignId: 'c1',
            email: 'jane@acme.com',
          }),
          createFakeCrmEmailCampaignRecipient({
            id: 'r2',
            campaignId: 'c1',
            email: 'Saiu@acme.com',
          }),
        ]),
      )
      mockedRecipientRepo.markSent.mockResolvedValue(ok(undefined))
      mockedRecipientRepo.markSkipped.mockResolvedValue(ok(undefined))
      mockedOptOutRepo.indexByWorkspace.mockResolvedValue(
        optOutIndex(['saiu@acme.com']),
      )

      expectOk(await CrmEmailCampaignService.send('u1', 'ws1', 'c1'))

      expect(mockedSendEmail).toHaveBeenCalledTimes(1)
      const params = mockedSendEmail.mock.calls[0][0]
      expect(params.to).toBe('jane@acme.com')
      expect(params.html).toMatch(
        /\/unsubscribe\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"/,
      )
      expect(params.html).toMatch(/<\/div><\/body><\/html>$/)
      expect(params.headers?.['List-Unsubscribe']).toMatch(
        /^<https?:\/\/.+\/api\/crm\/unsubscribe\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+>$/,
      )
      expect(params.headers?.['List-Unsubscribe-Post']).toBe(
        'List-Unsubscribe=One-Click',
      )
      expect(mockedRecipientRepo.markSkipped).toHaveBeenCalledWith('r2')
      expect(mockedCampaignRepo.setStatus).toHaveBeenLastCalledWith(
        'c1',
        'SENT',
        expect.any(Date),
      )
    })

    it('should refuse to send a campaign without recipients', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCampaignRepo.findById.mockResolvedValue(
        ok(createFakeCrmEmailCampaign({ id: 'c1', status: 'DRAFT' })),
      )
      mockedRecipientRepo.listByCampaign.mockResolvedValue(ok([]))

      expectErr(
        await CrmEmailCampaignService.send('u1', 'ws1', 'c1'),
        'CRM_EMAIL_CAMPAIGN_NO_RECIPIENTS',
      )
      expect(mockedCampaignRepo.setStatus).not.toHaveBeenCalledWith(
        'c1',
        'SENDING',
      )
    })
  })
})
