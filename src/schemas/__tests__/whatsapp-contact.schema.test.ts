import { describe, expect, it } from 'vitest'
import {
  CreateWhatsAppContactSchema,
  ListWhatsAppContactsSchema,
  UpdateWhatsAppContactSchema,
} from '../whatsapp-contact.schema'

describe('CreateWhatsAppContactSchema', () => {
  it('should accept a valid contact with name', () => {
    const result = CreateWhatsAppContactSchema.safeParse({
      waId: '5511988887777',
      name: 'Maria Silva',
    })
    expect(result.success).toBe(true)
  })

  it('should accept a contact without a name', () => {
    expect(
      CreateWhatsAppContactSchema.safeParse({ waId: '5511988887777' }).success,
    ).toBe(true)
  })

  it('should reject a waId with letters', () => {
    expect(
      CreateWhatsAppContactSchema.safeParse({ waId: '55119888-7777' }).success,
    ).toBe(false)
  })

  it('should reject a waId shorter than 8 digits', () => {
    expect(
      CreateWhatsAppContactSchema.safeParse({ waId: '1234567' }).success,
    ).toBe(false)
  })

  it('should reject an invalid avatarUrl', () => {
    expect(
      CreateWhatsAppContactSchema.safeParse({
        waId: '5511988887777',
        avatarUrl: 'not-a-url',
      }).success,
    ).toBe(false)
  })
})

describe('UpdateWhatsAppContactSchema', () => {
  it('should accept an empty object', () => {
    expect(UpdateWhatsAppContactSchema.safeParse({}).success).toBe(true)
  })
})

describe('ListWhatsAppContactsSchema', () => {
  it('should accept an optional search term', () => {
    expect(ListWhatsAppContactsSchema.safeParse({}).success).toBe(true)
    expect(
      ListWhatsAppContactsSchema.safeParse({ search: 'maria' }).success,
    ).toBe(true)
  })
})
