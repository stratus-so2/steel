import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  forbidden,
  sdContractPeriodClosed,
  sdTimeEntryInvalid,
  sdTimeEntryRunning,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  resolveSdEntryRate,
  resolveSdRateWindow,
  sdBillableMinutes,
  sdElapsedMinutes,
  sdEntryAmount,
  sdLocalDayRange,
} from '@/src/lib/servicedesk/billing'
import { parseSdCalendar, type SdCalendar } from '@/src/lib/servicedesk/sla'
import {
  canEditSdTimeEntry,
  type SdTimeEntryViewer,
  toSdTimeEntryDTO,
  toSdTimeEntryListDTO,
} from '@/src/mappers/sd-time-entry.mapper'
import {
  SdContractRepository,
  type SdContractWithRelations,
} from '@/src/repositories/sd-contract.repository'
import {
  SdContractPeriodRepository,
  type SdContractPeriodWithRelations,
} from '@/src/repositories/sd-contract-period.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  SdTimeEntryRepository,
  type SdTimeEntryWithRelations,
} from '@/src/repositories/sd-time-entry.repository'
import type {
  CreateSdTimeEntryDTO,
  SdTimerActionDTO,
  UpdateSdTimeEntryDTO,
} from '@/src/schemas/sd-time-entry.schema'
import type { SdTimeEntryDTO, SdTimeEntryListDTO } from '@/types/sd-time-entry'
import type { SdAccessContext } from './sd-access'
import { SdContractBillingService } from './sd-contract-billing.service'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import {
  loadSdTicketTab,
  publishSdTicketTab,
  type SdTicketTabScope,
} from './sd-ticket-tab-support'

/**
 * Apontamento de horas no chamado: cronômetro (**um aberto por usuário**,
 * `SD_TIME_ENTRY_RUNNING`) e lançamento manual. Só agentes; a permissão é a
 * do chamado (`sd-tickets`), não a do contrato — contrato é coisa de admin,
 * apontar hora é do dia a dia do agente.
 *
 * Ao fechar o apontamento, as regras do contrato carimbado no chamado
 * decidem tudo: arredondamento (`roundingMinutes`), mínimo por chamado no
 * primeiro apontamento do dia (`minimumMinutes`), janela pelo calendário de
 * expediente e valor pela tabela `SdContractRate`. Sem contrato, o
 * apontamento é só registro de tempo (sem valor).
 *
 * Quem mexe: o autor enquanto o período está aberto, e os admins do módulo.
 * Período fechado congela tudo (`SD_CONTRACT_PERIOD_CLOSED`).
 */

interface PricedEntry {
  minutes: number
  window: ReturnType<typeof resolveSdRateWindow>
  amount: string | null
  contractId: string | null
  periodId: string | null
}

function viewerOf(
  ctx: SdAccessContext,
  frozenPeriodIds: Set<string>,
): SdTimeEntryViewer {
  return { userId: ctx.userId, isAdmin: ctx.isAdmin, frozenPeriodIds }
}

async function loadCalendar(
  workspaceId: string,
  slaPolicyId: string | null,
): Promise<Result<SdCalendar>> {
  const row = await SdContractRepository.findBillingCalendar(
    workspaceId,
    slaPolicyId,
  )
  if (!row.ok) return row
  return ok(parseSdCalendar(row.value))
}

/** Contrato carimbado no chamado (quando existe e ainda não foi removido). */
async function loadContract(
  workspaceId: string,
  contractId: string | null,
): Promise<Result<SdContractWithRelations | null>> {
  if (!contractId) return ok(null)
  const row = await SdContractRepository.findByIdUnscoped(contractId)
  if (!row.ok) return row
  if (!row.value || row.value.workspaceId !== workspaceId) return ok(null)
  return ok(row.value)
}

/**
 * Minutos, janela, valor e período de um apontamento fechado. `excludeId`
 * tira o próprio apontamento da conta do "primeiro do dia" (edição).
 */
