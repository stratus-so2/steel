import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { forbidden, moduleDisabled, validationError } from '@/src/errors'
import { CSV_BOM, csvDocument, csvRow } from '@/src/lib/csv-writer'
import {
  computeIndicators,
  factsOf,
  type IndicatorContext,
  type ProductivityFacts,
  type ProductivityModules,
  weeklyTrend,
} from '@/src/lib/productivity/indicators'
import {
  addDayKey,
  type LocalRange,
  localDayKey,
  previousRange,
  resolveWorklogRange,
} from '@/src/lib/productivity/period'
import { err, ok, type Result } from '@/src/lib/result'
import {
  parseSdCalendar,
  SD_CALENDAR_24X7,
  SD_WEEKDAYS,
  type SdCalendar,
} from '@/src/lib/servicedesk/sla'
import {
  parseSdTicketCode,
  resolveSdTicketPrefixes,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import {
  productivityCsvHeader,
  productivityCsvRows,
  toWorklogCsvCells,
  toWorklogEntryDTO,
  toWorklogTotalsDTO,
  WORKLOG_CSV_HEADER,
} from '@/src/mappers/worklog.mapper'
import { ProductivityRepository } from '@/src/repositories/productivity.repository'
import {
  type WorklogMemberRow,
  WorklogRepository,
  type WorklogWhere,
} from '@/src/repositories/worklog.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import type {
  ProductivityQuery,
  WorklogExportQuery,
  WorklogListQuery,
} from '@/src/schemas/worklog.schema'
import type {
  IndicatorSetDTO,
  ProductivityDTO,
  WorklogListDTO,
} from '@/types/worklog'
import { assertMember } from './authz'

/**
 * Ajustes › Registros de trabalho. The time entries of the ServiceDesk
 * (list + CSV) and the productivity indicators across the enabled modules
 * (panel + CSV). OWNER/ADMIN see everyone; any other member sees only
 * their own numbers — enforced here, not in the UI. No ranking and no
 * combined score: people come in alphabetical order and each indicator
 * stands alone.
 */

/** Rows per round trip of the CSV export. */
export const WORKLOG_EXPORT_BATCH = 1000

/**
 * Used when the workspace has no ServiceDesk business calendar (or only a
 * 24×7 one, where "utilization" means nothing): Mon–Fri 08–12 and 13–17
 * in São Paulo — 8 h a day.
 */
export const STANDARD_CALENDAR: SdCalendar = {
  timezone: 'America/Sao_Paulo',
  schedule: {
    mon: [
      ['08:00', '12:00'],
      ['13:00', '17:00'],
    ],
    tue: [
      ['08:00', '12:00'],
      ['13:00', '17:00'],
    ],
    wed: [
      ['08:00', '12:00'],
      ['13:00', '17:00'],
    ],
    thu: [
      ['08:00', '12:00'],
      ['13:00', '17:00'],
    ],
    fri: [
      ['08:00', '12:00'],
      ['13:00', '17:00'],
    ],
  },
  holidays: [],
  is24x7: false,
}

interface Scope {
  canViewTeam: boolean
  /** `undefined` = everyone (OWNER/ADMIN without a person filter). */
  userId: string | undefined
}

interface WorkspaceContext {
  calendar: SdCalendar
  calendarSource: 'workspace' | 'standard'
  calendarName: string
  modules: ProductivityModules
}

async function resolveScope(
  actorId: string,
  workspaceId: string,
  requestedUserId: string | undefined,
): Promise<Result<Scope>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  const canViewTeam = membership.value.isPrivileged
  if (!canViewTeam && requestedUserId && requestedUserId !== actorId) {
    return err(
      forbidden(
        'Só o dono e os administradores veem os registros de outras pessoas',
      ),
    )
  }
  return ok({
    canViewTeam,
    userId: canViewTeam ? requestedUserId : actorId,
  })
}

async function loadContext(
  workspaceId: string,
): Promise<Result<WorkspaceContext>> {
  const [access, calendarRow] = await Promise.all([
    WorkspaceModuleAccessRepository.listByWorkspace(workspaceId),
    WorklogRepository.defaultCalendar(workspaceId),
  ])
  if (!access.ok) return access
  if (!calendarRow.ok) return calendarRow
  const enabled = new Set(
    access.value.filter((row) => row.enabled).map((row) => row.module),
  )
  const modules = {
    serviceDesk: enabled.has('SERVICE_DESK'),
    crm: enabled.has('CRM'),
    communication: enabled.has('COMMUNICATION'),
  }
  const row = calendarRow.value
  const parsed = row ? parseSdCalendar(row) : SD_CALENDAR_24X7
  const usable =
    !parsed.is24x7 &&
    SD_WEEKDAYS.some((day) => (parsed.schedule[day]?.length ?? 0) > 0)
  if (row && usable) {
    return ok({
      calendar: parsed,
      calendarSource: 'workspace',
      calendarName: row.name,
      modules,
    })
  }
  return ok({
    calendar: STANDARD_CALENDAR,
    calendarSource: 'standard',
    calendarName: 'Padrão (seg–sex, 8 h por dia)',
    modules,
  })
}

