import { sdMoney, sdSum } from '@/src/lib/servicedesk/money'
import {
  businessMinutesBetween,
  type SdCalendar,
} from '@/src/lib/servicedesk/sla'
import {
  addDayKey,
  inRange,
  type LocalRange,
  localDayKey,
  localDayStart,
  weekStartKey,
} from './period'

/**
 * Productivity indicators (pure). Each indicator stands on its own: there
 * is no combined score and nothing here ranks people. Only data people
 * already record while working feeds it — time entries, tickets, CRM tasks
 * and deals, WhatsApp replies. Ratios are 0–1 (4 decimals) and `null` when
 * the denominator is empty; durations are business minutes of the calendar.
 */

export interface ProductivityModules {
  serviceDesk: boolean
  crm: boolean
  communication: boolean
}

export interface TimeEntryFact {
  userId: string
  startedAt: Date
  minutes: number
  billable: boolean
  source: 'TIMER' | 'MANUAL'
  /** Decimal as string. */
  amount: string | null
}

export interface ResolvedTicketFact {
  assigneeId: string | null
  createdAt: Date
  firstRespondedAt: Date | null
  firstResponseDueAt: Date | null
  resolvedAt: Date
  resolutionDueAt: Date | null
  reopenCount: number
  /** Minutes logged on the ticket by anyone, all time. */
  loggedMinutes: number
}

export interface CompletedTaskFact {
  assigneeId: string | null
  completedAt: Date
}

export interface WonOpportunityFact {
  ownerId: string | null
  closedAt: Date
  amount: string | null
}

/** First reply of a person in one conversation inside the window. */
export interface HandledConversationFact {
  userId: string
  at: Date
}

export interface ProductivityFacts {
  timeEntries: TimeEntryFact[]
  resolvedTickets: ResolvedTicketFact[]
  completedTasks: CompletedTaskFact[]
  wonOpportunities: WonOpportunityFact[]
  conversations: HandledConversationFact[]
}

export interface ServiceDeskIndicators {
  loggedMinutes: number
  /** Business minutes of one person in the elapsed part of the period. */
  businessMinutes: number
  /** Logged ÷ business minutes (× people for the team). */
  utilization: number | null
  billableShare: number | null
  billedAmount: string
  ticketsResolved: number
  minutesPerResolvedTicket: number | null
  avgFirstResponseMinutes: number | null
  avgResolutionMinutes: number | null
  /** Resolved tickets that met their SLA deadlines ÷ those that had one. */
  slaCompliance: number | null
  reopenRate: number | null
  /** Minutes from the timer ÷ all minutes. */
  timerShare: number | null
  /** Business days without a single entry (team: average per person). */
  daysWithoutEntries: number | null
  businessDays: number
}

export interface CrmIndicators {
  tasksCompleted: number
  opportunitiesWon: number
  wonAmount: string
}

export interface CommunicationIndicators {
  conversationsHandled: number
}

export interface IndicatorSet {
  serviceDesk: ServiceDeskIndicators | null
  crm: CrmIndicators | null
  communication: CommunicationIndicators | null
}

export interface TrendWeek {
  /** Monday, `YYYY-MM-DD` in the calendar's time zone. */
  weekStart: string
  loggedMinutes: number | null
  ticketsResolved: number | null
  tasksCompleted: number | null
  opportunitiesWon: number | null
  conversationsHandled: number | null
}

export interface IndicatorContext {
  range: LocalRange
  now: Date
  calendar: SdCalendar
  modules: ProductivityModules
}