async function priceEntry(params: {
  workspaceId: string
  ticket: SdTicketTabScope['ticket']
  userId: string
  startedAt: Date
  endedAt: Date
  excludeId?: string
}): Promise<Result<PricedEntry>> {
  const contract = await loadContract(
    params.workspaceId,
    params.ticket.contractId,
  )
  if (!contract.ok) return contract

  const calendar = await loadCalendar(
    params.workspaceId,
    contract.value?.slaPolicyId ?? null,
  )
  if (!calendar.ok) return calendar

  const window = resolveSdRateWindow(params.startedAt, calendar.value)
  const raw = sdElapsedMinutes(params.startedAt, params.endedAt)
  if (raw <= 0) return err(sdTimeEntryInvalid())

  if (!contract.value) {
    return ok({
      minutes: raw,
      window,
      amount: null,
      contractId: null,
      periodId: null,
    })
  }

  const period = await SdContractBillingService.ensureOpenPeriod(
    contract.value,
    params.startedAt,
  )
  if (!period.ok) return period

  const day = sdLocalDayRange(params.startedAt, calendar.value)
  const already = await SdTimeEntryRepository.existsOnTicketDay({
    ticketId: params.ticket.id,
    userId: params.userId,
    from: day.start,
    to: day.end,
    ...(params.excludeId ? { excludeId: params.excludeId } : {}),
  })
  if (!already.ok) return already

  const minutes = sdBillableMinutes(raw, contract.value, !already.value)
  const rate = resolveSdEntryRate(contract.value, contract.value.rates, {
    ticketType: params.ticket.type,
    priorityId: params.ticket.priorityId,
    window,
  })

  return ok({
    minutes,
    window,
    amount: sdEntryAmount(minutes, rate).toFixed(2),
    contractId: contract.value.id,
    periodId: period.value.id,
  })
}

/** Período do apontamento, quando ele já foi consolidado em algum. */
async function loadPeriod(
  entry: Pick<SdTimeEntryWithRelations, 'periodId' | 'contractId'>,
): Promise<Result<SdContractPeriodWithRelations | null>> {
  if (!entry.periodId || !entry.contractId) return ok(null)
  const row = await SdContractPeriodRepository.findById(
    entry.periodId,
    entry.contractId,
  )
  if (!row.ok) return row
  return ok(row.value)
}

/** Autor com o período aberto, ou admin do módulo. */
async function assertCanMutate(
  entry: SdTimeEntryWithRelations,
  ctx: SdAccessContext,
): Promise<Result<void>> {
  const period = await loadPeriod(entry)
  if (!period.ok) return period
  if (period.value?.status === 'CLOSED') return err(sdContractPeriodClosed())
  if (
    !canEditSdTimeEntry(entry, { userId: ctx.userId, isAdmin: ctx.isAdmin })
  ) {
    return err(
      forbidden('Só o autor do apontamento ou um admin pode alterá-lo'),
    )
  }
  return ok(undefined)
}

async function announce(
  scope: SdTicketTabScope,
  action: 'time.started' | 'time.logged' | 'time.updated' | 'time.removed',
  entry: SdTimeEntryWithRelations,
  meta: Record<string, unknown> = {},
): Promise<void> {
  await recordSdTicketEvent({
    workspaceId: scope.ticket.workspaceId,
    ticketId: scope.ticket.id,
    actorKind: 'AGENT',
    actorUserId: scope.ctx.userId,
    action,
    toValue: {
      id: entry.id,
      label: entry.description ?? `${entry.minutes} min`,
    },
    meta: { minutes: entry.minutes, window: entry.window, ...meta },
  })
  await publishSdTicketTab(scope.ticket, 'ticket.time', scope.ctx.userId, true)
}

