import { describe, expect, it } from 'vitest'
import { OpenSdApprovalRoundSchema } from '../sd-approval-round.schema'
import {
  CreateSdCabBoardSchema,
  SdCabMemberInputSchema,
  UpdateSdCabBoardSchema,
} from '../sd-cab-board.schema'
import {
  CreateSdChangeWindowSchema,
  SdChangeCalendarQuerySchema,
  SdChangeRecurrenceSchema,
  UpdateSdChangeWindowSchema,
} from '../sd-change-window.schema'

const window = {
  name: 'Janela de manutenção',
  startsAt: '2026-10-03T02:00:00.000Z',
  endsAt: '2026-10-03T06:00:00.000Z',
}

describe('SdChangeRecurrenceSchema', () => {
  it('applies the defaults', () => {
    expect(SdChangeRecurrenceSchema.parse({ freq: 'DAILY' })).toEqual({
      freq: 'DAILY',
      interval: 1,
      byDay: [],
      until: null,
      count: null,
    })
  })

  it('sorts byDay into week order', () => {
    expect(
      SdChangeRecurrenceSchema.parse({
        freq: 'WEEKLY',
        byDay: ['sun', 'wed', 'mon'],
      }).byDay,
    ).toEqual(['mon', 'wed', 'sun'])
  })

  it('refuses byDay outside a weekly recurrence', () => {
    const parsed = SdChangeRecurrenceSchema.safeParse({
      freq: 'MONTHLY',
      byDay: ['mon'],
    })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('repetição semanal')
  })

  it('refuses two limits at once', () => {
    const parsed = SdChangeRecurrenceSchema.safeParse({
      freq: 'DAILY',
      until: '2026-12-01',
      count: 10,
    })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('um limite')
  })

  it('refuses an unknown frequency, a bad date and a huge count', () => {
    expect(SdChangeRecurrenceSchema.safeParse({ freq: 'HOURLY' }).success).toBe(
      false,
    )
    expect(
      SdChangeRecurrenceSchema.safeParse({ freq: 'DAILY', until: '03/10/2026' })
        .success,
    ).toBe(false)
    expect(
      SdChangeRecurrenceSchema.safeParse({ freq: 'DAILY', count: 400 }).success,
    ).toBe(false)
    expect(
      SdChangeRecurrenceSchema.safeParse({ freq: 'DAILY', interval: 0 })
        .success,
    ).toBe(false)
  })
})

describe('CreateSdChangeWindowSchema', () => {
  it('coerces the dates and applies the defaults', () => {
    const parsed = CreateSdChangeWindowSchema.parse(window)
    expect(parsed.kind).toBe('MAINTENANCE')
    expect(parsed.timezone).toBe('America/Sao_Paulo')
    expect(parsed.configItemIds).toEqual([])
    expect(parsed.departmentIds).toEqual([])
    expect(parsed.startsAt).toBeInstanceOf(Date)
  })

  it('accepts a freeze window with scope and recurrence', () => {
    const parsed = CreateSdChangeWindowSchema.parse({
      ...window,
      kind: 'FREEZE',
      timezone: 'UTC',
      configItemIds: ['ci1'],
      departmentIds: ['dep1'],
      description: '  Nada entra  ',
      recurrence: { freq: 'WEEKLY', byDay: ['sat'] },
    })
    expect(parsed.kind).toBe('FREEZE')
    expect(parsed.description).toBe('Nada entra')
    expect(parsed.recurrence?.byDay).toEqual(['sat'])
  })

  it('refuses an unknown timezone and an empty name', () => {
    expect(
      CreateSdChangeWindowSchema.safeParse({
        ...window,
        timezone: 'Marte/Base',
      }).success,
    ).toBe(false)
    expect(
      CreateSdChangeWindowSchema.safeParse({ ...window, name: '  ' }).success,
    ).toBe(false)
  })

  it('does not validate the period (that is the service, with its own code)', () => {
    expect(
      CreateSdChangeWindowSchema.safeParse({
        ...window,
        endsAt: '2026-01-01T00:00:00.000Z',
      }).success,
    ).toBe(true)
  })
})

