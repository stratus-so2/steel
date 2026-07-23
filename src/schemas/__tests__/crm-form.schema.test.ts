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

  it('should accept a valid field definition with mapping', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'email',
          label: 'E-mail',
          type: 'email',
          mapping: { target: 'lead', attribute: 'email' },
        },
      ],
    })
    expect(result.success).toBe(true)
    expect(result.data?.fields[0].required).toBe(false)
  })

  it('should reject an invalid field type', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'x',
          label: 'X',
          type: 'invalid',
          mapping: { target: 'lead', attribute: 'name' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should reject a mapping attribute not valid for the target', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'x',
          label: 'X',
          type: 'text',
          mapping: { target: 'person', attribute: 'arr' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should reject duplicate field keys', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'name',
          label: 'Nome',
          type: 'text',
          mapping: { target: 'lead', attribute: 'name' },
        },
        {
          key: 'name',
          label: 'Nome 2',
          type: 'text',
          mapping: { target: 'lead', attribute: 'company' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should require at least one option for a select field', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'source',
          label: 'Origem',
          type: 'select',
          mapping: { target: 'lead', attribute: 'source' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('should accept a select field with options', () => {
    const result = CreateCrmFormSchema.safeParse({
      name: 'Contato',
      fields: [
        {
          key: 'source',
          label: 'Origem',
          type: 'select',
          options: [{ label: 'Site', value: 'site' }],
          mapping: { target: 'lead', attribute: 'source' },
        },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateCrmFormSchema', () => {
  it('should accept an empty payload', () => {
    expect(UpdateCrmFormSchema.safeParse({}).success).toBe(true)
  })

  it('should accept a status transition', () => {
    expect(UpdateCrmFormSchema.safeParse({ status: 'PUBLISHED' }).success).toBe(
      true,
    )
  })
})

describe('SubmitCrmFormSchema', () => {
  it('should accept a record of string and boolean values', () => {
    expect(
      SubmitCrmFormSchema.safeParse({
        values: { name: 'Jane', subscribe: true },
      }).success,
    ).toBe(true)
  })
})
