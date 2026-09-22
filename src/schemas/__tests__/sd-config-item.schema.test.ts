import { describe, expect, it } from 'vitest'
import {
  CreateSdConfigItemSchema,
  CreateSdConfigItemTypeSchema,
  ListSdConfigItemsSchema,
  SdConfigItemOptionsSchema,
  UpdateSdConfigItemSchema,
  UpdateSdConfigItemTypeSchema,
} from '../sd-config-item.schema'

describe('CI type schemas', () => {
  it('accepts a valid attribute schema', () => {
    expect(
      CreateSdConfigItemTypeSchema.parse({
        name: 'Servidor',
        color: '#2563EB',
        attributeSchema: [
          { key: 'os', label: 'SO', type: 'select', options: ['Linux'] },
          { key: 'ram_gb', label: 'RAM', type: 'number', required: true },
        ],
      }),
    ).toMatchObject({ name: 'Servidor', color: '#2563EB' })
    expect(CreateSdConfigItemTypeSchema.parse({ name: 'X' })).toEqual({
      name: 'X',
      attributeSchema: [],
    })
  })

  it.each([
    [{ name: 'X', color: 'blue' }],
    [
      {
        name: 'X',
        attributeSchema: [{ key: 'Bad Key', label: 'A', type: 'text' }],
      },
    ],
    [
      {
        name: 'X',
        attributeSchema: [{ key: 'a', label: 'A', type: 'select' }],
      },
    ],
    [{ name: 'X', attributeSchema: [{ key: 'a', label: 'A', type: 'json' }] }],
    [
      {
        name: 'X',
        attributeSchema: [
          { key: 'a', label: 'A', type: 'text' },
          { key: 'a', label: 'B', type: 'text' },
        ],
      },
    ],
  ])('rejects %j', (input) => {
    expect(CreateSdConfigItemTypeSchema.safeParse(input).success).toBe(false)
  })

  it('update is partial and clears the color', () => {
    expect(UpdateSdConfigItemTypeSchema.parse({ color: '' })).toEqual({
      color: null,
    })
  })
})

describe('CI schemas', () => {
  it('applies defaults and coerces dates', () => {
    const parsed = CreateSdConfigItemSchema.parse({
      name: 'SRV',
      warrantyUntil: '2027-01-31',
      ipAddress: '10.0.0.1',
    })
    expect(parsed).toMatchObject({
      status: 'ACTIVE',
      criticality: 'MEDIUM',
      attributes: {},
      customFields: {},
      ipAddress: '10.0.0.1',
    })
    expect(parsed.warrantyUntil).toBeInstanceOf(Date)
  })

  it('accepts IPv6, clears blanks and rejects bad IPs/status', () => {
    expect(
      UpdateSdConfigItemSchema.parse({ ipAddress: '::1', parentId: '' }),
    ).toEqual({ ipAddress: '::1', parentId: null })
    expect(
      CreateSdConfigItemSchema.safeParse({ name: 'X', ipAddress: '999.1.1.1' })
        .success,
    ).toBe(false)
    expect(
      CreateSdConfigItemSchema.safeParse({ name: 'X', status: 'BROKEN' })
        .success,
    ).toBe(false)
    expect(
      CreateSdConfigItemSchema.safeParse({ name: 'X', attributes: { a: {} } })
        .success,
    ).toBe(false)
  })

  it('parses list filters', () => {
    expect(
      ListSdConfigItemsSchema.parse({
        warrantyExpiringInDays: '30',
        status: 'ACTIVE',
        sort: 'warrantyUntil',
      }),
    ).toMatchObject({
      warrantyExpiringInDays: 30,
      status: 'ACTIVE',
      sort: 'warrantyUntil',
      page: 1,
    })
    expect(
      ListSdConfigItemsSchema.safeParse({ warrantyExpiringInDays: '-1' })
        .success,
    ).toBe(false)
    expect(SdConfigItemOptionsSchema.parse({ excludeId: 'x' })).toEqual({
      excludeId: 'x',
      limit: 20,
    })
  })
})
