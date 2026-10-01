import { sdOnCallLayerInvalid, sdOnCallOverrideOverlap } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  resolveSdOnCall,
  sdOnCallOverridesOverlap,
  sdOnCallTimeline,
} from '@/src/lib/servicedesk/oncall'
import {
  toSdOnCallNowDTO,
  toSdOnCallOverrideDTO,
  toSdOnCallOverrideSpecs,
  toSdOnCallScheduleDTO,
  toSdOnCallSpec,
  toSdOnCallTimelineDTO,
} from '@/src/mappers/sd-oncall.mapper'
import {
  SdOnCallRepository,
  type SdOnCallScheduleData,
  type SdOnCallScheduleWithRelations,
} from '@/src/repositories/sd-oncall.repository'
import type {
  CreateSdOnCallLayerDTO,
  CreateSdOnCallOverrideDTO,
  CreateSdOnCallScheduleDTO,
  ListSdOnCallOverridesDTO,
  ListSdOnCallSchedulesDTO,
  SdOnCallNowDTO as SdOnCallNowQuery,
  SdOnCallTimelineDTO as SdOnCallTimelineQuery,
  SetSdOnCallParticipantsDTO,
  UpdateSdOnCallLayerDTO,
  UpdateSdOnCallScheduleDTO,
} from '@/src/schemas/sd-oncall.schema'
import type {
  SdOnCallNowDTO,
  SdOnCallOverrideDTO,
  SdOnCallScheduleDTO,
  SdOnCallTimelineDTO,
} from '@/types/sd-oncall'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

/**
 * Escalas de plantão (on-call): quem responde fora do horário, por camadas,
 * com rodízio determinístico e trocas pontuais. Antes disso o escalonamento
 * fora do expediente caía sempre no líder fixo do departamento.
 *
 * Autorização: **admin do módulo** mantém a escala (`sdAdminMutation`);
 * **agente** consulta (`sd-oncall` × `VIEW`) — precisa saber quem chamar de
 * madrugada. Solicitante não vê nada.
 *
 * O rodízio em si é puro (`src/lib/servicedesk/oncall.ts`); este service só
 * carrega a escala, as trocas e aplica as regras de negócio.
 */

const VIEW = { resource: 'sd-oncall', action: 'VIEW' } as const
const DAY_MS = 24 * 60 * 60 * 1000

function toData(dto: Partial<CreateSdOnCallScheduleDTO>): SdOnCallScheduleData {
  const data: SdOnCallScheduleData = {}
  if (dto.name !== undefined) data.name = dto.name
  if (dto.departmentId !== undefined) data.departmentId = dto.departmentId
  if (dto.timezone !== undefined) data.timezone = dto.timezone
  if (dto.rotation !== undefined) data.rotation = dto.rotation
  if (dto.rotationStart !== undefined) data.rotationStart = dto.rotationStart
  if (dto.handoffTime !== undefined) data.handoffTime = dto.handoffTime
  if (dto.calendarId !== undefined) data.calendarId = dto.calendarId
  if (dto.active !== undefined) data.active = dto.active
  return data
}

/** Departamento e calendário precisam ser desta workspace. */
async function assertRefs(
  workspaceId: string,
  dto: Partial<CreateSdOnCallScheduleDTO>,
): Promise<Result<true>> {
  return assertSdRefs(workspaceId, {
    departmentIds: [dto.departmentId],
    calendarIds: [dto.calendarId],
  })
}