async function loadPrefixes(
  workspaceId: string,
): Promise<Result<SdTicketPrefixes>> {
  const raw = await WorklogRepository.ticketPrefixes(workspaceId)
  if (!raw.ok) return raw
  return ok(resolveSdTicketPrefixes(raw.value))
}

function buildWhere(
  workspaceId: string,
  range: LocalRange,
  scope: Scope,
  query: WorklogExportQuery,
  prefixes: SdTicketPrefixes,
): Result<WorklogWhere> {
  let ticket: WorklogWhere['ticket']
  if (query.ticket) {
    const parsed = parseSdTicketCode(query.ticket, prefixes)
    if (!parsed) {
      return err(
        validationError(
          'Chamado inválido. Use o código (INC-000123) ou o número.',
        ),
      )
    }
    ticket = { number: parsed.number, type: parsed.type }
  }
  return ok({
    workspaceId,
    from: range.from,
    to: range.to,
    userId: scope.userId,
    ticket,
    billable:
      query.billable === undefined ? undefined : query.billable === 'true',
    source: query.source,
  })
}

function toPeriod(range: { fromKey: string; toKey: string }, timezone: string) {
  return { from: range.fromKey, to: range.toKey, timezone }
}

export interface WorklogCsvExport {
  filename: string
  chunks: AsyncGenerator<string>
}

async function prepare(
  actorId: string,
  workspaceId: string,
  query: WorklogExportQuery,
  now: Date,
) {
  const scope = await resolveScope(actorId, workspaceId, query.userId)
  if (!scope.ok) return scope
  const context = await loadContext(workspaceId)
  if (!context.ok) return context
  const prefixes = await loadPrefixes(workspaceId)
  if (!prefixes.ok) return prefixes
  const timezone = context.value.calendar.timezone
  const range = resolveWorklogRange(query, now, timezone)
  const where = buildWhere(
    workspaceId,
    range,
    scope.value,
    query,
    prefixes.value,
  )
  if (!where.ok) return where
  return ok({
    scope: scope.value,
    context: context.value,
    prefixes: prefixes.value,
    timezone,
    range,
    where: where.value,
  })
}

const EMPTY_TOTALS = {
  entries: 0,
  minutes: 0,
  billableMinutes: 0,
  nonBillableMinutes: 0,
  timerMinutes: 0,
  manualMinutes: 0,
  amount: '0.00',
}

async function collectFacts(
  workspaceId: string,
  range: LocalRange,
  modules: ProductivityModules,
  userId: string | undefined,
): Promise<Result<ProductivityFacts>> {
  const none = <T>() => Promise.resolve(ok([] as T[]))
  const [
    timeEntries,
    resolvedTickets,
    completedTasks,
    wonOpportunities,
    conversations,
  ] = await Promise.all([
    modules.serviceDesk
      ? ProductivityRepository.timeEntries(workspaceId, range, userId)
      : none<ProductivityFacts['timeEntries'][number]>(),
    modules.serviceDesk
      ? ProductivityRepository.resolvedTickets(workspaceId, range, userId)
      : none<ProductivityFacts['resolvedTickets'][number]>(),
    modules.crm
      ? ProductivityRepository.completedTasks(workspaceId, range, userId)
      : none<ProductivityFacts['completedTasks'][number]>(),
    modules.crm
      ? ProductivityRepository.wonOpportunities(workspaceId, range, userId)
      : none<ProductivityFacts['wonOpportunities'][number]>(),
    modules.communication
      ? ProductivityRepository.conversationsHandled(workspaceId, range, userId)
      : none<ProductivityFacts['conversations'][number]>(),
  ])
  if (!timeEntries.ok) return timeEntries
  if (!resolvedTickets.ok) return resolvedTickets
  if (!completedTasks.ok) return completedTasks
  if (!wonOpportunities.ok) return wonOpportunities
  if (!conversations.ok) return conversations
  return ok({
    timeEntries: timeEntries.value,
    resolvedTickets: resolvedTickets.value,
    completedTasks: completedTasks.value,
    wonOpportunities: wonOpportunities.value,
    conversations: conversations.value,
  })
}

