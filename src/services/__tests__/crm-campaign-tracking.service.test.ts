import type { CrmCampaign } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmCampaign,
  createFakeCrmCampaignRecipient,
} from '@/src/__tests__/factories/crm-campaign.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { createCampaignLinkToken } from '@/src/lib/crm-campaign/tokens'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-campaign.repository')
vi.mock('@/src/repositories/crm-campaign-lookup.repository')
vi.mock('@/src/repositories/crm-activity.repository')

import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import {
  CrmCampaignConversionRepository,
  CrmCampaignRecipientRepository,
  CrmCampaignRepository,
} from '@/src/repositories/crm-campaign.repository'
import { CrmCampaignLookupRepository } from '@/src/repositories/crm-campaign-lookup.repository'
import { CrmCampaignTrackingService } from '../crm-campaign-tracking.service'

const campaigns = vi.mocked(CrmCampaignRepository)
const recipients = vi.mocked(CrmCampaignRecipientRepository)
const conversions = vi.mocked(CrmCampaignConversionRepository)
const lookup = vi.mocked(CrmCampaignLookupRepository)

const NOW = new Date('2026-10-09T13:00:00.000Z')
const T = CrmCampaignTrackingService

function campaign(overrides?: Partial<CrmCampaign>) {
  return createFakeCrmCampaign({
    id: 'c1',
    workspaceId: 'ws1',
    slug: 'bf',
    destinationType: 'FORM',
    formId: 'f1',
    ...overrides,
  })
}

function withRecipient(c: CrmCampaign = campaign()) {
  recipients.findWithCampaign.mockResolvedValue(
    ok({
      ...createFakeCrmCampaignRecipient({ id: 'r1', campaignId: c.id }),
      campaign: c,
    }),
  )
}

beforeEach(() => {
  recipients.markFirst.mockResolvedValue(ok(true))
  lookup.findForm.mockResolvedValue(
    ok({ id: 'f1', token: 'ftok', published: true }),
  )
  lookup.findLandingPage.mockResolvedValue(
    ok({ id: 'l1', token: 'ltok', published: true }),
  )
  conversions.record.mockResolvedValue(ok({ id: 'cv1' } as never))
})

describe('recordOpen()', () => {
  it('should mark the first open of an e-mail token', async () => {
    expect(
      expectOk(await T.recordOpen(createCampaignLinkToken('r1', 'EMAIL'), NOW)),
    ).toBe(true)
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'emailOpenedAt',
      NOW,
    )
  })

  it('should ignore invalid and WhatsApp tokens', async () => {
    expect(expectOk(await T.recordOpen('bad', NOW))).toBe(false)
    expect(
      expectOk(
        await T.recordOpen(createCampaignLinkToken('r1', 'WHATSAPP'), NOW),
      ),
    ).toBe(false)
  })
})