export function ratio(part: number, whole: number): number | null {
  if (whole <= 0) return null
  return Math.round((part / whole) * 10_000) / 10_000
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

/** End of the part of the range that already happened. */
function elapsedEnd(ctx: IndicatorContext): Date {
  return new Date(Math.min(ctx.range.to.getTime(), ctx.now.getTime()))
}

/** Civil days (keys) of the elapsed range that have business hours. */
export function businessDayKeys(ctx: IndicatorContext): string[] {
  const tz = ctx.calendar.timezone
  const end = elapsedEnd(ctx)
  if (end.getTime() <= ctx.range.from.getTime()) return []
  const keys: string[] = []
  let key = localDayKey(ctx.range.from, tz)
  const lastKey = localDayKey(new Date(end.getTime() - 1), tz)
  for (let guard = 0; guard < 400 && key <= lastKey; guard++) {
    const start = localDayStart(key, tz)
    const next = localDayStart(addDayKey(key, 1), tz)
    if (businessMinutesBetween(start, next, ctx.calendar) > 0) keys.push(key)
    key = addDayKey(key, 1)
  }
  return keys
}

/** Business minutes one person had available in the elapsed range. */
export function availableMinutes(ctx: IndicatorContext): number {
  const end = elapsedEnd(ctx)
  return businessMinutesBetween(ctx.range.from, end, ctx.calendar)
}

function slaMet(ticket: ResolvedTicketFact): boolean | null {
  const hasDeadline =
    ticket.resolutionDueAt !== null || ticket.firstResponseDueAt !== null
  if (!hasDeadline) return null
  const lateResolution =
    ticket.resolutionDueAt !== null &&
    ticket.resolvedAt.getTime() > ticket.resolutionDueAt.getTime()
  const lateResponse =
    ticket.firstResponseDueAt !== null &&
    ticket.firstRespondedAt !== null &&
    ticket.firstRespondedAt.getTime() > ticket.firstResponseDueAt.getTime()
  return !lateResolution && !lateResponse
}

function serviceDeskIndicators(
  facts: ProductivityFacts,
  ctx: IndicatorContext,
  people: string[],
): ServiceDeskIndicators {
  const entries = facts.timeEntries.filter((e) =>
    inRange(e.startedAt, ctx.range),
  )
  const tickets = facts.resolvedTickets.filter((t) =>
    inRange(t.resolvedAt, ctx.range),
  )
  const loggedMinutes = entries.reduce((sum, e) => sum + e.minutes, 0)
  const billableMinutes = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + e.minutes, 0)
  const timerMinutes = entries
    .filter((e) => e.source === 'TIMER')
    .reduce((sum, e) => sum + e.minutes, 0)
  const businessMinutes = availableMinutes(ctx)
  const dayKeys = businessDayKeys(ctx)

  // People who logged anything carry the team's capacity and gaps: someone
  // who never logs time (sales, for example) does not dilute the numbers.
  const loggers = new Set(entries.map((e) => e.userId))
  const capacityPeople = people.length === 1 ? 1 : loggers.size
  const gaps = (people.length === 1 ? people : [...loggers]).map((userId) => {
    const days = new Set(
      entries
        .filter((e) => e.userId === userId)
        .map((e) => localDayKey(e.startedAt, ctx.calendar.timezone)),
    )
    return dayKeys.filter((key) => !days.has(key)).length
  })
  const daysWithoutEntries =
    gaps.length === 0
      ? null
      : Math.round((gaps.reduce((s, g) => s + g, 0) / gaps.length) * 10) / 10

  const firstResponses = tickets
    .filter((t) => t.firstRespondedAt !== null)
    .map((t) =>
      businessMinutesBetween(
        t.createdAt,
        t.firstRespondedAt as Date,
        ctx.calendar,
      ),
    )
  const resolutions = tickets.map((t) =>
    businessMinutesBetween(t.createdAt, t.resolvedAt, ctx.calendar),
  )
  const sla = tickets.map(slaMet).filter((v): v is boolean => v !== null)
  const ticketMinutes = tickets.reduce((sum, t) => sum + t.loggedMinutes, 0)

  return {
    loggedMinutes,
    businessMinutes,
    utilization: ratio(loggedMinutes, businessMinutes * capacityPeople),
    billableShare: ratio(billableMinutes, loggedMinutes),
    billedAmount: sdMoney(
      sdSum(entries.filter((e) => e.billable).map((e) => e.amount ?? 0)),
    ),
    ticketsResolved: tickets.length,
    minutesPerResolvedTicket:
      tickets.length === 0 ? null : Math.round(ticketMinutes / tickets.length),
    avgFirstResponseMinutes: average(firstResponses),
    avgResolutionMinutes: average(resolutions),
    slaCompliance: ratio(sla.filter(Boolean).length, sla.length),
    reopenRate: ratio(
      tickets.filter((t) => t.reopenCount > 0).length,
      tickets.length,
    ),
    timerShare: ratio(timerMinutes, loggedMinutes),
    daysWithoutEntries,
    businessDays: dayKeys.length,
  }
}

