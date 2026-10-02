import {
  businessMinutesBetween,
  SD_CALENDAR_24X7,
  type SdCalendar,
} from './sla'
import {
  DEFAULT_SD_TICKET_PREFIXES,
  formatSdTicketCode,
  type SdTicketPrefixes,
} from './ticket-code'

/**
 * Apuração do relatório de SLA (lib **pura**: nenhum acesso a banco). O
 * repositório devolve as linhas dos chamados que tocam o período, cada uma
 * já com o calendário de expediente do chamado, e aqui se calcula volume,
 * cumprimento de SLA, MTTR, tempo de primeira resposta, CSAT e as quebras
 * por departamento, cliente e prioridade.
 *
 * Convenções da apuração (as mesmas da tela de painéis):
 * - o período é `[periodStart, periodEnd)` — o fim é exclusivo;
 * - **abertos** = `createdAt` no período; **resolvidos** = `resolvedAt` no
 *   período; **fechados** = `closedAt` no período;
 * - **em aberto no fim** = criado antes do fim e sem resolução nem
 *   fechamento até o fim do período (o retrato do backlog naquele instante);
 * - o **cumprimento de primeira resposta** é medido sobre os chamados que
 *   receberam a primeira resposta dentro do período e tinham prazo; o de
 *   **resolução**, sobre os resolvidos no período com prazo. Chamado sem
 *   prazo não entra na conta (não há promessa a cumprir);
 * - tempo médio e atraso saem em **minutos úteis** do calendário do chamado
 *   (`src/lib/servicedesk/sla.ts`), nunca em tempo corrido.
 */

export type SdReportTicketType =
  | 'INCIDENT'
  | 'SERVICE_REQUEST'
  | 'CHANGE'
  | 'PROBLEM'

/** Uma linha de chamado para a apuração (o repositório monta). */
export interface SdReportTicketRow {
  id: string
  number: number
  type: SdReportTicketType
  title: string
  createdAt: Date
  firstResponseDueAt: Date | null
  resolutionDueAt: Date | null
  firstRespondedAt: Date | null
  resolvedAt: Date | null
  closedAt: Date | null
  csatScore: number | null
  customerId: string | null
  customerName: string | null
  departmentId: string | null
  departmentName: string | null
  priorityId: string | null
  priorityName: string | null
  /** Expediente do chamado (política de SLA → calendário; senão o padrão). */
  calendar: SdCalendar
}

export interface SdReportVolume {
  opened: number
  resolved: number
  closed: number
  /** Retrato do backlog no fim do período. */
  openAtEnd: number
}

export interface SdReportSlaTimerStats {
  /** Chamados com prazo que entraram na conta. */
  measured: number
  met: number
  breached: number
  /** % dentro do prazo (uma casa). `null` quando não houve o que medir. */
  compliance: number | null
  /** Tempo médio até a resposta/resolução, em minutos úteis. */
  averageMinutes: number | null
}

export type SdReportViolationKind = 'FIRST_RESPONSE' | 'RESOLUTION'

export interface SdReportViolation {
  ticketId: string
  number: number
  /** `INC-000123`. */
  code: string
  title: string
  customer: string | null
  kind: SdReportViolationKind
  dueAt: string
  /** Atraso em minutos úteis (até a resposta/resolução, ou até agora). */
  delayMinutes: number
}

export interface SdReportCsat {
  answered: number
  /** Média das notas (uma casa). `null` sem resposta. */
  average: number | null
  /** Nota 1–5 → quantidade (sempre as cinco linhas). */
  distribution: { score: number; count: number }[]
}

export interface SdReportBreakdown {
  /** `null` = "sem departamento/cliente/prioridade". */
  id: string | null
  label: string
  opened: number
  resolved: number
  breached: number
  compliance: number | null
  /** MTTR do grupo, em minutos úteis. */
  averageResolutionMinutes: number | null
}

export interface SdSlaReportSummary {
  periodStart: string
  periodEnd: string
  volume: SdReportVolume
  firstResponse: SdReportSlaTimerStats
  resolution: SdReportSlaTimerStats
  violations: SdReportViolation[]
  /** Total de violações no período (as listadas podem estar truncadas). */
  violationCount: number
  csat: SdReportCsat
  byDepartment: SdReportBreakdown[]
  byCustomer: SdReportBreakdown[]
  byPriority: SdReportBreakdown[]
}

export interface SdSlaReportInput {
  periodStart: Date
  periodEnd: Date
  rows: SdReportTicketRow[]
  /** Prefixos do workspace, para o código do chamado nas violações. */
  prefixes?: SdTicketPrefixes
  /** Agora (atraso de quem ainda não respondeu/resolveu). */
  now?: Date
  /** Quantas violações listar (as mais atrasadas primeiro). */
  maxViolations?: number
}

const DEFAULT_MAX_VIOLATIONS = 100

