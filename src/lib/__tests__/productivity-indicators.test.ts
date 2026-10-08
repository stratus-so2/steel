import { describe, expect, it } from 'vitest'
import { STANDARD_CALENDAR } from '@/src/services/worklog.service'
import {
  availableMinutes,
  businessDayKeys,
  computeIndicators,
  factsOf,
  type IndicatorContext,
  type ProductivityFacts,
  ratio,
  weeklyTrend,
} from '../productivity/indicators'
import {
  addDayKey,
  dayKeySpan,
  inRange,
  localDayKey,
  localDayStart,
  previousRange,
  resolveWorklogDays,
  resolveWorklogRange,
  weekStartKey,
} from '../productivity/period'

const TZ = 'America/Sao_Paulo'
/** Local São Paulo time (UTC-3) → instant. */
const sp = (local: string) => new Date(`${local}:00.000-03:00`)

describe('productivity period', () => {
  const now = sp('2026-10-08T10:00')

  it('resolves the presets in the calendar time zone', () => {
    expect(resolveWorklogDays({ period: 'last_7_days' }, now, TZ)).toEqual({
      fromKey: '2026-10-02',
      toKey: '2026-10-08',
    })
    expect(resolveWorklogDays({ period: 'last_30_days' }, now, TZ)).toEqual({
      fromKey: '2026-09-09',
      toKey: '2026-10-08',
    })
    expect(resolveWorklogDays({ period: 'this_month' }, now, TZ)).toEqual({
      fromKey: '2026-10-01',
      toKey: '2026-10-08',
    })
    expect(
      resolveWorklogDays({ period: 'last_month' }, sp('2027-01-15T10:00'), TZ),
    ).toEqual({ fromKey: '2026-12-01', toKey: '2026-12-31' })
    expect(
      resolveWorklogDays(
        { period: 'custom', from: '2026-09-01', to: '2026-09-10' },
        now,
        TZ,
      ),
    ).toEqual({ fromKey: '2026-09-01', toKey: '2026-09-10' })
  })

  it('falls back to today on a custom range without days', () => {
    expect(resolveWorklogDays({ period: 'custom' }, now, TZ)).toEqual({
      fromKey: '2026-10-08',
      toKey: '2026-10-08',
    })
    expect(
      resolveWorklogDays({ period: 'custom', from: '2026-10-01' }, now, TZ),
    ).toEqual({ fromKey: '2026-10-01', toKey: '2026-10-01' })
  })

  it('turns days into local-midnight instants and the previous range', () => {
    const range = resolveWorklogRange({ period: 'last_7_days' }, now, TZ)
    expect(range.from.toISOString()).toBe('2026-10-02T03:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-09T03:00:00.000Z')
    const previous = previousRange(range)
    expect(previous.from.toISOString()).toBe('2026-09-25T03:00:00.000Z')
    expect(previous.to).toEqual(range.from)
  })

  it('does day arithmetic on keys', () => {
    expect(addDayKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(weekStartKey('2026-10-11')).toBe('2026-10-05') // Sunday → Monday
    expect(weekStartKey('2026-10-05')).toBe('2026-10-05')
    expect(dayKeySpan('2026-10-01', '2026-10-31')).toBe(31)
    expect(localDayKey(new Date('2026-10-09T01:00:00.000Z'), TZ)).toBe(
      '2026-10-08',
    )
    expect(localDayStart('2026-10-08', TZ).toISOString()).toBe(
      '2026-10-08T03:00:00.000Z',
    )
    const range = { from: sp('2026-10-01T00:00'), to: sp('2026-10-02T00:00') }
    expect(inRange(null, range)).toBe(false)
    expect(inRange(sp('2026-10-01T23:59'), range)).toBe(true)
    expect(inRange(sp('2026-10-02T00:00'), range)).toBe(false)
  })
})

const WEEK = { from: sp('2026-10-05T00:00'), to: sp('2026-10-12T00:00') }
const ALL_MODULES = { serviceDesk: true, crm: true, communication: true }

function ctx(overrides: Partial<IndicatorContext> = {}): IndicatorContext {
  return {
    range: WEEK,
    now: sp('2026-10-20T00:00'),
    calendar: STANDARD_CALENDAR,
    modules: ALL_MODULES,
    ...overrides,
  }
}

const FACTS: ProductivityFacts = {
  timeEntries: [
    {
      userId: 'u1',
      startedAt: sp('2026-10-05T10:00'),
      minutes: 120,
      billable: true,
      source: 'TIMER',
      amount: '200.00',
    },
    {
      userId: 'u1',
      startedAt: sp('2026-10-06T14:00'),
      minutes: 60,
      billable: false,
      source: 'MANUAL',
      amount: null,
    },
    {
      userId: 'u2',
      startedAt: sp('2026-10-07T09:00'),
      minutes: 240,
      billable: true,
      source: 'TIMER',
      amount: '100.00',
    },
    // previous week
    {
      userId: 'u1',
      startedAt: sp('2026-09-29T09:00'),
      minutes: 30,
      billable: true,
      source: 'TIMER',
      amount: null,
    },
  ],
  resolvedTickets: [
    {
      assigneeId: 'u1',
      createdAt: sp('2026-10-05T08:00'),
      firstRespondedAt: sp('2026-10-05T09:00'),
      firstResponseDueAt: sp('2026-10-05T12:00'),
      resolvedAt: sp('2026-10-07T08:00'),
      resolutionDueAt: sp('2026-10-08T17:00'),
      reopenCount: 0,
      loggedMinutes: 180,
    },
    {
      assigneeId: 'u1',
      createdAt: sp('2026-10-06T16:00'),
      firstRespondedAt: null,
      firstResponseDueAt: null,
      resolvedAt: sp('2026-10-08T10:00'),
      resolutionDueAt: sp('2026-10-07T12:00'),
      reopenCount: 1,
      loggedMinutes: 0,
    },
    {
      assigneeId: 'u1',
      createdAt: sp('2026-10-09T08:00'),
      firstRespondedAt: null,
      firstResponseDueAt: null,
      resolvedAt: sp('2026-10-09T09:00'),
      resolutionDueAt: null,
      reopenCount: 0,
      loggedMinutes: 30,
    },
    {
      assigneeId: 'u2',
      createdAt: sp('2026-10-05T08:00'),
      firstRespondedAt: sp('2026-10-05T08:30'),
      firstResponseDueAt: sp('2026-10-05T08:15'),
      resolvedAt: sp('2026-10-05T11:00'),
      resolutionDueAt: sp('2026-10-06T08:00'),
      reopenCount: 0,
      loggedMinutes: 60,
    },
  ],
  completedTasks: [
    { assigneeId: 'u1', completedAt: sp('2026-10-07T15:00') },
    { assigneeId: 'u1', completedAt: sp('2026-09-30T15:00') },
  ],
  wonOpportunities: [
    { ownerId: 'u2', closedAt: sp('2026-10-08T12:00'), amount: '1000.50' },
    { ownerId: 'u2', closedAt: sp('2026-10-09T12:00'), amount: null },
  ],
  conversations: [
    { userId: 'u1', at: sp('2026-10-05T09:00') },
    { userId: 'u1', at: sp('2026-10-06T09:00') },
    { userId: 'u2', at: sp('2026-10-01T09:00') },
  ],
}

describe('productivity indicators', () => {
  it('computes one person separately, indicator by indicator', () => {
    const set = computeIndicators(factsOf(FACTS, 'u1'), ctx(), ['u1'])
    expect(set.serviceDesk).toEqual({
      loggedMinutes: 180,
      businessMinutes: 2400,
      utilization: 0.075,
      billableShare: 0.6667,
      billedAmount: '200.00',
      ticketsResolved: 3,
      minutesPerResolvedTicket: 70,
      avgFirstResponseMinutes: 60,
      avgResolutionMinutes: 560,
      slaCompliance: 0.5,
      reopenRate: 0.3333,
      timerShare: 0.6667,
      daysWithoutEntries: 3,
      businessDays: 5,
    })
    expect(set.crm).toEqual({
      tasksCompleted: 1,
      opportunitiesWon: 0,
      wonAmount: '0.00',
    })
    expect(set.communication).toEqual({ conversationsHandled: 2 })
  })

  it('sums the team over the people who logged time', () => {
    const set = computeIndicators(FACTS, ctx(), ['u1', 'u2', 'u3'])
    const sd = set.serviceDesk
    expect(sd?.loggedMinutes).toBe(420)
    // 420 ÷ (2400 × 2 people who logged) — u3 never logs, does not dilute.
    expect(sd?.utilization).toBe(0.0875)
    expect(sd?.billedAmount).toBe('300.00')
    expect(sd?.daysWithoutEntries).toBe(3.5)
    expect(sd?.ticketsResolved).toBe(4)
    // u2's ticket answered late: SLA missed.
    expect(sd?.slaCompliance).toBe(0.3333)
    expect(set.crm?.opportunitiesWon).toBe(2)
    expect(set.crm?.wonAmount).toBe('1000.50')
  })

  it('compares with the previous period using the same facts', () => {
    const set = computeIndicators(
      factsOf(FACTS, 'u1'),
      ctx({ range: previousRange(WEEK) }),
      ['u1'],
    )
    expect(set.serviceDesk?.loggedMinutes).toBe(30)
    expect(set.serviceDesk?.ticketsResolved).toBe(0)
    expect(set.serviceDesk?.minutesPerResolvedTicket).toBeNull()
    expect(set.serviceDesk?.avgResolutionMinutes).toBeNull()
    expect(set.serviceDesk?.slaCompliance).toBeNull()
    expect(set.crm?.tasksCompleted).toBe(1)
  })

  it('leaves out modules that are switched off', () => {
    const set = computeIndicators(
      FACTS,
      ctx({
        modules: { serviceDesk: false, crm: false, communication: false },
      }),
      ['u1'],
    )
    expect(set).toEqual({ serviceDesk: null, crm: null, communication: null })
  })

  it('counts only the elapsed part of a running period', () => {
    const running = ctx({ now: sp('2026-10-07T12:00') })
    expect(availableMinutes(running)).toBe(1200)
    expect(businessDayKeys(running)).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ])
    const future = ctx({ now: sp('2026-10-01T00:00') })
    expect(businessDayKeys(future)).toEqual([])
    const set = computeIndicators({ ...FACTS, timeEntries: [] }, future, [
      'u1',
      'u2',
    ])
    expect(set.serviceDesk?.utilization).toBeNull()
    expect(set.serviceDesk?.billableShare).toBeNull()
    expect(set.serviceDesk?.timerShare).toBeNull()
    expect(set.serviceDesk?.daysWithoutEntries).toBeNull()
  })

  it('builds the weekly trend inside the range only', () => {
    const range = { from: sp('2026-10-05T00:00'), to: sp('2026-10-19T00:00') }
    const weeks = weeklyTrend(FACTS, ctx({ range }))
    expect(weeks).toEqual([
      {
        weekStart: '2026-10-05',
        loggedMinutes: 420,
        ticketsResolved: 4,
        tasksCompleted: 1,
        opportunitiesWon: 2,
        conversationsHandled: 2,
      },
      {
        weekStart: '2026-10-12',
        loggedMinutes: 0,
        ticketsResolved: 0,
        tasksCompleted: 0,
        opportunitiesWon: 0,
        conversationsHandled: 0,
      },
    ])
    const sdOnly = weeklyTrend(
      FACTS,
      ctx({ modules: { serviceDesk: true, crm: false, communication: false } }),
    )
    expect(sdOnly[0].tasksCompleted).toBeNull()
    expect(sdOnly[0].conversationsHandled).toBeNull()
    expect(sdOnly[0].loggedMinutes).toBe(420)
  })

  it('returns null ratios for an empty denominator', () => {
    expect(ratio(1, 0)).toBeNull()
    expect(ratio(1, 3)).toBe(0.3333)
  })
})
