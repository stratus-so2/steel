import type { Prisma } from '@prisma/client'
import {
  sdConfigConflict,
  sdConfigNotFound,
  sdRecurringNotFound,
  sdRecurringScheduleInvalid,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  firstSdOccurrence,
  type SdRecurrenceSchedule,
  sdRecurrenceProblem,
} from '@/src/lib/servicedesk/recurrence'
import {
  toSdRecurrenceSchedule,
  toSdRecurringTicketDTO,
  toSdRecurringTicketRunDTO,
} from '@/src/mappers/sd-recurring-ticket.mapper'
import {
  type SdRecurringTicketData,
  SdRecurringTicketRepository,
  SdRecurringTicketRunRepository,
  type SdRecurringTicketWithRelations,
} from '@/src/repositories/sd-recurring-ticket.repository'
import type {
  CreateSdRecurringTicketDTO,
  ListSdRecurringTicketsDTO,
  UpdateSdRecurringTicketDTO,
} from '@/src/schemas/sd-recurring-ticket.schema'
import type { SdTicketTemplateDefaults } from '@/src/schemas/sd-ticket-template.schema'
import type {
  SdRecurringTicketDTO,
  SdRecurringTicketRunDTO,
} from '@/types/sd-recurring-ticket'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'
import { openSdRecurringOccurrence } from './sd-recurring-ticket-runner'
import { SdTicketEngine } from './sd-ticket-engine'

/**
 * Chamados recorrentes (manutenção preventiva): CRUD da rotina, histórico
 * de ocorrências e o "gerar agora". A **leitura** é de qualquer agente (a
 * tela do item de configuração mostra as rotinas que incidem sobre ele); a
 * **escrita** é só dos admins do módulo (`sd-settings`), auditada.
 *
 * O worker (`SdRecurringTicketRunner`) é quem abre os chamados na hora; aqui
 * só se calcula o próximo disparo (`nextRunAt`) com a lib de agenda.
 */

/** Ids referenciados pelos `defaults`, como o service de modelos faz. */
function defaultsRefs(defaults: SdTicketTemplateDefaults | undefined) {
  return {
    categoryIds: [
      defaults?.categoryId,
      defaults?.subcategoryId,
      defaults?.serviceId,
    ],
    priorityIds: [defaults?.priorityId],
    impactIds: [defaults?.impactId],
    urgencyIds: [defaults?.urgencyId],
    severityIds: [defaults?.severityId],
    classificationIds: [defaults?.classificationId],
    departmentIds: [defaults?.departmentId],
  }
}

/** Confere modelo, departamento, responsável, cliente e item de configuração. */
async function assertRefs(
  workspaceId: string,
  dto: {
    templateId?: string | null
    departmentId?: string | null
    assigneeId?: string | null
    customerId?: string | null
    configItemId?: string | null
    defaults?: SdTicketTemplateDefaults
  },
): Promise<Result<true>> {
  const refs = defaultsRefs(dto.defaults)
  const configRefs = await assertSdRefs(workspaceId, {
    ...refs,
    templateIds: [dto.templateId],
    departmentIds: [...refs.departmentIds, dto.departmentId],
    userIds: [dto.assigneeId],
  })
  if (!configRefs.ok) return configRefs

  const missing = await SdRecurringTicketRepository.findMissingRefs(
    workspaceId,
    { customerId: dto.customerId, configItemId: dto.configItemId },
  )
  if (!missing.ok) return missing
  if (missing.value.length > 0) {
    const base = sdConfigNotFound()
    return err({
      ...base,
      message:
        missing.value[0] === 'customer'
          ? 'Cliente não encontrado nesta workspace'
          : 'Item de configuração não encontrado nesta workspace',
      details: { missing: missing.value },
    })
  }
  return ok(true)
}

/** A agenda resultante de uma edição parcial. */
function mergedSchedule(
  row: SdRecurringTicketWithRelations,
  dto: UpdateSdRecurringTicketDTO,
): SdRecurrenceSchedule {
  const current = toSdRecurrenceSchedule(row)
  return {
    frequency: dto.frequency ?? current.frequency,
    interval: dto.interval ?? current.interval,
    byWeekday: dto.byWeekday ?? current.byWeekday,
    byMonthday:
      dto.byMonthday === undefined ? current.byMonthday : dto.byMonthday,
    atTime: dto.atTime ?? current.atTime,
    timezone: dto.timezone ?? current.timezone,
    startsAt: dto.startsAt ?? current.startsAt,
    endsAt: dto.endsAt === undefined ? current.endsAt : dto.endsAt,
    leadTimeMinutes: dto.leadTimeMinutes ?? current.leadTimeMinutes,
  }
}

/** `nextRunAt` de uma regra ativa; `null` quando pausada ou já encerrada. */
function nextRunAtOf(
  schedule: SdRecurrenceSchedule,
  active: boolean,
  now: Date,
): Date | null {
  if (!active) return null
  return firstSdOccurrence(schedule, now)?.runAt ?? null
}