function inPeriod(at: Date | null, start: Date, end: Date): boolean {
  if (!at) return false
  return at.getTime() >= start.getTime() && at.getTime() < end.getTime()
}

/** Uma casa decimal, sem `-0`. */
function round1(value: number): number {
  return Math.round(value * 10) / 10 + 0
}

function percent(met: number, measured: number): number | null {
  if (measured === 0) return null
  return round1((met / measured) * 100)
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
}

/** Minutos úteis entre `from` e `to` no expediente do chamado. */
function businessMinutes(row: SdReportTicketRow, from: Date, to: Date): number {
  return businessMinutesBetween(from, to, row.calendar ?? SD_CALENDAR_24X7)
}

interface TimerBucket {
  measured: number
  met: number
  breached: number
  durations: number[]
}

function emptyBucket(): TimerBucket {
  return { measured: 0, met: 0, breached: 0, durations: [] }
}

function statsOf(bucket: TimerBucket): SdReportSlaTimerStats {
  return {
    measured: bucket.measured,
    met: bucket.met,
    breached: bucket.breached,
    compliance: percent(bucket.met, bucket.measured),
    averageMinutes: average(bucket.durations),
  }
}

interface GroupAccumulator {
  id: string | null
  label: string
  opened: number
  resolved: number
  breached: number
  met: number
  measured: number
  durations: number[]
}

type GroupKind = 'department' | 'customer' | 'priority'

const GROUP_FALLBACK: Record<GroupKind, string> = {
  department: 'Sem departamento',
  customer: 'Sem cliente',
  priority: 'Sem prioridade',
}

function groupKeyOf(
  row: SdReportTicketRow,
  kind: GroupKind,
): { id: string | null; label: string } {
  const [id, name] =
    kind === 'department'
      ? [row.departmentId, row.departmentName]
      : kind === 'customer'
        ? [row.customerId, row.customerName]
        : [row.priorityId, row.priorityName]
  return { id: id ?? null, label: name ?? GROUP_FALLBACK[kind] }
}

function bump(
  groups: Map<string, GroupAccumulator>,
  key: { id: string | null; label: string },
  apply: (group: GroupAccumulator) => void,
): void {
  const mapKey = key.id ?? `__${key.label}`
  const existing = groups.get(mapKey) ?? {
    id: key.id,
    label: key.label,
    opened: 0,
    resolved: 0,
    breached: 0,
    met: 0,
    measured: 0,
    durations: [],
  }
  apply(existing)
  groups.set(mapKey, existing)
}

/** Maior volume primeiro; empate pelo rótulo (saída estável). */
function toBreakdown(groups: Map<string, GroupAccumulator>) {
  return [...groups.values()]
    .map((group) => ({
      id: group.id,
      label: group.label,
      opened: group.opened,
      resolved: group.resolved,
      breached: group.breached,
      compliance: percent(group.met, group.measured),
      averageResolutionMinutes: average(group.durations),
    }))
    .sort(
      (a, b) =>
        b.opened + b.resolved - (a.opened + a.resolved) ||
        a.label.localeCompare(b.label, 'pt-BR'),
    )
}

/**
 * Apura o período. Linhas fora do recorte temporal simplesmente não somam —
 * o repositório pode mandar uma margem a mais sem estragar o número.
 */