export const SdOnCallService = {
  /** Escalas com camadas e participantes. Agentes consultam. */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdOnCallSchedulesDTO = { includeInactive: false },
  ): Promise<Result<SdOnCallScheduleDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx
    const rows = await SdOnCallRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdOnCallScheduleDTO))
  },

  async get(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx
    const schedule = await SdOnCallRepository.findById(scheduleId, workspaceId)
    if (!schedule.ok) return schedule
    return ok(toSdOnCallScheduleDTO(schedule.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdOnCallScheduleDTO,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'create',
      targetId: (value) => value.id,
      meta: { rotation: dto.rotation },
      run: async () => {
        const refs = await assertRefs(workspaceId, dto)
        if (!refs.ok) return refs
        const created = await SdOnCallRepository.create(workspaceId, {
          ...toData(dto),
          name: dto.name,
          rotationStart: dto.rotationStart,
          createdById: actorId,
        })
        if (!created.ok) return created
        return ok(toSdOnCallScheduleDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
    dto: UpdateSdOnCallScheduleDTO,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'update',
      targetId: scheduleId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdOnCallRepository.findById(
          scheduleId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const refs = await assertRefs(workspaceId, dto)
        if (!refs.ok) return refs
        const updated = await SdOnCallRepository.update(
          scheduleId,
          workspaceId,
          toData(dto),
        )
        if (!updated.ok) return updated
        return ok(toSdOnCallScheduleDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'delete',
      targetId: scheduleId,
      run: async () => {
        const existing = await SdOnCallRepository.findById(
          scheduleId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdOnCallRepository.softDelete(scheduleId, workspaceId)
      },
    })
  },

  // ── Camadas ──────────────────────────────────────────────────────────────

  /** Nova camada (1 = primeira chamada). Nível repetido é recusado. */
  async addLayer(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
    dto: CreateSdOnCallLayerDTO,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'update',
      targetId: scheduleId,
      meta: { layer: dto.level },
      run: async () => {
        const schedule = await SdOnCallRepository.findById(
          scheduleId,
          workspaceId,
        )
        if (!schedule.ok) return schedule
        if (schedule.value.layers.some((layer) => layer.level === dto.level)) {
          return err(
            sdOnCallLayerInvalid(
              `Já existe a camada ${dto.level} nesta escala`,
            ),
          )
        }
        const created = await SdOnCallRepository.createLayer(scheduleId, {
          name: dto.name,
          level: dto.level,
        })
        if (!created.ok) return created
        return SdOnCallService.reload(scheduleId, workspaceId)
      },
    })
  },

  async updateLayer(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
    layerId: string,
    dto: UpdateSdOnCallLayerDTO,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'update',
      targetId: scheduleId,
      meta: { layerId, fields: Object.keys(dto) },
      run: async () => {
        const schedule = await SdOnCallRepository.findById(
          scheduleId,
          workspaceId,
        )
        if (!schedule.ok) return schedule
        const layer = schedule.value.layers.find((l) => l.id === layerId)
        if (!layer) return err(sdOnCallLayerInvalid('Camada não encontrada'))
        if (
          dto.level !== undefined &&
          schedule.value.layers.some(
            (l) => l.level === dto.level && l.id !== layerId,
          )
        ) {
          return err(
            sdOnCallLayerInvalid(
              `Já existe a camada ${dto.level} nesta escala`,
            ),
          )
        }
        const updated = await SdOnCallRepository.updateLayer(
          layerId,
          scheduleId,
          dto,
        )
        if (!updated.ok) return updated
        return SdOnCallService.reload(scheduleId, workspaceId)
      },
    })
  },

  async removeLayer(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
    layerId: string,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'update',
      targetId: scheduleId,
      meta: { layerId, removed: true },
      run: async () => {
        const schedule = await SdOnCallRepository.findById(
          scheduleId,
          workspaceId,
        )
        if (!schedule.ok) return schedule
        if (!schedule.value.layers.some((l) => l.id === layerId)) {
          return err(sdOnCallLayerInvalid('Camada não encontrada'))
        }
        const removed = await SdOnCallRepository.deleteLayer(
          layerId,
          scheduleId,
        )
        if (!removed.ok) return removed
        return SdOnCallService.reload(scheduleId, workspaceId)
      },
    })
  },

  /**
   * Substitui os participantes da camada: a ordem do array **é** a ordem do
   * rodízio, então o mesmo endpoint adiciona, remove e reordena.
   */
  async setParticipants(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
    layerId: string,
    dto: SetSdOnCallParticipantsDTO,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_schedule',
      action: 'update',
      targetId: scheduleId,
      meta: { layerId, participants: dto.userIds.length },
      run: async () => {
        const schedule = await SdOnCallRepository.findById(
          scheduleId,
          workspaceId,
        )
        if (!schedule.ok) return schedule
        if (!schedule.value.layers.some((l) => l.id === layerId)) {
          return err(sdOnCallLayerInvalid('Camada não encontrada'))
        }
        const refs = await assertSdRefs(workspaceId, { userIds: dto.userIds })
        if (!refs.ok) return refs
        const saved = await SdOnCallRepository.setParticipants(
          layerId,
          dto.userIds,
        )
        if (!saved.ok) return saved
        return SdOnCallService.reload(scheduleId, workspaceId)
      },
    })
  },

  // ── Trocas ───────────────────────────────────────────────────────────────

  async listOverrides(
    actorId: string,
    workspaceId: string,
    filters: ListSdOnCallOverridesDTO,
  ): Promise<Result<SdOnCallOverrideDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx
    const rows = await SdOnCallRepository.listOverrides(workspaceId, {
      ...filters,
      from: filters.from ?? new Date(),
    })
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdOnCallOverrideDTO))
  },

  /** Troca pontual. Sobreposição na mesma camada é recusada. */
  async createOverride(
    actorId: string,
    workspaceId: string,
    dto: CreateSdOnCallOverrideDTO,
  ): Promise<Result<SdOnCallOverrideDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_override',
      action: 'create',
      targetId: dto.scheduleId,
      meta: { layerId: dto.layerId ?? null },
      run: async () => {
        const schedule = await SdOnCallRepository.findById(
          dto.scheduleId,
          workspaceId,
        )
        if (!schedule.ok) return schedule
        if (
          dto.layerId &&
          !schedule.value.layers.some((l) => l.id === dto.layerId)
        ) {
          return err(sdOnCallLayerInvalid('Camada não encontrada'))
        }
        const refs = await assertSdRefs(workspaceId, { userIds: [dto.userId] })
        if (!refs.ok) return refs

        const existing = await SdOnCallRepository.listOverridesInRange(
          dto.scheduleId,
          dto.startsAt,
          dto.endsAt,
        )
        if (!existing.ok) return existing
        const clash = existing.value.find((override) =>
          sdOnCallOverridesOverlap(override, dto),
        )
        if (clash) {
          return err(
            sdOnCallOverrideOverlap(
              'Já existe uma troca de plantão nesta camada e neste período',
            ),
          )
        }

        const created = await SdOnCallRepository.createOverride(workspaceId, {
          scheduleId: dto.scheduleId,
          layerId: dto.layerId ?? null,
          userId: dto.userId,
          startsAt: dto.startsAt,
          endsAt: dto.endsAt,
          reason: dto.reason ?? null,
          createdById: actorId,
        })
        if (!created.ok) return created
        return ok(toSdOnCallOverrideDTO(created.value))
      },
    })
  },

  async removeOverride(
    actorId: string,
    workspaceId: string,
    overrideId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_oncall_override',
      action: 'delete',
      targetId: overrideId,
      run: async () => {
        const existing = await SdOnCallRepository.findOverrideById(
          overrideId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdOnCallRepository.deleteOverride(overrideId, workspaceId)
      },
    })
  },

  // ── Consultas ────────────────────────────────────────────────────────────

  /**
   * Quem está de plantão agora (ou em `at`). Sem `departmentId`, devolve
   * todas as escalas ativas; com ele, só a que cobre o time.
   */
  async now(
    actorId: string,
    workspaceId: string,
    query: SdOnCallNowQuery = {},
  ): Promise<Result<SdOnCallNowDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx
    const at = query.at ?? new Date()

    let schedules: SdOnCallScheduleWithRelations[] = []
    if (query.departmentId) {
      const found = await SdOnCallRepository.findActiveForDepartment(
        workspaceId,
        query.departmentId,
      )
      if (!found.ok) return found
      schedules = found.value ? [found.value] : []
    } else {
      const all = await SdOnCallRepository.list(workspaceId)
      if (!all.ok) return all
      schedules = all.value
    }

    const out: SdOnCallNowDTO[] = []
    for (const schedule of schedules) {
      const overrides = await SdOnCallRepository.listOverridesInRange(
        schedule.id,
        at,
        new Date(at.getTime() + 1),
      )
      if (!overrides.ok) return overrides
      const resolution = resolveSdOnCall(
        at,
        toSdOnCallSpec(schedule),
        toSdOnCallOverrideSpecs(overrides.value),
      )
      out.push(toSdOnCallNowDTO(schedule, resolution, overrides.value))
    }
    return ok(out)
  },

  /** Linha do tempo (padrão: duas semanas a partir de agora). */
  async timeline(
    actorId: string,
    workspaceId: string,
    scheduleId: string,
    query: SdOnCallTimelineQuery,
  ): Promise<Result<SdOnCallTimelineDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx
    const schedule = await SdOnCallRepository.findById(scheduleId, workspaceId)
    if (!schedule.ok) return schedule

    const from = query.from ?? new Date()
    const to = new Date(from.getTime() + query.days * DAY_MS)
    const overrides = await SdOnCallRepository.listOverridesInRange(
      scheduleId,
      from,
      to,
    )
    if (!overrides.ok) return overrides

    const timeline = sdOnCallTimeline(
      toSdOnCallSpec(schedule.value),
      toSdOnCallOverrideSpecs(overrides.value),
      from,
      to,
    )
    return ok(
      toSdOnCallTimelineDTO(
        schedule.value,
        timeline,
        { from, to },
        overrides.value,
      ),
    )
  },

  /** Recarrega a escala depois de mexer em camada/participante. */
  async reload(
    scheduleId: string,
    workspaceId: string,
  ): Promise<Result<SdOnCallScheduleDTO>> {
    const schedule = await SdOnCallRepository.findById(scheduleId, workspaceId)
    if (!schedule.ok) return schedule
    return ok(toSdOnCallScheduleDTO(schedule.value))
  },
}
