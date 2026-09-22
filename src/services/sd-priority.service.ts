import { ok, type Result } from '@/src/lib/result'
import {
  toSdPriorityMatrixCellDTO,
  toSdScaleItemDTO,
} from '@/src/mappers/sd-priority.mapper'
import { SdPriorityRepository } from '@/src/repositories/sd-priority.repository'
import type {
  CreateSdScaleItemDTO,
  SaveSdPriorityMatrixDTO,
  SdScaleKind,
  UpdateSdScaleItemDTO,
} from '@/src/schemas/sd-priority.schema'
import type { SdPriorityMatrixCellDTO, SdScaleItemDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

/**
 * Impacto, urgência, prioridade e severidade (mesma forma, `kind` escolhe a
 * tabela) + matriz impacto × urgência → prioridade.
 */
export const SdPriorityService = {
  async list(
    actorId: string,
    workspaceId: string,
    kind: SdScaleKind,
  ): Promise<Result<SdScaleItemDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdPriorityRepository.list(kind, workspaceId)
    if (!rows.ok) return rows
    return ok(rows.value.map((row) => toSdScaleItemDTO(kind, row)))
  },

  async create(
    actorId: string,
    workspaceId: string,
    kind: SdScaleKind,
    dto: CreateSdScaleItemDTO,
  ): Promise<Result<SdScaleItemDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_priority_scale',
      action: 'create',
      targetId: (value) => value.id,
      meta: { kind },
      run: async () => {
        let isDefault = dto.isDefault
        if (kind === 'priority' && !isDefault) {
          // A primeira prioridade vira a padrão.
          const count = await SdPriorityRepository.count(kind, workspaceId)
          if (!count.ok) return count
          isDefault = count.value === 0
        }
        const created = await SdPriorityRepository.create(kind, workspaceId, {
          ...dto,
          isDefault,
        })
        if (!created.ok) return created
        return ok(toSdScaleItemDTO(kind, created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    kind: SdScaleKind,
    itemId: string,
    dto: UpdateSdScaleItemDTO,
  ): Promise<Result<SdScaleItemDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_priority_scale',
      action: 'update',
      targetId: itemId,
      meta: { kind, fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdPriorityRepository.findById(
          kind,
          itemId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const updated = await SdPriorityRepository.update(
          kind,
          itemId,
          workspaceId,
          dto,
        )
        if (!updated.ok) return updated
        return ok(toSdScaleItemDTO(kind, updated.value))
      },
    })
  },

  /** Remove o item (células da matriz e metas de SLA ligadas saem junto). */
  async remove(
    actorId: string,
    workspaceId: string,
    kind: SdScaleKind,
    itemId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_priority_scale',
      action: 'delete',
      targetId: itemId,
      meta: { kind },
      run: async () => {
        const existing = await SdPriorityRepository.findById(
          kind,
          itemId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdPriorityRepository.delete(kind, itemId, workspaceId)
      },
    })
  },

  async getMatrix(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdPriorityMatrixCellDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const cells = await SdPriorityRepository.listMatrix(workspaceId)
    if (!cells.ok) return cells
    return ok(cells.value.map(toSdPriorityMatrixCellDTO))
  },

  /** Salva a grade inteira (células ausentes = sem prioridade automática). */
  async saveMatrix(
    actorId: string,
    workspaceId: string,
    dto: SaveSdPriorityMatrixDTO,
  ): Promise<Result<SdPriorityMatrixCellDTO[]>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_priority_matrix',
      action: 'update',
      targetId: workspaceId,
      meta: { cells: dto.cells.length },
      run: async () => {
        const refs = await assertSdRefs(workspaceId, {
          impactIds: dto.cells.map((c) => c.impactId),
          urgencyIds: dto.cells.map((c) => c.urgencyId),
          priorityIds: dto.cells.map((c) => c.priorityId),
        })
        if (!refs.ok) return refs
        const saved = await SdPriorityRepository.saveMatrix(
          workspaceId,
          dto.cells,
        )
        if (!saved.ok) return saved
        return ok(saved.value.map(toSdPriorityMatrixCellDTO))
      },
    })
  },
}
