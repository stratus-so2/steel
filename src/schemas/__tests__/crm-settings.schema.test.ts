import { describe, expect, it } from 'vitest'
import {
  CRM_SETTINGS_DEFAULTS,
  UpdateCrmSettingsSchema,
} from '../crm-settings.schema'

describe('CRM_SETTINGS_DEFAULTS', () => {
  it('should reopen to the first stage with 15-day proposals by default', () => {
    expect(CRM_SETTINGS_DEFAULTS).toEqual({
      leadReopenStage: 'RECEIVED',
      proposalValidityDays: 15,
      notifyProposalExpiry: true,
    })
  })
})

describe('UpdateCrmSettingsSchema', () => {
  it('should accept a partial update', () => {
    expect(
      UpdateCrmSettingsSchema.safeParse({ proposalValidityDays: 30 }).success,
    ).toBe(true)
  })

  it('should reject an empty payload', () => {
    expect(UpdateCrmSettingsSchema.safeParse({}).success).toBe(false)
  })

  it('should only accept open stages as the reopen target', () => {
    expect(
      UpdateCrmSettingsSchema.safeParse({ leadReopenStage: 'QUALIFIED' })
        .success,
    ).toBe(true)
    expect(
      UpdateCrmSettingsSchema.safeParse({ leadReopenStage: 'CLOSED' }).success,
    ).toBe(false)
  })

  it('should bound the validity between 1 and 365 whole days', () => {
    for (const days of [0, 366, 1.5]) {
      expect(
        UpdateCrmSettingsSchema.safeParse({ proposalValidityDays: days })
          .success,
      ).toBe(false)
    }
    expect(
      UpdateCrmSettingsSchema.safeParse({ proposalValidityDays: 365 }).success,
    ).toBe(true)
  })
})
