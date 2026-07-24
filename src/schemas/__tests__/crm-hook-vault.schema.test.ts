import { describe, expect, it } from 'vitest'
import {
  CreateCrmHookVaultItemSchema,
  UpdateCrmHookVaultItemSchema,
} from '../crm-hook-vault.schema'

describe('CreateCrmHookVaultItemSchema', () => {
  it('should reject an empty text', () => {
    expect(CreateCrmHookVaultItemSchema.safeParse({ text: '' }).success).toBe(
      false,
    )
  })

  it('should accept a valid hook', () => {
    const result = CreateCrmHookVaultItemSchema.safeParse({
      text: 'Você sabia?',
      platform: 'INSTAGRAM',
    })
    expect(result.success).toBe(true)
  })

  it('should reject an invalid platform', () => {
    expect(
      CreateCrmHookVaultItemSchema.safeParse({
        text: 'Você sabia?',
        platform: 'GOOGLE_ADS',
      }).success,
    ).toBe(false)
  })
})

describe('UpdateCrmHookVaultItemSchema', () => {
  it('should reject an empty payload', () => {
    expect(UpdateCrmHookVaultItemSchema.safeParse({}).success).toBe(false)
  })

  it('should accept a partial payload', () => {
    expect(
      UpdateCrmHookVaultItemSchema.safeParse({ usageCount: 5 }).success,
    ).toBe(true)
  })
})
