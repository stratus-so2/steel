import { describe, expect, it } from 'vitest'
import {
  createFakeCrmEmailBrand,
  createFakeCrmEmailBuilderTemplate,
  createFakeCrmEmailCampaign,
  createFakeCrmEmailCampaignRecipient,
  createFakeCrmEmailTemplate,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { createBuilderDocument } from '@/src/lib/crm-email-builder/layouts'
import {
  toCrmEmailBrandDTO,
  toCrmEmailLinkTargetsDTO,
} from '../crm-email-builder.mapper'
import {
  toCrmEmailCampaignDTO,
  toCrmEmailCampaignRecipientDTO,
  toCrmEmailTemplateDTO,
  toCrmMailingListMemberDTO,
} from '../crm-email-marketing.mapper'

describe('toCrmEmailTemplateDTO() builder fields', () => {
  it('should expose kind, document and plain text of a builder template', () => {
    const dto = toCrmEmailTemplateDTO(
      createFakeCrmEmailBuilderTemplate('promocao', { contentText: 'txt' }),
    )
    expect(dto.kind).toBe('BUILDER')
    expect(dto.builderDocument).toEqual(createBuilderDocument('promocao'))
    expect(dto.contentText).toBe('txt')
  })

  it('should map a legacy template with null builder fields', () => {
    const dto = toCrmEmailTemplateDTO(createFakeCrmEmailTemplate())
    expect(dto).toMatchObject({
      kind: 'LEGACY',
      builderDocument: null,
      contentText: null,
    })
  })
})

describe('toCrmEmailCampaignDTO() builder fields', () => {
  it('should expose the source template and campaign link', () => {
    const dto = toCrmEmailCampaignDTO(
      createFakeCrmEmailCampaign({
        templateId: 't1',
        campaignLink: 'https://lp.com/?utm_source=email',
      }),
    )
    expect(dto.templateId).toBe('t1')
    expect(dto.campaignLink).toBe('https://lp.com/?utm_source=email')
  })
})

describe('toCrmEmailBrandDTO()', () => {
  it('should mark a saved brand with its update time', () => {
    const updatedAt = new Date('2026-10-09T12:00:00.000Z')
    const row = createFakeCrmEmailBrand({ updatedAt })
    expect(
      toCrmEmailBrandDTO(
        {
          companyName: 'Acme',
          logoUrl: '',
          primaryColor: '#2893CC',
          address: 'Rua',
          website: '',
        },
        row,
      ),
    ).toEqual({
      companyName: 'Acme',
      logoUrl: '',
      primaryColor: '#2893CC',
      address: 'Rua',
      website: '',
      saved: true,
      updatedAt: '2026-10-09T12:00:00.000Z',
    })
  })

  it('should flag the defaults when nothing was saved', () => {
    const dto = toCrmEmailBrandDTO(
      {
        companyName: 'WS',
        logoUrl: '',
        primaryColor: '#2893CC',
        address: '',
        website: '',
      },
      null,
    )
    expect(dto.saved).toBe(false)
    expect(dto.updatedAt).toBeNull()
  })
})

describe('toCrmEmailLinkTargetsDTO()', () => {
  it('should build the public URLs of landing pages and forms', () => {
    expect(
      toCrmEmailLinkTargetsDTO(
        {
          landingPages: [{ id: 'l1', title: 'Promo', shareToken: 'tok' }],
          forms: [{ id: 'f1', name: 'Contato', publicToken: 'ft' }],
        },
        'https://steel.app/',
      ),
    ).toEqual({
      landingPages: [
        { id: 'l1', title: 'Promo', url: 'https://steel.app/l/tok' },
      ],
      forms: [{ id: 'f1', name: 'Contato', url: 'https://steel.app/f/ft' }],
    })
  })
})

describe('toCrmMailingListMemberDTO()', () => {
  it('should map a member', () => {
    const createdAt = new Date('2026-10-09T12:00:00.000Z')
    expect(
      toCrmMailingListMemberDTO({
        id: 'm1',
        mailingListId: 'l1',
        email: 'a@b.com',
        name: null,
        personId: 'p1',
        createdAt,
      }),
    ).toEqual({
      id: 'm1',
      mailingListId: 'l1',
      email: 'a@b.com',
      name: null,
      personId: 'p1',
      createdAt: '2026-10-09T12:00:00.000Z',
    })
  })
})

describe('toCrmEmailCampaignDTO() counts and dates', () => {
  it('should count recipients by status and serialize dates', () => {
    const when = new Date('2026-10-09T12:00:00.000Z')
    const dto = toCrmEmailCampaignDTO({
      ...createFakeCrmEmailCampaign({ scheduledAt: when, sentAt: when }),
      _count: { recipients: 4 },
      recipients: [
        { status: 'SENT' },
        { status: 'SENT' },
        { status: 'FAILED' },
        { status: 'SKIPPED' },
      ],
    })
    expect(dto).toMatchObject({
      recipientCount: 4,
      sentCount: 2,
      failedCount: 1,
      skippedCount: 1,
      scheduledAt: '2026-10-09T12:00:00.000Z',
      sentAt: '2026-10-09T12:00:00.000Z',
    })
  })

  it('should serialize the recipient send time', () => {
    const sentAt = new Date('2026-10-09T12:00:00.000Z')
    expect(
      toCrmEmailCampaignRecipientDTO(
        createFakeCrmEmailCampaignRecipient({ sentAt }),
      ).sentAt,
    ).toBe('2026-10-09T12:00:00.000Z')
    expect(
      toCrmEmailCampaignRecipientDTO(createFakeCrmEmailCampaignRecipient())
        .sentAt,
    ).toBeNull()
  })
})
