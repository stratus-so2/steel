import { createHash, randomBytes } from 'node:crypto'
import { sdConfigNotFound } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toSdMonitorAlertDTO,
  toSdMonitorSourceDTO,
  toSdMonitorSourceWithTokenDTO,
} from '@/src/mappers/sd-monitor.mapper'
import { SdCustomerRepository } from '@/src/repositories/sd-customer.repository'
import { SdMonitorAlertRepository } from '@/src/repositories/sd-monitor-alert.repository'
import {
  type SdMonitorSourceData,
  SdMonitorSourceRepository,
} from '@/src/repositories/sd-monitor-source.repository'
import type {
  CreateSdMonitorSourceDTO,
  ListSdMonitorAlertsDTO,
  ListSdMonitorSourcesDTO,
  UpdateSdMonitorSourceDTO,
} from '@/src/schemas/sd-monitor-source.schema'
import type {
  SdMonitorAlertDTO,
  SdMonitorSourceDTO,
  SdMonitorSourceWithTokenDTO,
} from '@/types/sd-monitor'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

/**
 * Origens de monitoramento (Zabbix e webhook genérico): CRUD só de admin do
 * módulo, no mesmo molde das demais coleções de configuração.
 *
 * O token da URL pública é sorteado na criação (32 bytes em base64url),
 * mostrado **uma única vez** e guardado apenas como SHA-256 — igual ao link
 * de aprovação por e-mail. Perdeu o token, gere outro (`regenerateToken`):
 * o anterior deixa de valer na hora.
 */

/** Token da URL pública e o hash guardado no banco. */
export function newSdMonitorToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashSdMonitorToken(token) }
}

export function hashSdMonitorToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Confere departamento, categoria, cliente e as prioridades do mapa. */
async function assertRefs(
  workspaceId: string,
  dto: Partial<CreateSdMonitorSourceDTO>,
): Promise<Result<true>> {
  const refs = await assertSdRefs(workspaceId, {
    departmentIds: [dto.departmentId],
    categoryIds: [dto.categoryId],
    priorityIds: (dto.severityMap ?? []).map((entry) => entry.priorityId),
  })
  if (!refs.ok) return refs
  if (!dto.customerId) return ok(true)

  const found = await SdCustomerRepository.findExistingIds(workspaceId, [
    dto.customerId,
  ])
  if (!found.ok) return found
  if (found.value.length === 0) {
    return err({
      ...sdConfigNotFound(),
      message: 'Cliente não encontrado nesta workspace',
    })
  }
  return ok(true)
}

function toData(
  dto: Partial<CreateSdMonitorSourceDTO>,
): SdMonitorSourceData & { severityMap?: SdMonitorSourceData['severityMap'] } {
  const data: SdMonitorSourceData = {}
  if (dto.name !== undefined) data.name = dto.name
  if (dto.kind !== undefined) data.kind = dto.kind
  if (dto.active !== undefined) data.active = dto.active
  if (dto.ticketType !== undefined) data.ticketType = dto.ticketType
  if (dto.departmentId !== undefined) data.departmentId = dto.departmentId
  if (dto.categoryId !== undefined) data.categoryId = dto.categoryId
  if (dto.customerId !== undefined) data.customerId = dto.customerId
  if (dto.severityMap !== undefined) data.severityMap = dto.severityMap
  if (dto.autoResolve !== undefined) data.autoResolve = dto.autoResolve
  if (dto.flappingWindowMinutes !== undefined) {
    data.flappingWindowMinutes = dto.flappingWindowMinutes
  }
  return data
}

export const SdMonitorSourceService = {
  /** Agentes consultam (a tela do chamado mostra a origem), admins mantêm. */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdMonitorSourcesDTO = { includeInactive: false },
  ): Promise<Result<SdMonitorSourceDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdMonitorSourceRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdMonitorSourceDTO))
  },

  /** Alertas recebidos (origem, chamado ou status). Só agentes. */
  async listAlerts(
    actorId: string,
    workspaceId: string,
    filters: ListSdMonitorAlertsDTO,
  ): Promise<Result<SdMonitorAlertDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdMonitorAlertRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdMonitorAlertDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdMonitorSourceDTO,
  ): Promise<Result<SdMonitorSourceWithTokenDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_monitor_source',
      action: 'create',
      targetId: (value) => value.id,
      meta: { kind: dto.kind },
      run: async () => {
        const refs = await assertRefs(workspaceId, dto)
        if (!refs.ok) return refs
        const { token, hash } = newSdMonitorToken()
        const created = await SdMonitorSourceRepository.create(workspaceId, {
          ...toData(dto),
          name: dto.name,
          tokenHash: hash,
          createdById: actorId,
        })
        if (!created.ok) return created
        return ok(toSdMonitorSourceWithTokenDTO(created.value, token))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    sourceId: string,
    dto: UpdateSdMonitorSourceDTO,
  ): Promise<Result<SdMonitorSourceDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_monitor_source',
      action: 'update',
      targetId: sourceId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdMonitorSourceRepository.findById(
          sourceId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const refs = await assertRefs(workspaceId, dto)
        if (!refs.ok) return refs
        const updated = await SdMonitorSourceRepository.update(
          sourceId,
          workspaceId,
          toData(dto),
        )
        if (!updated.ok) return updated
        return ok(toSdMonitorSourceDTO(updated.value))
      },
    })
  },

  /** Novo token (o anterior para de funcionar na hora). Mostrado uma vez. */
  async regenerateToken(
    actorId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<Result<SdMonitorSourceWithTokenDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_monitor_source',
      action: 'update',
      targetId: sourceId,
      meta: { token: 'regenerated' },
      run: async () => {
        const existing = await SdMonitorSourceRepository.findById(
          sourceId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const { token, hash } = newSdMonitorToken()
        const updated = await SdMonitorSourceRepository.update(
          sourceId,
          workspaceId,
          { tokenHash: hash },
        )
        if (!updated.ok) return updated
        return ok(toSdMonitorSourceWithTokenDTO(updated.value, token))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    sourceId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_monitor_source',
      action: 'delete',
      targetId: sourceId,
      run: async () => {
        const existing = await SdMonitorSourceRepository.findById(
          sourceId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdMonitorSourceRepository.softDelete(sourceId, workspaceId)
      },
    })
  },
}
