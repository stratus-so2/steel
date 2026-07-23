import { describe, expect, it } from 'vitest'
import {
  CreateCrmCustomFieldSchema,
  ReorderCrmCustomFieldsSchema,
  SetCrmCustomFieldValueSchema,
  UpdateCrmCustomFieldSchema,
} from '../crm-custom-field.schema'

describe('CreateCrmCustomFieldSchema', () => {
  it('should apply defaults', () => {
    const result = CreateCrmCustomFieldSchema.safeParse({
      entity: 'COMPANY',
      key: 'segment',
      label: 'Segmento',
    })
    expect(result.success).toBe(true)
    expect(result.data?.type).toBe('TEXT')
    expect(result.data?.required).toBe(false)
  })

  it('should reject an invalid key format', () => {
    const result = CreateCrmCustomFieldSchema.safeParse({
      entity: 'COMPANY',
      key: 'Segment Name',
      label: 'Segmento',
    })
    expect(result.success).toBe(false)
  })

  it('should reject an invalid entity', () => {
    const result = CreateCrmCustomFieldSchema.safeParse({
      entity: 'INVALID',
      key: 'segment',
      label: 'Segmento',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateCrmCustomFieldSchema', () => {
  it('should leave required undefined when omitted', () => {
    const result = UpdateCrmCustomFieldSchema.safeParse({ label: 'Novo' })
    expect(result.data?.required).toBeUndefined()
  })
})

describe('ReorderCrmCustomFieldsSchema', () => {
  it('should reject an empty orderedIds array', () => {
    expect(
      ReorderCrmCustomFieldsSchema.safeParse({ orderedIds: [] }).success,
    ).toBe(false)
  })
})

describe('SetCrmCustomFieldValueSchema', () => {
  it('should accept string, number, boolean and null values', () => {
    expect(SetCrmCustomFieldValueSchema.safeParse({ value: 'x' }).success).toBe(
      true,
    )
    expect(SetCrmCustomFieldValueSchema.safeParse({ value: 1 }).success).toBe(
      true,
    )
    expect(
      SetCrmCustomFieldValueSchema.safeParse({ value: true }).success,
    ).toBe(true)
    expect(
      SetCrmCustomFieldValueSchema.safeParse({ value: null }).success,
    ).toBe(true)
  })

  it('should reject an object value', () => {
    expect(SetCrmCustomFieldValueSchema.safeParse({ value: {} }).success).toBe(
      false,
    )
  })
})
