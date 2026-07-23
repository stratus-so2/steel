import { describe, expect, it } from 'vitest'
import {
  CreateCrmFormSchema,
  SubmitCrmFormSchema,
  UpdateCrmFormSchema,
} from '../crm-form.schema'

describe('CreateCrmFormSchema', () => {
  it('should default action to LEAD and fields to empty', () => {
    const result = CreateCrmFormSchema.safeParse({ name: 'Contato' })
    expect(result.success).toBe(true)
    expect(result.data?.action).toBe('LEAD')
    expect(result.data?.fields).toEqual([])
  })

  it('should accept valid field definitions', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [{ key: 'email', label: 'E-mail', type: 'email' }],
    })
    expect(result.success).toBe(true)
    expect(result.data?.fields[0].required).toBe(false)
  })

  it('should reject an invalid field type', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [{ key: 'x', label: 'X', type: 'invalid' }],
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmFormSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmFormSchema.safeParse({}).success).toBe(true)
  })
})

describe('SubmitCrmFormSchema', () => {
  it('should accept a record of string values', () => {
    expect(
      SubmitCrmFormSchema.safeParse({ values: { name: 'Jane' } }).success,
    ).toBe(true)
  })
})