describe('UpdateSdChangeWindowSchema', () => {
  it('accepts a single field and a null recurrence', () => {
    expect(UpdateSdChangeWindowSchema.parse({ name: 'X' }).name).toBe('X')
    expect(
      UpdateSdChangeWindowSchema.parse({ recurrence: null }).recurrence,
    ).toBeNull()
  })

  it('refuses an empty payload', () => {
    const parsed = UpdateSdChangeWindowSchema.safeParse({})
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('ao menos um campo')
  })
})

describe('SdChangeCalendarQuerySchema', () => {
  it('coerces the range', () => {
    const parsed = SdChangeCalendarQuerySchema.parse({
      from: '2026-10-01T00:00:00.000Z',
      to: '2026-11-01T00:00:00.000Z',
      kind: 'FREEZE',
    })
    expect(parsed.from).toBeInstanceOf(Date)
    expect(parsed.kind).toBe('FREEZE')
  })

  it('refuses an inverted or empty range', () => {
    const parsed = SdChangeCalendarQuerySchema.safeParse({
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-10-01T00:00:00.000Z',
    })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('depois do início')
    expect(
      SdChangeCalendarQuerySchema.safeParse({
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-01T00:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('SdCabMemberInputSchema', () => {
  it('defaults required to false', () => {
    expect(SdCabMemberInputSchema.parse({ userId: 'u1' })).toEqual({
      userId: 'u1',
      required: false,
    })
  })
})

describe('CreateSdCabBoardSchema', () => {
  it('applies the defaults', () => {
    const parsed = CreateSdCabBoardSchema.parse({ name: 'CAB' })
    expect(parsed).toMatchObject({
      quorum: 0,
      rejectEnds: true,
      conditions: [],
      active: true,
      members: [],
    })
    expect(parsed.position).toBeUndefined()
  })

  it('refuses repeated members and more than 30', () => {
    const repeated = CreateSdCabBoardSchema.safeParse({
      name: 'CAB',
      members: [{ userId: 'u1' }, { userId: 'u1' }],
    })
    expect(repeated.success).toBe(false)
    expect(repeated.error?.issues[0]?.message).toContain('repetidos')
    expect(
      CreateSdCabBoardSchema.safeParse({
        name: 'CAB',
        members: Array.from({ length: 31 }, (_, i) => ({ userId: `u${i}` })),
      }).success,
    ).toBe(false)
  })

  it('refuses a negative quorum and an invalid condition', () => {
    expect(
      CreateSdCabBoardSchema.safeParse({ name: 'CAB', quorum: -1 }).success,
    ).toBe(false)
    expect(
      CreateSdCabBoardSchema.safeParse({
        name: 'CAB',
        conditions: [{ field: 'inventado', operator: 'equals', value: 'x' }],
      }).success,
    ).toBe(false)
  })

  it('accepts a condition on the change type and risk', () => {
    const parsed = CreateSdCabBoardSchema.parse({
      name: 'CAB',
      conditions: [
        { field: 'changeType', operator: 'equals', value: 'EMERGENCY' },
        { field: 'changeRisk', operator: 'in', value: ['HIGH', 'VERY_HIGH'] },
      ],
    })
    expect(parsed.conditions).toHaveLength(2)
  })
})

describe('UpdateSdCabBoardSchema', () => {
  it('accepts a single field', () => {
    expect(UpdateSdCabBoardSchema.parse({ quorum: 2 }).quorum).toBe(2)
    expect(UpdateSdCabBoardSchema.parse({ members: [] }).members).toEqual([])
  })

  it('refuses an empty payload', () => {
    const parsed = UpdateSdCabBoardSchema.safeParse({})
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toContain('ao menos um campo')
  })
})

describe('OpenSdApprovalRoundSchema', () => {
  it('defaults the validity to a week', () => {
    expect(OpenSdApprovalRoundSchema.parse({})).toEqual({ expiresInDays: 7 })
  })

  it('accepts a committee, a message and a custom validity', () => {
    expect(
      OpenSdApprovalRoundSchema.parse({
        boardId: 'board1',
        message: '  Aprovar  ',
        expiresInDays: '3',
      }),
    ).toEqual({ boardId: 'board1', message: 'Aprovar', expiresInDays: 3 })
  })

  it('refuses a validity outside 1–60 days', () => {
    expect(
      OpenSdApprovalRoundSchema.safeParse({ expiresInDays: 0 }).success,
    ).toBe(false)
    expect(
      OpenSdApprovalRoundSchema.safeParse({ expiresInDays: 61 }).success,
    ).toBe(false)
  })
})
