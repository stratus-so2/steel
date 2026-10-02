import { describe, expect, it } from 'vitest'
import {
  CreateSdRecurringTicketSchema,
  ListSdRecurringTicketRunsSchema,
  ListSdRecurringTicketsSchema,
  UpdateSdRecurringTicketSchema,
} from '@/src/schemas/sd-recurring-ticket.schema'

const base = {
  name: 'Vistoria mensal',
  ticketType: 'SERVICE_REQUEST' as const,
  startsAt: '2026-10-01T03:00:00.000Z',
}

describe('CreateSdRecurringTicketSchema', () => {
  it('applies the defaults of a monthly routine', () => {
    const parsed = CreateSdRecurringTicketSchema.parse(base)
    expect(parsed).toMatchObject({
      frequency: 'MONTHLY',
      interval: 1,
      byWeekday: [],
      atTime: '08:00',
      timezone: 'America/Sao_Paulo',
      leadTimeMinutes: 0,
      skipIfOpen: true,
      active: true,
      defaults: {},
    })
    expect(parsed.startsAt).toBeInstanceOf(Date)
  })

  it('accepts the whole schedule and the ticket defaults', () => {
    const parsed = CreateSdRecurringTicketSchema.parse({
      ...base,
      frequency: 'WEEKLY',
      interval: 2,
      byWeekday: [1, 4],
      byMonthday: null,
      atTime: '07:30',
      timezone: 'America/Manaus',
      endsAt: '2027-01-01T03:00:00.000Z',
      leadTimeMinutes: 120,
      skipIfOpen: false,
      active: false,
      templateId: 'tpl1',
      customerId: 'cus1',
      configItemId: 'ci1',
      departmentId: 'dep1',
      assigneeId: 'u1',
      defaults: { title: 'Backup', tags: ['preventiva'] },
    })
    expect(parsed).toMatchObject({
      frequency: 'WEEKLY',
      interval: 2,
      byWeekday: [1, 4],
      atTime: '07:30',
      leadTimeMinutes: 120,
      skipIfOpen: false,
      active: false,
      defaults: { title: 'Backup', tags: ['preventiva'] },
    })
  })

  it.each([
    ['no name', { name: '' }],
    ['no ticket type', { ticketType: 'OTHER' }],
    ['no start', { startsAt: undefined }],
    ['an unknown frequency', { frequency: 'HOURLY' }],
    ['a zero interval', { interval: 0 }],
    ['an interval above the cap', { interval: 400 }],
    ['a weekday out of range', { byWeekday: [7] }],
    ['too many weekdays', { byWeekday: [0, 1, 2, 3, 4, 5, 6, 0] }],
    ['a monthday of 0', { byMonthday: 0 }],
    ['a monthday of 32', { byMonthday: 32 }],
    ['a time without the colon', { atTime: '0800' }],
    ['the 24th hour', { atTime: '24:00' }],
    ['an empty timezone', { timezone: '' }],
    ['a negative lead time', { leadTimeMinutes: -1 }],
    ['a lead time above 30 days', { leadTimeMinutes: 43_201 }],
    ['an unknown key in the defaults', { defaults: { nope: true } }],
  ])('refuses %s', (_label, overrides) => {
    expect(
      CreateSdRecurringTicketSchema.safeParse({ ...base, ...overrides })
        .success,
    ).toBe(false)
  })
})

describe('UpdateSdRecurringTicketSchema', () => {
  it('accepts a single field', () => {
    expect(UpdateSdRecurringTicketSchema.parse({ active: false })).toEqual({
      active: false,
    })
  })

  it('accepts clearing the monthday and the validity end', () => {
    expect(
      UpdateSdRecurringTicketSchema.parse({ byMonthday: null, endsAt: null }),
    ).toEqual({ byMonthday: null, endsAt: null })
  })

  it('refuses an empty payload', () => {
    expect(UpdateSdRecurringTicketSchema.safeParse({}).success).toBe(false)
  })

  it('refuses an invalid time', () => {
    expect(
      UpdateSdRecurringTicketSchema.safeParse({ atTime: '7:00' }).success,
    ).toBe(false)
  })
})

describe('ListSdRecurringTicketsSchema', () => {
  it('reads the filters from the query string', () => {
    expect(
      ListSdRecurringTicketsSchema.parse({
        ticketType: 'CHANGE',
        configItemId: 'ci1',
        customerId: 'cus1',
        includeInactive: 'true',
      }),
    ).toEqual({
      ticketType: 'CHANGE',
      configItemId: 'ci1',
      customerId: 'cus1',
      includeInactive: true,
    })
  })

  it('defaults to the active rules', () => {
    expect(ListSdRecurringTicketsSchema.parse({})).toEqual({
      includeInactive: false,
    })
  })
})

describe('ListSdRecurringTicketRunsSchema', () => {
  it('defaults the limit to 50 and coerces the query value', () => {
    expect(ListSdRecurringTicketRunsSchema.parse({})).toEqual({ limit: 50 })
    expect(ListSdRecurringTicketRunsSchema.parse({ limit: '10' })).toEqual({
      limit: 10,
    })
  })

  it('refuses a limit above the cap', () => {
    expect(
      ListSdRecurringTicketRunsSchema.safeParse({ limit: '500' }).success,
    ).toBe(false)
  })
})