export function computeSdSlaReport(
  input: SdSlaReportInput,
): SdSlaReportSummary {
  const { periodStart, periodEnd, rows } = input
  const now = input.now ?? new Date()
  const prefixes = input.prefixes ?? DEFAULT_SD_TICKET_PREFIXES
  const maxViolations = input.maxViolations ?? DEFAULT_MAX_VIOLATIONS

  const volume: SdReportVolume = {
    opened: 0,
    resolved: 0,
    closed: 0,
    openAtEnd: 0,
  }
  const firstResponse = emptyBucket()
  const resolution = emptyBucket()
  const violations: SdReportViolation[] = []
  const scores: number[] = []
  const distribution = new Map<number, number>()
  const groups: Record<GroupKind, Map<string, GroupAccumulator>> = {
    department: new Map(),
    customer: new Map(),
    priority: new Map(),
  }
  const kinds: GroupKind[] = ['department', 'customer', 'priority']

  for (const row of rows) {
    const opened = inPeriod(row.createdAt, periodStart, periodEnd)
    const resolved = inPeriod(row.resolvedAt, periodStart, periodEnd)
    const responded = inPeriod(row.firstRespondedAt, periodStart, periodEnd)
    const closed = inPeriod(row.closedAt, periodStart, periodEnd)
    const openAtEnd =
      row.createdAt.getTime() < periodEnd.getTime() &&
      (row.resolvedAt === null ||
        row.resolvedAt.getTime() >= periodEnd.getTime()) &&
      (row.closedAt === null || row.closedAt.getTime() >= periodEnd.getTime())

    if (opened) volume.opened += 1
    if (resolved) volume.resolved += 1
    if (closed) volume.closed += 1
    if (openAtEnd) volume.openAtEnd += 1

    // Primeira resposta: só quem respondeu no período e tinha prazo.
    let firstResponseLate = false
    if (responded && row.firstRespondedAt) {
      firstResponse.durations.push(
        businessMinutes(row, row.createdAt, row.firstRespondedAt),
      )
      if (row.firstResponseDueAt) {
        firstResponse.measured += 1
        firstResponseLate =
          row.firstRespondedAt.getTime() > row.firstResponseDueAt.getTime()
        if (firstResponseLate) firstResponse.breached += 1
        else firstResponse.met += 1
      }
    }

    // Resolução: só quem resolveu no período e tinha prazo.
    let resolutionLate = false
    let resolutionMinutes: number | null = null
    if (resolved && row.resolvedAt) {
      resolutionMinutes = businessMinutes(row, row.createdAt, row.resolvedAt)
      resolution.durations.push(resolutionMinutes)
      if (row.resolutionDueAt) {
        resolution.measured += 1
        resolutionLate =
          row.resolvedAt.getTime() > row.resolutionDueAt.getTime()
        if (resolutionLate) resolution.breached += 1
        else resolution.met += 1
      }
    }

    if (firstResponseLate && row.firstResponseDueAt && row.firstRespondedAt) {
      violations.push({
        ticketId: row.id,
        number: row.number,
        code: formatSdTicketCode(row.type, row.number, prefixes),
        title: row.title,
        customer: row.customerName,
        kind: 'FIRST_RESPONSE',
        dueAt: row.firstResponseDueAt.toISOString(),
        delayMinutes: businessMinutes(
          row,
          row.firstResponseDueAt,
          row.firstRespondedAt,
        ),
      })
    }
    if (resolutionLate && row.resolutionDueAt && row.resolvedAt) {
      violations.push({
        ticketId: row.id,
        number: row.number,
        code: formatSdTicketCode(row.type, row.number, prefixes),
        title: row.title,
        customer: row.customerName,
        kind: 'RESOLUTION',
        dueAt: row.resolutionDueAt.toISOString(),
        delayMinutes: businessMinutes(row, row.resolutionDueAt, row.resolvedAt),
      })
    }

    // Chamado em aberto com o prazo de resolução já vencido também é
    // violação do período — e é o que dói agora.
    if (
      openAtEnd &&
      row.resolutionDueAt &&
      row.resolutionDueAt.getTime() <
        Math.min(periodEnd.getTime(), now.getTime())
    ) {
      violations.push({
        ticketId: row.id,
        number: row.number,
        code: formatSdTicketCode(row.type, row.number, prefixes),
        title: row.title,
        customer: row.customerName,
        kind: 'RESOLUTION',
        dueAt: row.resolutionDueAt.toISOString(),
        delayMinutes: businessMinutes(
          row,
          row.resolutionDueAt,
          now.getTime() < periodEnd.getTime() ? now : periodEnd,
        ),
      })
    }

    if (resolved && row.csatScore !== null) {
      scores.push(row.csatScore)
      distribution.set(
        row.csatScore,
        (distribution.get(row.csatScore) ?? 0) + 1,
      )
    }

    if (opened || resolved) {
      for (const kind of kinds) {
        const key = groupKeyOf(row, kind)
        bump(groups[kind], key, (group) => {
          if (opened) group.opened += 1
          if (resolved) group.resolved += 1
          if (resolutionLate) group.breached += 1
          if (resolved && row.resolutionDueAt) {
            group.measured += 1
            if (!resolutionLate) group.met += 1
          }
          if (resolutionMinutes !== null) {
            group.durations.push(resolutionMinutes)
          }
        })
      }
    }
  }

  violations.sort(
    (a, b) => b.delayMinutes - a.delayMinutes || a.number - b.number,
  )

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    volume,
    firstResponse: statsOf(firstResponse),
    resolution: statsOf(resolution),
    violations: violations.slice(0, maxViolations),
    violationCount: violations.length,
    csat: {
      answered: scores.length,
      average:
        scores.length === 0
          ? null
          : round1(
              scores.reduce((sum, score) => sum + score, 0) / scores.length,
            ),
      distribution: [1, 2, 3, 4, 5].map((score) => ({
        score,
        count: distribution.get(score) ?? 0,
      })),
    },
    byDepartment: toBreakdown(groups.department),
    byCustomer: toBreakdown(groups.customer),
    byPriority: toBreakdown(groups.priority),
  }
}

/** "2 h 35 min" / "48 min" / "—" — usado no PDF, no CSV e na tela. */
export function formatSdReportMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** "97,5%" / "—". */
export function formatSdReportPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value.toFixed(1).replace('.', ',')}%`
}
