import { describe, expect, it } from 'vitest'
import {
  createFakeCrmEmailCampaign,
  createFakeCrmEmailTemplate,
  createFakeCrmMailingList,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import {
  toCrmEmailCampaignDTO,
  toCrmEmailOptOutDTO,
  toCrmEmailTemplateDTO,
  toCrmMailingListDTO,
} from '../crm-email-marketing.mapper'

describe('toCrmEmailTemplateDTO()', () => {
  it('should map all fields correctly', () => {
    const template = createFakeCrmEmailTemplate({ id: 't-1' })
    expect(toCrmEmailTemplateDTO(template).id).toBe('t-1')
  })
})

describe('toCrmEmailCampaignDTO()', () => {
  it('should map all fields correctly', () => {
    const campaign = createFakeCrmEmailCampaign({ id: 'c-1', status: 'SENT' })
    const dto = toCrmEmailCampaignDTO(campaign)
    expect(dto.id).toBe('c-1')
    expect(dto.status).toBe('SENT')
  })

  it('should default recipient/sent/failed counts to 0 when absent', () => {
    const campaign = createFakeCrmEmailCampaign({ id: 'c-1' })
    const dto = toCrmEmailCampaignDTO(campaign)
    expect(dto.recipientCount).toBe(0)
    expect(dto.sentCount).toBe(0)
    expect(dto.failedCount).toBe(0)
    expect(dto.skippedCount).toBe(0)
  })

  it('should compute sent/failed counts from the recipients list', () => {
    const campaign = createFakeCrmEmailCampaign({ id: 'c-1' })
    const dto = toCrmEmailCampaignDTO({
      ...campaign,
      _count: { recipients: 4 },
      recipients: [
        { status: 'SENT' },
        { status: 'SENT' },
        { status: 'FAILED' },
        { status: 'SKIPPED' },
      ],
    })
    expect(dto.recipientCount).toBe(4)
    expect(dto.sentCount).toBe(2)
    expect(dto.failedCount).toBe(1)
    expect(dto.skippedCount).toBe(1)
  })
})

describe('toCrmMailingListDTO()', () => {
  it('should map all fields correctly', () => {
    const list = createFakeCrmMailingList({ id: 'l-1' })
    expect(toCrmMailingListDTO(list).id).toBe('l-1')
  })

  it('should default memberCount to 0 when _count is absent', () => {
    const list = createFakeCrmMailingList({ id: 'l-1' })
    expect(toCrmMailingListDTO(list).memberCount).toBe(0)
  })

  it('should read memberCount from _count.members when present', () => {
    const list = createFakeCrmMailingList({ id: 'l-1' })
    const dto = toCrmMailingListDTO({ ...list, _count: { members: 4 } })
    expect(dto.memberCount).toBe(4)
  })
})

describe('toCrmEmailOptOutDTO()', () => {
  it('should map the opt-out record', () => {
    const createdAt = new Date('2026-09-18T12:00:00.000Z')
    expect(
      toCrmEmailOptOutDTO({
        id: 'o1',
        workspaceId: 'ws1',
        email: 'jane@acme.com',
        personId: null,
        campaignId: 'c1',
        source: 'ONE_CLICK',
        createdAt,
      }),
    ).toEqual({
      id: 'o1',
      email: 'jane@acme.com',
      personId: null,
      campaignId: 'c1',
      source: 'ONE_CLICK',
      createdAt: '2026-09-18T12:00:00.000Z',
    })
  })
})
