/**
 * Ajustes › Registros de trabalho. Days are civil days in `timezone` (the
 * workspace's default business calendar, or São Paulo).
 */

export interface WorklogPersonDTO {
  id: string
  name: string
  email: string
  image: string | null
}

export interface WorklogPeriodDTO {
  /** First and last day, inclusive (`YYYY-MM-DD`). */
  from: string
  to: string
  timezone: string
}

export interface WorklogEntryDTO {
  id: string
  user: WorklogPersonDTO
  ticket: { id: string; code: string; title: string }
  startedAt: string
  endedAt: string | null
  minutes: number
  billable: boolean
  source: 'TIMER' | 'MANUAL'
  amount: string | null
  description: string | null
}

export interface WorklogTotalsDTO {
  entries: number
  minutes: number
  billableMinutes: number
  nonBillableMinutes: number
  timerMinutes: number
  manualMinutes: number
  amount: string
}

export interface WorklogListDTO {
  period: WorklogPeriodDTO
  items: WorklogEntryDTO[]
  totals: WorklogTotalsDTO
  page: number
  pageSize: number
  total: number
  /** OWNER/ADMIN: everyone's entries and the people filter. */
  canViewTeam: boolean
  /** Workspace members, for the people filter (`null` for non-admins). */
  people: WorklogPersonDTO[] | null
  serviceDeskEnabled: boolean
}

export interface ServiceDeskIndicatorsDTO {
  loggedMinutes: number
  businessMinutes: number
  utilization: number | null
  billableShare: number | null
  billedAmount: string
  ticketsResolved: number
  minutesPerResolvedTicket: number | null
  avgFirstResponseMinutes: number | null
  avgResolutionMinutes: number | null
  slaCompliance: number | null
  reopenRate: number | null
  timerShare: number | null
  daysWithoutEntries: number | null
  businessDays: number
}

export interface IndicatorSetDTO {
  serviceDesk: ServiceDeskIndicatorsDTO | null
  crm: {
    tasksCompleted: number
    opportunitiesWon: number
    wonAmount: string
  } | null
  communication: { conversationsHandled: number } | null
}

export interface IndicatorComparisonDTO {
  current: IndicatorSetDTO
  /** Same-length period right before. */
  previous: IndicatorSetDTO
}

export interface ProductivityTrendWeekDTO {
  weekStart: string
  loggedMinutes: number | null
  ticketsResolved: number | null
  tasksCompleted: number | null
  opportunitiesWon: number | null
  conversationsHandled: number | null
}

export interface ProductivityDTO {
  period: WorklogPeriodDTO & { previousFrom: string; previousTo: string }
  calendar: { source: 'workspace' | 'standard'; name: string }
  modules: { serviceDesk: boolean; crm: boolean; communication: boolean }
  canViewTeam: boolean
  /** Whole team (OWNER/ADMIN without a person filter); otherwise `null`. */
  team: (IndicatorComparisonDTO & { people: number }) | null
  /** Alphabetical — never ordered by a number (no ranking). */
  people: (IndicatorComparisonDTO & { user: WorklogPersonDTO })[]
  /** Weekly volumes of what is shown (team or the person). */
  trend: ProductivityTrendWeekDTO[]
}
