import { describe, expect, it } from 'vitest'
import {
  CreateCrmEmailTemplateSchema,
  UpdateCrmEmailTemplateSchema,
} from '../crm-email-template.schema'

describe('CreateCrmEmailTemplateSchema', () => {
  it('should reject when subject is missing', () => {
    expect(
      CreateCrmEmailTemplateSchema.safeParse({
        name: 'Boas-vindas',
        contentHtml: '<p>Oi</p>',
      }).success,
    ).toBe(false)
  })

  it('should accept a valid payload', () => {
    expect(
      CreateCrmEmailTemplateSchema.safeParse({
        name: 'Boas-vindas',
        subject: 'Bem-vindo!',
        contentHtml: '<p>Oi</p>',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateCrmEmailTemplateSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmEmailTemplateSchema.safeParse({}).success).toBe(true)
  })
})
