import { describe, expect, it } from 'vitest'
import {
  CreateSdCustomerSchema,
  ListSdCustomersSchema,
  SdCustomerOptionsSchema,
  UpdateSdCustomerSchema,
} from '../sd-customer.schema'
import {
  optionalDate,
  optionalId,
  SdCustomFieldValuesSchema,
  SdOptionsQuerySchema,
} from '../sd-directory.schema'

describe('sd-directory schema pieces', () => {
  it('accepts custom field objects of primitives and arrays', () => {
    expect(
      SdCustomFieldValuesSchema.parse({
        a: 'x',
        b: 1,
        c: true,
        d: null,
        e: ['x', 2, false, null],
      }),
    ).toBeTruthy()
  })

  it('rejects nested objects, non-finite numbers and too many keys', () => {
    expect(SdCustomFieldValuesSchema.safeParse({ a: { b: 1 } }).success).toBe(
      false,
    )
    expect(
      SdCustomFieldValuesSchema.safeParse({ a: Number.POSITIVE_INFINITY })
        .success,
    ).toBe(false)
    expect(SdCustomFieldValuesSchema.safeParse([1]).success).toBe(false)
    const many = Object.fromEntries(
      Array.from({ length: 201 }, (_, i) => [`k${i}`, i]),
    )
    expect(SdCustomFieldValuesSchema.safeParse(many).success).toBe(false)
  })

  it('defaults the options query and clamps the limit', () => {
    expect(SdOptionsQuerySchema.parse({})).toEqual({ limit: 20 })
    expect(SdOptionsQuerySchema.safeParse({ limit: '51' }).success).toBe(false)
  })

  it('optionalId/optionalDate turn blanks into null', () => {
    expect(optionalId().parse('')).toBeNull()
    expect(optionalId().parse('abc')).toBe('abc')
    expect(optionalDate().parse('')).toBeNull()
    expect(optionalDate().parse('2026-01-02')).toBeInstanceOf(Date)
    expect(optionalDate().parse(undefined)).toBeUndefined()
  })
})

describe('CreateSdCustomerSchema', () => {
  it('applies defaults and trims', () => {
    const parsed = CreateSdCustomerSchema.parse({ name: '  Acme  ' })
    expect(parsed).toEqual({
      kind: 'CLIENT',
      name: 'Acme',
      country: 'BR',
      customFields: {},
      active: true,
    })
  })

  it('normalizes zip code and state, and turns blanks into null', () => {
    const parsed = CreateSdCustomerSchema.parse({
      name: 'Acme',
      zipCode: '01001-000',
      state: ' sp ',
      tradeName: '',
      email: '',
      phone: '',
    })
    expect(parsed).toMatchObject({
      zipCode: '01001000',
      state: 'SP',
      tradeName: null,
      email: null,
      phone: null,
    })
  })

  it.each([
    [{ name: '' }],
    [{ name: 'A', email: 'nope' }],
    [{ name: 'A', zipCode: '123' }],
    [{ name: 'A', state: 'São Paulo' }],
    [{ name: 'A', phone: 'abc' }],
    [{ name: 'A', kind: 'OTHER' }],
    [{ name: 'A', country: 'BRA' }],
  ])('rejects %j', (input) => {
    expect(CreateSdCustomerSchema.safeParse(input).success).toBe(false)
  })

  it('accepts null zip/state (non-string passthrough)', () => {
    const parsed = CreateSdCustomerSchema.parse({
      name: 'A',
      zipCode: null,
      state: null,
    })
    expect(parsed.zipCode).toBeNull()
    expect(parsed.state).toBeNull()
  })
})

describe('UpdateSdCustomerSchema', () => {
  it('is fully optional and supports clearing', () => {
    expect(UpdateSdCustomerSchema.parse({})).toEqual({})
    expect(UpdateSdCustomerSchema.parse({ document: '', notes: null })).toEqual(
      { document: null, notes: null },
    )
    expect(UpdateSdCustomerSchema.parse({ country: 'ar' }).country).toBe('AR')
  })
})

describe('ListSdCustomersSchema', () => {
  it('parses query string values with defaults', () => {
    expect(ListSdCustomersSchema.parse({})).toEqual({
      page: 1,
      pageSize: 25,
      order: 'asc',
      sort: 'name',
    })
    expect(
      ListSdCustomersSchema.parse({
        page: '3',
        pageSize: '50',
        active: 'false',
        state: 'rj',
        sort: 'createdAt',
        order: 'desc',
      }),
    ).toMatchObject({
      page: 3,
      pageSize: 50,
      active: false,
      state: 'RJ',
      sort: 'createdAt',
      order: 'desc',
    })
  })

  it('rejects invalid pagination and sort', () => {
    expect(ListSdCustomersSchema.safeParse({ pageSize: '500' }).success).toBe(
      false,
    )
    expect(ListSdCustomersSchema.safeParse({ sort: 'x' }).success).toBe(false)
    expect(ListSdCustomersSchema.safeParse({ active: 'yes' }).success).toBe(
      false,
    )
  })

  it('options schema accepts kind', () => {
    expect(SdCustomerOptionsSchema.parse({ kind: 'COMPANY' })).toEqual({
      kind: 'COMPANY',
      limit: 20,
    })
  })
})
