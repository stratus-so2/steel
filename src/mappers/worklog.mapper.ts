import type { IndicatorSet } from '@/src/lib/productivity/indicators'
import {
  formatSdTicketCode,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import type {
  WorklogEntryRow,
  WorklogTotalsRow,
} from '@/src/repositories/worklog.repository'
import type {
  ProductivityDTO,
  WorklogEntryDTO,
  WorklogTotalsDTO,
} from '@/types/worklog'

/** Work logs and productivity: DTOs and the CSV rows of both downloads. */

const localFormatters = new Map<string, Intl.DateTimeFormat>()

/** `2026-10-08 14:05` in `timeZone` (never the server's zone). */
export function formatLocalDateTime(at: Date, timeZone: string): string {
  let formatter = localFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    localFormatters.set(timeZone, formatter)
  }
  return formatter.format(at).replace(', ', ' ')
}

export function toWorklogEntryDTO(
  row: WorklogEntryRow,
  prefixes: SdTicketPrefixes,
): WorklogEntryDTO {
  return {
    id: row.id,
    user: row.user,
    ticket: {
      id: row.ticket.id,
      code: formatSdTicketCode(row.ticket.type, row.ticket.number, prefixes),
      title: row.ticket.title,
    },
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    minutes: row.minutes,
    billable: row.billable,
    source: row.source,
    amount: row.amount === null ? null : row.amount.toFixed(2),
    description: row.description,
  }
}

export function toWorklogTotalsDTO(row: WorklogTotalsRow): WorklogTotalsDTO {
  return {
    entries: row.entries,
    minutes: row.minutes,
    billableMinutes: row.billableMinutes,
    nonBillableMinutes: row.minutes - row.billableMinutes,
    timerMinutes: row.timerMinutes,
    manualMinutes: row.minutes - row.timerMinutes,
    amount: row.amount,
  }
}

const hours = (minutes: number) => Math.round((minutes / 60) * 100) / 100

export const WORKLOG_CSV_HEADER = [
  'inicio',
  'fim',
  'minutos',
  'horas',
  'pessoa',
  'email',
  'chamado',
  'titulo_chamado',
  'faturavel',
  'origem',
  'valor',
  'descricao',
]

export function toWorklogCsvCells(
  row: WorklogEntryRow,
  prefixes: SdTicketPrefixes,
  timeZone: string,
): (string | number | null)[] {
  return [
    formatLocalDateTime(row.startedAt, timeZone),
    row.endedAt ? formatLocalDateTime(row.endedAt, timeZone) : null,
    row.minutes,
    hours(row.minutes),
    row.user.name,
    row.user.email,
    formatSdTicketCode(row.ticket.type, row.ticket.number, prefixes),
    row.ticket.title,
    row.billable ? 'sim' : 'não',
    row.source === 'TIMER' ? 'cronômetro' : 'manual',
    row.amount === null ? null : row.amount.toFixed(2),
    row.description,
  ]
}

/** Indicator columns: [header, getter] — modules switched off are left out. */
type Column = [string, (set: IndicatorSet) => string | number | null]

const pct = (value: number | null | undefined) =>
  value === null || value === undefined ? null : Math.round(value * 1000) / 10

export function productivityCsvColumns(
  modules: ProductivityDTO['modules'],
): Column[] {
  const columns: Column[] = []
  if (modules.serviceDesk) {
    columns.push(
      ['horas_registradas', (s) => hours(s.serviceDesk?.loggedMinutes ?? 0)],
      ['utilizacao_pct', (s) => pct(s.serviceDesk?.utilization)],
      ['faturavel_pct', (s) => pct(s.serviceDesk?.billableShare)],
      ['valor_faturado', (s) => s.serviceDesk?.billedAmount ?? null],
      ['chamados_resolvidos', (s) => s.serviceDesk?.ticketsResolved ?? null],
      [
        'minutos_por_chamado_resolvido',
        (s) => s.serviceDesk?.minutesPerResolvedTicket ?? null,
      ],
      [
        'primeira_resposta_media_min',
        (s) => s.serviceDesk?.avgFirstResponseMinutes ?? null,
      ],
      [
        'resolucao_media_min',
        (s) => s.serviceDesk?.avgResolutionMinutes ?? null,
      ],
      ['dentro_do_sla_pct', (s) => pct(s.serviceDesk?.slaCompliance)],
      ['reabertura_pct', (s) => pct(s.serviceDesk?.reopenRate)],
      ['horas_por_cronometro_pct', (s) => pct(s.serviceDesk?.timerShare)],
      ['dias_sem_registro', (s) => s.serviceDesk?.daysWithoutEntries ?? null],
      ['dias_uteis', (s) => s.serviceDesk?.businessDays ?? null],
    )
  }
  if (modules.crm) {
    columns.push(
      ['tarefas_concluidas', (s) => s.crm?.tasksCompleted ?? null],
      ['oportunidades_ganhas', (s) => s.crm?.opportunitiesWon ?? null],
      ['valor_ganho', (s) => s.crm?.wonAmount ?? null],
    )
  }
  if (modules.communication) {
    columns.push([
      'conversas_atendidas',
      (s) => s.communication?.conversationsHandled ?? null,
    ])
  }
  return columns
}

export function productivityCsvHeader(
  modules: ProductivityDTO['modules'],
): string[] {
  return [
    'pessoa',
    'email',
    'periodo',
    'de',
    'ate',
    ...productivityCsvColumns(modules).map(([header]) => header),
  ]
}

/** Two rows per person (and for the team): current and previous period. */
export function productivityCsvRows(
  dto: ProductivityDTO,
): (string | number | null)[][] {
  const columns = productivityCsvColumns(dto.modules)
  const rows: (string | number | null)[][] = []
  const push = (
    name: string,
    email: string | null,
    current: IndicatorSet,
    previous: IndicatorSet,
  ) => {
    rows.push([
      name,
      email,
      'atual',
      dto.period.from,
      dto.period.to,
      ...columns.map(([, get]) => get(current)),
    ])
    rows.push([
      name,
      email,
      'anterior',
      dto.period.previousFrom,
      dto.period.previousTo,
      ...columns.map(([, get]) => get(previous)),
    ])
  }
  if (dto.team) {
    push('Equipe', null, dto.team.current, dto.team.previous)
  }
  for (const person of dto.people) {
    push(person.user.name, person.user.email, person.current, person.previous)
  }
  return rows
}
