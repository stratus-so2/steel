import { describe, expect, it } from 'vitest'
import {
  CreateCrmEmailCampaignSchema,
  UpdateCrmEmailCampaignSchema,
} from '../crm-email-campaign.schema'

describe('CreateCrmEmailCampaignSchema', () => {
  it('should reject an invalid fromAddress', () => {
    expect(
      CreateCrmEmailCampaignSchema.safeParse({
        subject: 'Promo',
        contentHtml: '<p>Oi</p>',
        fromAddress: 'not-an-email',
        recipientScope: 'ALL',
      }).success,
    ).toBe(false)
  })

  it('should accept a valid ALL-scope payload', () => {
    expect(
      CreateCrmEmailCampaignSchema.safeParse({
        subject: 'Promo',
        contentHtml: '<p>Oi</p>',
        fromAddress: 'crm@stratustelecom.com.br',
        recipientScope: 'ALL',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmEmailCampaignSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmEmailCampaignSchema.safeParse({}).success).toBe(true)
  })
})