describe('resolveClick()', () => {
  it('should mark e-mail click + open and redirect with UTMs and ref', async () => {
    withRecipient()
    const token = createCampaignLinkToken('r1', 'EMAIL')
    const url = new URL(expectOk(await T.resolveClick(token, NOW)))
    expect(url.pathname).toBe('/f/ftok')
    expect(url.searchParams.get('utm_source')).toBe('email')
    expect(url.searchParams.get('utm_campaign')).toBe('bf')
    expect(url.searchParams.get('stc')).toBe(token)
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'emailClickedAt',
      NOW,
    )
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'emailOpenedAt',
      NOW,
    )
  })

  it('should mark WhatsApp clicks and reach landing pages', async () => {
    withRecipient(
      campaign({
        destinationType: 'LANDING_PAGE',
        formId: null,
        landingPageId: 'l1',
      }),
    )
    const url = expectOk(
      await T.resolveClick(createCampaignLinkToken('r1', 'WHATSAPP'), NOW),
    )
    expect(url).toContain('/l/ltok?utm_source=whatsapp')
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'whatsappClickedAt',
      NOW,
    )
  })

  it('should reject invalid tokens and gone campaigns/destinations', async () => {
    expectErr(await T.resolveClick('bad', NOW), 'CRM_CAMPAIGN_LINK_INVALID')
    const token = createCampaignLinkToken('r1', 'EMAIL')

    recipients.findWithCampaign.mockResolvedValueOnce(ok(null))
    expectErr(await T.resolveClick(token, NOW), 'CRM_CAMPAIGN_LINK_INVALID')

    withRecipient(campaign({ deletedAt: NOW }))
    expectErr(await T.resolveClick(token, NOW), 'CRM_CAMPAIGN_LINK_INVALID')

    withRecipient(campaign({ destinationType: null, formId: null }))
    expectErr(await T.resolveClick(token, NOW), 'CRM_CAMPAIGN_LINK_INVALID')

    withRecipient()
    lookup.findForm.mockResolvedValueOnce(ok(null))
    expectErr(await T.resolveClick(token, NOW), 'CRM_CAMPAIGN_LINK_INVALID')
    lookup.findForm.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await T.resolveClick(token, NOW), 'DATABASE_ERROR')
    recipients.findWithCampaign.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await T.resolveClick(token, NOW), 'DATABASE_ERROR')
  })
})

describe('attribute()', () => {
  const base = {
    workspaceId: 'ws1',
    kind: 'FORM_SUBMISSION' as const,
    sourceRef: 'sub1',
    formId: 'f1',
    leadId: 'lead1',
  }

  it('should attribute a submission to the recipient of the token', async () => {
    withRecipient()
    const ref = createCampaignLinkToken('r1', 'WHATSAPP')
    expect(
      expectOk(
        await T.attribute({ ...base, ref: { ref, utmSource: 'email' } }, NOW),
      ),
    ).toBe(true)
    expect(conversions.record).toHaveBeenCalledWith({
      campaignId: 'c1',
      recipientId: 'r1',
      channel: 'WHATSAPP',
      kind: 'FORM_SUBMISSION',
      sourceRef: 'sub1',
      leadId: 'lead1',
      personId: null,
    })
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'convertedAt',
      NOW,
    )
  })

  it('should fall back to the utm_campaign slug (forwarded link)', async () => {
    campaigns.findBySlug.mockResolvedValue(ok(campaign()))
    expect(
      expectOk(
        await T.attribute(
          { ...base, ref: { utmCampaign: 'bf', utmSource: 'whatsapp' } },
          NOW,
        ),
      ),
    ).toBe(true)
    expect(conversions.record).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: null, channel: 'WHATSAPP' }),
    )
    expect(recipients.markFirst).not.toHaveBeenCalled()

    // Unknown token recipient → slug.
    recipients.findWithCampaign.mockResolvedValueOnce(ok(null))
    expectOk(
      await T.attribute(
        {
          ...base,
          ref: {
            ref: createCampaignLinkToken('gone', 'EMAIL'),
            utmCampaign: 'bf',
            utmSource: 'x',
          },
        },
        NOW,
      ),
    )
    expect(conversions.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ channel: null }),
    )
  })

  it('should count landing visits for landing destinations', async () => {
    campaigns.findBySlug.mockResolvedValue(
      ok(
        campaign({
          destinationType: 'LANDING_PAGE',
          formId: null,
          landingPageId: 'l1',
        }),
      ),
    )
    expect(
      expectOk(
        await T.attribute(
          {
            workspaceId: 'ws1',
            kind: 'LANDING_VIEW',
            sourceRef: 'view1',
            landingPageId: 'l1',
            ref: { utmCampaign: 'bf', utmSource: 'email' },
          },
          NOW,
        ),
      ),
    ).toBe(true)
  })

  it('should ignore other destinations, workspaces and duplicates', async () => {
    campaigns.findBySlug.mockResolvedValue(ok(campaign()))
    expect(
      expectOk(
        await T.attribute(
          { ...base, formId: 'f2', ref: { utmCampaign: 'bf' } },
          NOW,
        ),
      ),
    ).toBe(false)
    expect(
      expectOk(
        await T.attribute(
          {
            ...base,
            kind: 'LANDING_VIEW',
            landingPageId: 'l1',
            ref: { utmCampaign: 'bf' },
          },
          NOW,
        ),
      ),
    ).toBe(false)
    expect(
      expectOk(
        await T.attribute(
          { ...base, workspaceId: 'other', ref: { utmCampaign: 'bf' } },
          NOW,
        ),
      ),
    ).toBe(false)
    expect(expectOk(await T.attribute({ ...base, ref: {} }, NOW))).toBe(false)

    campaigns.findBySlug.mockResolvedValueOnce(ok(null))
    expect(
      expectOk(await T.attribute({ ...base, ref: { utmCampaign: 'zz' } }, NOW)),
    ).toBe(false)

    conversions.record.mockResolvedValueOnce(ok(null))
    withRecipient()
    expect(
      expectOk(
        await T.attribute(
          { ...base, ref: { ref: createCampaignLinkToken('r1', 'EMAIL') } },
          NOW,
        ),
      ),
    ).toBe(false)
    expect(recipients.markFirst).not.toHaveBeenCalled()

    // Landing view of a form campaign: recorded, but no conversion stamp.
    withRecipient(
      campaign({ destinationType: 'LANDING_PAGE', landingPageId: 'l1' }),
    )
    expectOk(
      await T.attribute(
        {
          workspaceId: 'ws1',
          kind: 'LANDING_VIEW',
          sourceRef: 'v',
          landingPageId: 'l1',
          ref: { ref: createCampaignLinkToken('r1', 'EMAIL') },
        },
        NOW,
      ),
    )
    expect(recipients.markFirst).toHaveBeenCalledWith(
      { id: 'r1' },
      'convertedAt',
      NOW,
    )
  })

  it('should propagate failures', async () => {
    const ref = { ref: createCampaignLinkToken('r1', 'EMAIL') }
    recipients.findWithCampaign.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await T.attribute({ ...base, ref }, NOW), 'DATABASE_ERROR')
    campaigns.findBySlug.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await T.attribute({ ...base, ref: { utmCampaign: 'bf' } }, NOW),
      'DATABASE_ERROR',
    )
    withRecipient()
    conversions.record.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(await T.attribute({ ...base, ref }, NOW), 'DATABASE_ERROR')
  })
})