export const SdTimeEntryService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTimeEntryListDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      {
        agentOnly: true,
      },
    )
    if (!scope.ok) return scope

    const rows = await SdTimeEntryRepository.listByTicket(scope.value.ticket.id)
    if (!rows.ok) return rows
    const running = await SdTimeEntryRepository.findRunning(
      workspaceId,
      actorId,
    )
    if (!running.ok) return running

    const periodIds = [
      ...new Set(
        rows.value
          .map((row) => row.periodId)
          .filter((id): id is string => id !== null),
      ),
    ]
    const frozen = await SdContractPeriodRepository.findClosedIds(periodIds)
    if (!frozen.ok) return frozen

    const contract = await loadContract(
      workspaceId,
      scope.value.ticket.contractId,
    )
    if (!contract.ok) return contract

    return ok(
      toSdTimeEntryListDTO({
        rows: rows.value,
        running: running.value,
        contract: contract.value,
        period: contract.value?.periods[0] ?? null,
        viewer: viewerOf(scope.value.ctx, frozen.value),
      }),
    )
  },

  /**
   * Cronômetro. `start`/`resume` abrem um apontamento (fim vazio);
   * `pause`/`stop` fecham o aberto, consolidando minutos, janela e valor.
   */
  async timer(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: SdTimerActionDTO,
  ): Promise<Result<SdTimeEntryDTO>> {
    const opening = dto.action === 'start' || dto.action === 'resume'
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      opening ? 'CREATE' : 'EDIT',
      { agentOnly: true, ...(opening ? { requireOpen: true } : {}) },
    )
    if (!scope.ok) return scope
    const { ticket, ctx } = scope.value

    const running = await SdTimeEntryRepository.findRunning(
      workspaceId,
      actorId,
    )
    if (!running.ok) return running

    if (opening) {
      if (running.value) return err(sdTimeEntryRunning())
      const created = await SdTimeEntryRepository.create({
        workspaceId,
        ticketId: ticket.id,
        userId: actorId,
        source: 'TIMER',
        startedAt: new Date(),
        endedAt: null,
        minutes: 0,
        billable: true,
        contractId: ticket.contractId,
        description: dto.description ?? null,
      })
      if (!created.ok) return created
      await announce(scope.value, 'time.started', created.value)
      auditMutation({
        entity: 'sd_time_entry',
        action: 'create',
        actorId,
        targetId: created.value.id,
        meta: { workspaceId, ticketId: ticket.id, source: 'TIMER' },
      })
      return ok(toSdTimeEntryDTO(created.value, viewerOf(ctx, new Set())))
    }

    if (!running.value || running.value.ticketId !== ticket.id) {
      return err(
        sdTimeEntryInvalid('Nenhum cronômetro em andamento neste chamado'),
      )
    }

    const endedAt = new Date()
    const priced = await priceEntry({
      workspaceId,
      ticket,
      userId: actorId,
      startedAt: running.value.startedAt,
      endedAt,
      excludeId: running.value.id,
    })
    if (!priced.ok) return priced

    const closed = await SdTimeEntryRepository.update(running.value.id, {
      endedAt,
      minutes: priced.value.minutes,
      window: priced.value.window,
      amount: priced.value.amount,
      contractId: priced.value.contractId,
      periodId: priced.value.periodId,
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
    })
    if (!closed.ok) return closed

    await announce(scope.value, 'time.logged', closed.value, {
      action: dto.action,
    })
    auditMutation({
      entity: 'sd_time_entry',
      action: 'update',
      actorId,
      targetId: closed.value.id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        minutes: closed.value.minutes,
        amount: priced.value.amount,
      },
    })
    logger.info('servicedesk.time_entry.logged', {
      workspaceId,
      ticketId: ticket.id,
      minutes: closed.value.minutes,
      window: closed.value.window,
      contractId: priced.value.contractId,
    })
    return ok(toSdTimeEntryDTO(closed.value, viewerOf(ctx, new Set())))
  },

  /** Lançamento manual (início e fim informados). */
  async create(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: CreateSdTimeEntryDTO,
  ): Promise<Result<SdTimeEntryDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { agentOnly: true, requireOpen: true },
    )
    if (!scope.ok) return scope
    const { ticket, ctx } = scope.value

    let userId = actorId
    if (dto.userId && dto.userId !== actorId) {
      if (!ctx.isAdmin) {
        return err(
          forbidden(
            'Só um admin do ServiceDesk pode apontar hora por outro agente',
          ),
        )
      }
      const outsiders = await SdTicketContextRepository.findNonMembers(
        workspaceId,
        [dto.userId],
      )
      if (!outsiders.ok) return outsiders
      if (outsiders.value.length > 0) {
        return err(validationError('Agente não é membro do workspace'))
      }
      userId = dto.userId
    }

    const priced = await priceEntry({
      workspaceId,
      ticket,
      userId,
      startedAt: dto.startedAt,
      endedAt: dto.endedAt,
    })
    if (!priced.ok) return priced

    const created = await SdTimeEntryRepository.create({
      workspaceId,
      ticketId: ticket.id,
      userId,
      source: 'MANUAL',
      startedAt: dto.startedAt,
      endedAt: dto.endedAt,
      minutes: priced.value.minutes,
      billable: dto.billable,
      window: priced.value.window,
      amount: priced.value.amount,
      contractId: priced.value.contractId,
      periodId: priced.value.periodId,
      description: dto.description ?? null,
    })
    if (!created.ok) return created

    await announce(scope.value, 'time.logged', created.value, {
      source: 'MANUAL',
    })
    auditMutation({
      entity: 'sd_time_entry',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        userId,
        minutes: created.value.minutes,
      },
    })
    return ok(toSdTimeEntryDTO(created.value, viewerOf(ctx, new Set())))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    entryId: string,
    dto: UpdateSdTimeEntryDTO,
  ): Promise<Result<SdTimeEntryDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      {
        agentOnly: true,
      },
    )
    if (!scope.ok) return scope
    const { ticket, ctx } = scope.value

    const existing = await SdTimeEntryRepository.findById(entryId, ticket.id)
    if (!existing.ok) return existing
    const allowed = await assertCanMutate(existing.value, ctx)
    if (!allowed.ok) return allowed

    const startedAt = dto.startedAt ?? existing.value.startedAt
    const endedAt = dto.endedAt ?? existing.value.endedAt
    // Cronômetro em andamento só aceita ajuste de descrição e de faturável.
    if (!endedAt) {
      if (dto.startedAt || dto.endedAt) {
        return err(
          sdTimeEntryInvalid('Pare o cronômetro antes de ajustar os horários'),
        )
      }
      const touched = await SdTimeEntryRepository.update(entryId, {
        ...(dto.billable !== undefined ? { billable: dto.billable } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      })
      if (!touched.ok) return touched
      await announce(scope.value, 'time.updated', touched.value)
      return ok(toSdTimeEntryDTO(touched.value, viewerOf(ctx, new Set())))
    }

    if (endedAt <= startedAt) {
      return err(sdTimeEntryInvalid('O fim deve ser depois do início'))
    }

    const priced = await priceEntry({
      workspaceId,
      ticket,
      userId: existing.value.userId,
      startedAt,
      endedAt,
      excludeId: entryId,
    })
    if (!priced.ok) return priced

    const updated = await SdTimeEntryRepository.update(entryId, {
      startedAt,
      endedAt,
      minutes: priced.value.minutes,
      window: priced.value.window,
      amount: priced.value.amount,
      contractId: priced.value.contractId,
      periodId: priced.value.periodId,
      ...(dto.billable !== undefined ? { billable: dto.billable } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
    })
    if (!updated.ok) return updated

    await announce(scope.value, 'time.updated', updated.value, {
      fields: Object.keys(dto),
    })
    auditMutation({
      entity: 'sd_time_entry',
      action: 'update',
      actorId,
      targetId: entryId,
      meta: { workspaceId, ticketId: ticket.id, fields: Object.keys(dto) },
    })
    return ok(toSdTimeEntryDTO(updated.value, viewerOf(ctx, new Set())))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    entryId: string,
  ): Promise<Result<void>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'DELETE',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    const { ticket, ctx } = scope.value

    const existing = await SdTimeEntryRepository.findById(entryId, ticket.id)
    if (!existing.ok) return existing
    const allowed = await assertCanMutate(existing.value, ctx)
    if (!allowed.ok) return allowed

    const removed = await SdTimeEntryRepository.softDelete(entryId)
    if (!removed.ok) return removed

    await announce(scope.value, 'time.removed', existing.value)
    auditMutation({
      entity: 'sd_time_entry',
      action: 'delete',
      actorId,
      targetId: entryId,
      meta: { workspaceId, ticketId: ticket.id },
    })
    return ok(undefined)
  },
}