/**
 * Indicators of `people` (one id = a person; several = the team). Facts
 * must already be limited to those people; they may span more than the
 * range (previous period) — each indicator filters by its own date.
 */
export function computeIndicators(
  facts: ProductivityFacts,
  ctx: IndicatorContext,
  people: string[],
): IndicatorSet {
  const wins = facts.wonOpportunities.filter((o) =>
    inRange(o.closedAt, ctx.range),
  )
  return {
    serviceDesk: ctx.modules.serviceDesk
      ? serviceDeskIndicators(facts, ctx, people)
      : null,
    crm: ctx.modules.crm
      ? {
          tasksCompleted: facts.completedTasks.filter((t) =>
            inRange(t.completedAt, ctx.range),
          ).length,
          opportunitiesWon: wins.length,
          wonAmount: sdMoney(sdSum(wins.map((o) => o.amount ?? 0))),
        }
      : null,
    communication: ctx.modules.communication
      ? {
          conversationsHandled: facts.conversations.filter((c) =>
            inRange(c.at, ctx.range),
          ).length,
        }
      : null,
  }
}

/** Only the facts that belong to `userId`. */
export function factsOf(
  facts: ProductivityFacts,
  userId: string,
): ProductivityFacts {
  return {
    timeEntries: facts.timeEntries.filter((e) => e.userId === userId),
    resolvedTickets: facts.resolvedTickets.filter(
      (t) => t.assigneeId === userId,
    ),
    completedTasks: facts.completedTasks.filter((t) => t.assigneeId === userId),
    wonOpportunities: facts.wonOpportunities.filter(
      (o) => o.ownerId === userId,
    ),
    conversations: facts.conversations.filter((c) => c.userId === userId),
  }
}

/** Weekly volumes (Monday-based weeks) over the range, oldest first. */
export function weeklyTrend(
  facts: ProductivityFacts,
  ctx: IndicatorContext,
): TrendWeek[] {
  const tz = ctx.calendar.timezone
  const firstWeek = weekStartKey(localDayKey(ctx.range.from, tz))
  const lastWeek = weekStartKey(
    localDayKey(new Date(ctx.range.to.getTime() - 1), tz),
  )
  const weeks = new Map<string, TrendWeek>()
  for (
    let key = firstWeek, guard = 0;
    key <= lastWeek && guard < 60;
    key = addDayKey(key, 7), guard++
  ) {
    weeks.set(key, {
      weekStart: key,
      loggedMinutes: ctx.modules.serviceDesk ? 0 : null,
      ticketsResolved: ctx.modules.serviceDesk ? 0 : null,
      tasksCompleted: ctx.modules.crm ? 0 : null,
      opportunitiesWon: ctx.modules.crm ? 0 : null,
      conversationsHandled: ctx.modules.communication ? 0 : null,
    })
  }
  const bump = (
    at: Date,
    field: Exclude<keyof TrendWeek, 'weekStart'>,
    amount = 1,
  ) => {
    if (!inRange(at, ctx.range)) return
    const week = weeks.get(weekStartKey(localDayKey(at, tz)))
    if (!week || week[field] === null) return
    week[field] = (week[field] as number) + amount
  }
  for (const e of facts.timeEntries)
    bump(e.startedAt, 'loggedMinutes', e.minutes)
  for (const t of facts.resolvedTickets) bump(t.resolvedAt, 'ticketsResolved')
  for (const t of facts.completedTasks) bump(t.completedAt, 'tasksCompleted')
  for (const o of facts.wonOpportunities) bump(o.closedAt, 'opportunitiesWon')
  for (const c of facts.conversations) bump(c.at, 'conversationsHandled')
  return [...weeks.values()]
}
