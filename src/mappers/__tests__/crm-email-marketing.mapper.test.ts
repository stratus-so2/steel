import { describe, expect, it } from 'vitest'
import {
  createFakeCrmEmailCampaign,
  createFakeCrmEmailTemplate,
  createFakeCrmMailingList,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import {
  toCrmEmailCampaignDTO,
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
})

describe('toCrmMailingListDTO()', () => {
  it('should map all fields correctly', () => {
    const list = createFakeCrmMailingList({ id: 'l-1' })
    expect(toCrmMailingListDTO(list).id).toBe('l-1')
  })
})