describe('onEmailEvent()', () => {
  const event = (type: string) => ({ type, data: { email_id: 'em1' } })

  it.each([
    ['email.delivered', ['emailDeliveredAt']],
    ['email.opened', ['emailOpenedAt']],
    ['email.clicked', ['emailOpenedAt', 'emailClickedAt']],
    ['email.bounced', ['emailBouncedAt']],
    ['email.complained', ['unsubscribedAt']],
  ])('%s should stamp %j', async (type, fields) => {
    recipients.findByProviderMessageId.mockResolvedValue(
      ok(createFakeCrmCampaignRecipient({ id: 'r1' })),
    )
    expect(expectOk(await T.onEmailEvent(event(type), NOW))).toBe(true)
    expect(recipients.markFirst.mock.calls.map((c) => c[1])).toEqual(fields)
  })

  it('should ignore unknown messages and events', async () => {
    recipients.findByProviderMessageId.mockResolvedValue(ok(null))
    expect(expectOk(await T.onEmailEvent(event('email.delivered'), NOW))).toBe(
      false,
    )
    recipients.findByProviderMessageId.mockResolvedValue(
      ok(createFakeCrmCampaignRecipient()),
    )
    expect(expectOk(await T.onEmailEvent(event('email.sent'), NOW))).toBe(false)
    recipients.findByProviderMessageId.mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await T.onEmailEvent(event('email.sent'), NOW), 'DATABASE_ERROR')
  })
})