export const WorklogService = {
  async list(
    actorId: string,
    workspaceId: string,
    query: WorklogListQuery,
    now: Date = new Date(),
  ): Promise<Result<WorklogListDTO>> {
    const prepared = await prepare(actorId, workspaceId, query, now)
    if (!prepared.ok) return prepared
    const { scope, context, prefixes, timezone, range, where } = prepared.value

    let people: WorklogMemberRow[] | null = null
    if (scope.canViewTeam) {
      const members = await WorklogRepository.members(workspaceId)
      if (!members.ok) return members
      people = members.value
    }

    const base = {
      period: toPeriod(range, timezone),
      page: query.page,
      pageSize: query.pageSize,
      canViewTeam: scope.canViewTeam,
      people,
      serviceDeskEnabled: context.modules.serviceDesk,
    }
    if (!context.modules.serviceDesk) {
      return ok({ ...base, items: [], totals: EMPTY_TOTALS, total: 0 })
    }

    const [page, totals] = await Promise.all([
      WorklogRepository.listPage(where, {
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      WorklogRepository.totals(where),
    ])
    if (!page.ok) return page
    if (!totals.ok) return totals
    return ok({
      ...base,
      items: page.value.rows.map((row) => toWorklogEntryDTO(row, prefixes)),
      totals: toWorklogTotalsDTO(totals.value),
      total: page.value.total,
    })
  },

  async exportCsv(
    actorId: string,
    workspaceId: string,
    query: WorklogExportQuery,
    now: Date = new Date(),
  ): Promise<Result<WorklogCsvExport>> {
    const prepared = await prepare(actorId, workspaceId, query, now)
    if (!prepared.ok) return prepared
    const { scope, context, prefixes, timezone, range, where } = prepared.value
    if (!context.modules.serviceDesk) return err(moduleDisabled())

    auditMutation({
      entity: 'worklog',
      action: 'download',
      actorId,
      targetId: workspaceId,
      meta: {
        workspaceId,
        scope: scope.userId ? 'person' : 'team',
        from: range.fromKey,
        to: range.toKey,
      },
    })

    async function* chunks(): AsyncGenerator<string> {
      yield CSV_BOM + csvRow(WORKLOG_CSV_HEADER)
      let afterId: string | undefined
      while (true) {
        const batch = await WorklogRepository.listBatch(
          where,
          WORKLOG_EXPORT_BATCH,
          afterId,
        )
        if (!batch.ok) {
          logger.error(
            'worklog.export_failed',
            logFields({
              component: 'Worklog',
              workspaceId,
              message: batch.error.message,
            }),
          )
          throw new Error(batch.error.message)
        }
        if (batch.value.length === 0) return
        yield batch.value
          .map((row) => csvRow(toWorklogCsvCells(row, prefixes, timezone)))
          .join('')
        if (batch.value.length < WORKLOG_EXPORT_BATCH) return
        afterId = batch.value[batch.value.length - 1].id
      }
    }

    return ok({
      filename: `registros-de-trabalho-${range.fromKey}_${range.toKey}.csv`,
      chunks: chunks(),
    })
  },

  async productivity(
    actorId: string,
    workspaceId: string,
    query: ProductivityQuery,
    now: Date = new Date(),
  ): Promise<Result<ProductivityDTO>> {
    const scope = await resolveScope(actorId, workspaceId, query.userId)
    if (!scope.ok) return scope
    const context = await loadContext(workspaceId)
    if (!context.ok) return context
    const { calendar, modules } = context.value
    const timezone = calendar.timezone

    const current = resolveWorklogRange(query, now, timezone)
    const previous = previousRange(current)
    const facts = await collectFacts(
      workspaceId,
      { from: previous.from, to: current.to },
      modules,
      scope.value.userId,
    )
    if (!facts.ok) return facts

    const members = await WorklogRepository.members(workspaceId)
    if (!members.ok) return members
    const people = scope.value.userId
      ? members.value.filter((m) => m.id === scope.value.userId)
      : members.value
    if (people.length === 0) {
      return err(validationError('Pessoa não encontrada neste workspace'))
    }

    const ctx = (range: LocalRange): IndicatorContext => ({
      range,
      now,
      calendar,
      modules,
    })
    const compare = (f: ProductivityFacts, ids: string[]) => ({
      current: computeIndicators(f, ctx(current), ids) as IndicatorSetDTO,
      previous: computeIndicators(f, ctx(previous), ids) as IndicatorSetDTO,
    })

    const team = scope.value.userId
      ? null
      : {
          ...compare(
            facts.value,
            people.map((p) => p.id),
          ),
          people: people.length,
        }

    return ok({
      period: {
        from: current.fromKey,
        to: current.toKey,
        timezone,
        previousFrom: localDayKey(previous.from, timezone),
        previousTo: addDayKey(current.fromKey, -1),
      },
      calendar: {
        source: context.value.calendarSource,
        name: context.value.calendarName,
      },
      modules,
      canViewTeam: scope.value.canViewTeam,
      members: scope.value.canViewTeam ? members.value : null,
      team,
      people: people.map((user) => ({
        user,
        ...compare(factsOf(facts.value, user.id), [user.id]),
      })),
      trend: weeklyTrend(facts.value, ctx(current)),
    })
  },

  async productivityCsv(
    actorId: string,
    workspaceId: string,
    query: ProductivityQuery,
    now: Date = new Date(),
  ): Promise<Result<{ filename: string; content: string }>> {
    const dto = await WorklogService.productivity(
      actorId,
      workspaceId,
      query,
      now,
    )
    if (!dto.ok) return dto
    auditMutation({
      entity: 'worklog',
      action: 'export_requested',
      actorId,
      targetId: workspaceId,
      meta: {
        workspaceId,
        report: 'productivity',
        scope: dto.value.team ? 'team' : 'person',
        from: dto.value.period.from,
        to: dto.value.period.to,
      },
    })
    return ok({
      filename: `produtividade-${dto.value.period.from}_${dto.value.period.to}.csv`,
      content: csvDocument(
        productivityCsvHeader(dto.value.modules),
        productivityCsvRows(dto.value),
      ),
    })
  },
}
