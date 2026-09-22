import { describe, expect, it } from 'vitest'
import {
  CreateSdContactSchema,
  ListSdContactsSchema,
  SdContactLookupSchema,
  SdContactOptionsSchema,
  UpdateSdContactSchema,
} from '../sd-contact.schema'

describe('sd-contact schemas', () => {
  it('applies defaults on create', () => {
    expect(CreateSdContactSchema.parse({ name: ' Ana ' })).toEqual({
      name: 'Ana',
      customers: [],
      customFields: {},
      active: true,
    })
  })

  it('defaults link isPrimary and rejects two primaries', () => {
    expect(
      CreateSdContactSchema.parse({
        name: 'Ana',
        customers: [{ customerId: 'c1' }],
      }).customers,
    ).toEqual([{ customerId: 'c1', isPrimary: false }])
    expect(
      CreateSdContactSchema.safeParse({
        name: 'Ana',
        customers: [
          { customerId: 'c1', isPrimary: true },
          { customerId: 'c2', isPrimary: true },
        ],
      }).success,
    ).toBe(false)
  })

  it('clears optional fields on update', () => {
    expect(
      UpdateSdContactSchema.parse({ userId: '', email: '', jobTitle: null }),
    ).toEqual({ userId: null, email: null, jobTitle: null })
    expect(UpdateSdContactSchema.safeParse({ email: 'x' }).success).toBe(false)
  })

  it('parses list and options queries', () => {
    expect(
      ListSdContactsSchema.parse({ customerId: 'c1', active: 'true' }),
    ).toMatchObject({ customerId: 'c1', active: true, sort: 'name' })
    expect(SdContactOptionsSchema.parse({ customerId: 'c1' })).toEqual({
      customerId: 'c1',
      limit: 20,
    })
  })

  it('lookup requires whatsapp or email', () => {
    expect(SdContactLookupSchema.safeParse({}).success).toBe(false)
    expect(SdContactLookupSchema.parse({ whatsapp: '5511' })).toEqual({
      whatsapp: '5511',
    })
  })
})