describe('onWhatsAppStatus()', () => {
  it('should stamp delivered and read', async () => {
    recipients.findByProviderMessageId.mockResolvedValue(
      ok(createFakeCrmCampaignRecipient({ id: 'r1' })),
    )
    expectOk(await T.onWhatsAppStatus('wa1', 'DELIVERED', NOW))
    expect(recipients.markFirst.mock.calls.map((c) => c[1])).toEqual([
      'whatsappDeliveredAt',
    ])
    expectOk(await T.onWhatsAppStatus('wa1', 'READ', NOW))
    expect(recipients.markFirst.mock.calls.map((c) => c[1])).toEqual([
      'whatsappDeliveredAt',
      'whatsappDeliveredAt',
      'whatsappReadAt',
    ])
  })

  it('should ignore other statuses and unknown messages', async () => {
    expect(expectOk(await T.onWhatsAppStatus('wa1', 'SENT', NOW))).toBe(false)
    recipients.findByProviderMessageId.mockResolvedValue(ok(null))
    expect(expectOk(await T.onWhatsAppStatus('wa1', 'READ', NOW))).toBe(false)
    recipients.findByProviderMessageId.mockResolvedValue(
      err(databaseError('x')),
    )
    expectErr(await T.onWhatsAppStatus('wa1', 'READ', NOW), 'DATABASE_ERROR')
  })
})

describe('onWhatsAppInbound()', () => {
  const input = { workspaceId: 'ws1', waId: '5511', conversationId: 'conv1' }

  it('should mark the reply, link the conversation and log on the person', async () => {
    recipients.listAwaitingReply.mockResolvedValue(
      ok([
        {
          ...createFakeCrmCampaignRecipient({
            id: 'r1',
            campaignId: 'c1',
            personId: 'p1',
          }),
          campaign: campaign({ name: 'Black Friday' }),
        },
      ]),
    )
    recipients.markReplied.mockResolvedValue(ok(undefined))
    expect(expectOk(await T.onWhatsAppInbound(input, NOW))).toBe(true)
    expect(recipients.markReplied).toHaveBeenCalledWith('r1', {
      at: NOW,
      conversationId: 'conv1',
    })
    expect(CrmActivityRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        personId: 'p1',
        summary: 'respondeu pelo WhatsApp à campanha Black Friday',
      }),
    )
    expect(recipients.listAwaitingReply.mock.calls[0][2]).toEqual(
      new Date(NOW.getTime() - 30 * 24 * 3_600_000),
    )
  })

  it('should skip the timeline without a person and ignore strangers', async () => {
    recipients.listAwaitingReply.mockResolvedValue(
      ok([
        {
          ...createFakeCrmCampaignRecipient({ id: 'r1' }),
          campaign: campaign(),
        },
      ]),
    )
    recipients.markReplied.mockResolvedValue(ok(undefined))
    expect(expectOk(await T.onWhatsAppInbound(input, NOW))).toBe(true)
    expect(CrmActivityRepository.record).not.toHaveBeenCalled()

    recipients.listAwaitingReply.mockResolvedValue(ok([]))
    expect(expectOk(await T.onWhatsAppInbound(input, NOW))).toBe(false)
  })

  it('should propagate failures', async () => {
    recipients.listAwaitingReply.mockResolvedValue(err(databaseError('x')))
    expectErr(await T.onWhatsAppInbound(input, NOW), 'DATABASE_ERROR')
    recipients.listAwaitingReply.mockResolvedValue(
      ok([
        {
          ...createFakeCrmCampaignRecipient({ id: 'r1' }),
          campaign: campaign(),
        },
      ]),
    )
    recipients.markReplied.mockResolvedValue(err(databaseError('x')))
    expectErr(await T.onWhatsAppInbound(input, NOW), 'DATABASE_ERROR')
  })
})
