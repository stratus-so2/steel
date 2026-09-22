import { describe, expect, it } from 'vitest'
import {
  createFakeSdCustomer,
  createFakeSdCustomerDetail,
} from '@/src/__tests__/factories/sd-customer.factory'
import { toSdCustomerDetailDTO, toSdCustomerDTO } from '../sd-customer.mapper'
import { toSdCustomFieldValues } from '../sd-directory.mapper'

describe('sd-customer mapper', () => {
  it('maps the row with ISO dates and counts', () => {
    const now = new Date('2026-09-21T10:00:00Z')
    const dto = toSdCustomerDTO(
      createFakeSdCustomer({
        id: 'c1',
        createdAt: now,
        updatedAt: now,
        customFields: { plano: 'ouro' },
        _count: { contacts: 4, configItems: 1 },
      }),
    )
    expect(dto).toMatchObject({
      id: 'c1',
      kind: 'CLIENT',
      personType: 'LEGAL',
      document: '11222333000181',
      customFields: { plano: 'ouro' },
      contactsCount: 4,
      configItemsCount: 1,
      createdAt: '2026-09-21T10:00:00.000Z',
      updatedAt: '2026-09-21T10:00:00.000Z',
    })
    expect(dto).not.toHaveProperty('deletedAt')
    expect(dto).not.toHaveProperty('_count')
  })

  it('maps the detail with contacts and tickets', () => {
    const detail = toSdCustomerDetailDTO(
      createFakeSdCustomerDetail({
        contacts: [
          {
            contactId: 'p1',
            customerId: 'c1',
            isPrimary: false,
            contact: {
              id: 'p1',
              name: 'Bia',
              jobTitle: null,
              email: 'bia@x.com',
              phone: null,
              whatsapp: '5511999999999',
            },
          },
        ],
      }),
      [],
    )
    expect(detail.contacts[0]).toEqual({
      id: 'p1',
      name: 'Bia',
      jobTitle: null,
      email: 'bia@x.com',
      phone: null,
      whatsapp: '5511999999999',
      isPrimary: false,
    })
    expect(detail.recentTickets).toEqual([])
  })

  it('coerces non-object custom fields to {}', () => {
    expect(toSdCustomFieldValues({ a: 1 })).toEqual({ a: 1 })
    expect(toSdCustomFieldValues(null)).toEqual({})
    expect(toSdCustomFieldValues([1, 2])).toEqual({})
    expect(toSdCustomFieldValues('x')).toEqual({})
  })
})