export const SdRecurringTicketService = {
  /** Agentes e admins; `configItemId` filtra as rotinas de um CI. */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdRecurringTicketsDTO = { includeInactive: false },
  ): Promise<Result<SdRecurringTicketDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdRecurringTicketRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    const now = new Date()
    return ok(rows.value.map((row) => toSdRecurringTicketDTO(row, now)))
  },

  async get(
    actorId: string,
    workspaceId: string,
    recurringId: string,
  ): Promise<Result<SdRecurringTicketDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const row = await SdRecurringTicketRepository.findById(
      recurringId,
      workspaceId,
    )
    if (!row.ok) return err(sdRecurringNotFound())
    return ok(toSdRecurringTicketDTO(row.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdRecurringTicketDTO,
  ): Promise<Result<SdRecurringTicketDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_recurring_ticket',
      action: 'create',
      targetId: (value) => value.id,
      meta: { ticketType: dto.ticketType, frequency: dto.frequency },
      run: async () => {
        const refs = await assertRefs(workspaceId, dto)
        if (!refs.ok) return refs

        const schedule: SdRecurrenceSchedule = {
          frequency: dto.frequency,
          interval: dto.interval,
          byWeekday: dto.byWeekday,
          byMonthday: dto.byMonthday ?? null,
          atTime: dto.atTime,
          timezone: dto.timezone,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt ?? null,
          leadTimeMinutes: dto.leadTimeMinutes,
        }
        const problem = sdRecurrenceProblem(schedule)
        if (problem) return err(sdRecurringScheduleInvalid(problem))

        const created = await SdRecurringTicketRepository.create(workspaceId, {
          ...dto,
          byMonthday: dto.byMonthday ?? null,
          endsAt: dto.endsAt ?? null,
          defaults: dto.defaults as Prisma.InputJsonValue,
          createdById: actorId,
          nextRunAt: nextRunAtOf(schedule, dto.active, new Date()),
        })
        if (!created.ok) return created
        return ok(toSdRecurringTicketDTO(created.value))
      },
    })
  },

  /**
   * Editar, pausar (`active: false`) ou retomar (`active: true`). Qualquer
   * mudança recalcula o próximo disparo a partir de agora.
   */
  async update(
    actorId: string,
    workspaceId: string,
    recurringId: string,
    dto: UpdateSdRecurringTicketDTO,
  ): Promise<Result<SdRecurringTicketDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_recurring_ticket',
      action: 'update',
      targetId: recurringId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdRecurringTicketRepository.findById(
          recurringId,
          workspaceId,
        )
        if (!existing.ok) return err(sdRecurringNotFound())

        const refs = await assertRefs(workspaceId, dto)
        if (!refs.ok) return refs

        const schedule = mergedSchedule(existing.value, dto)
        const problem = sdRecurrenceProblem(schedule)
        if (problem) return err(sdRecurringScheduleInvalid(problem))

        const active = dto.active ?? existing.value.active
        const data: SdRecurringTicketData = {
          ...dto,
          defaults: dto.defaults as Prisma.InputJsonValue | undefined,
          nextRunAt: nextRunAtOf(schedule, active, new Date()),
        }
        const updated = await SdRecurringTicketRepository.update(
          recurringId,
          workspaceId,
          data,
        )
        if (!updated.ok) return updated
        return ok(toSdRecurringTicketDTO(updated.value))
      },
    })
  },

  /** Exclusão lógica: para de disparar e sai das listas. */
  async remove(
    actorId: string,
    workspaceId: string,
    recurringId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_recurring_ticket',
      action: 'delete',
      targetId: recurringId,
      run: async () => {
        const existing = await SdRecurringTicketRepository.findById(
          recurringId,
          workspaceId,
        )
        if (!existing.ok) return err(sdRecurringNotFound())
        return SdRecurringTicketRepository.softDelete(recurringId, workspaceId)
      },
    })
  },

  /** Histórico de ocorrências (abriu, pulou, falhou). Agentes e admins. */
  async runs(
    actorId: string,
    workspaceId: string,
    recurringId: string,
    limit = 50,
  ): Promise<Result<SdRecurringTicketRunDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await SdRecurringTicketRepository.findById(
      recurringId,
      workspaceId,
    )
    if (!existing.ok) return err(sdRecurringNotFound())
    const rows = await SdRecurringTicketRunRepository.listByRecurring(
      recurringId,
      workspaceId,
      limit,
    )
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdRecurringTicketRunDTO))
  },

  /**
   * "Gerar agora": abre a ocorrência na hora, para testar a configuração.
   * Ignora `skipIfOpen` (é uma ação manual), registra a ocorrência com o
   * horário do clique e carimba `lastRunAt` **sem** consumir a agenda — o
   * próximo disparo continua o mesmo.
   */
  async runNow(
    actorId: string,
    workspaceId: string,
    recurringId: string,
  ): Promise<Result<SdRecurringTicketRunDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_recurring_ticket',
      action: 'activate',
      targetId: recurringId,
      run: async () => {
        const existing = await SdRecurringTicketRepository.findById(
          recurringId,
          workspaceId,
        )
        if (!existing.ok) return err(sdRecurringNotFound())

        const config = await SdTicketEngine.loadConfig(workspaceId)
        if (!config.ok) return config

        const now = new Date()
        const run = await openSdRecurringOccurrence({
          rule: existing.value,
          scheduledFor: now,
          config: config.value,
          honourSkipIfOpen: false,
          source: 'recurring-ticket.manual',
        })
        if (!run.ok) return run
        if (!run.value) {
          return err(
            sdConfigConflict(
              'Já existe uma ocorrência registrada neste instante',
            ),
          )
        }

        const touched = await SdRecurringTicketRepository.update(
          recurringId,
          workspaceId,
          { lastRunAt: now },
        )
        if (!touched.ok) return touched
        return ok(toSdRecurringTicketRunDTO(run.value))
      },
    })
  },
}
