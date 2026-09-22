import { sdConfigConflict } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdSlaPolicyDTO } from '@/src/mappers/sd-sla-policy.mapper'
import { SdSlaPolicyRepository } from '@/src/repositories/sd-sla-policy.repository'
import type {
  CreateSdSlaPolicyDTO,
  UpdateSdSlaPolicyDTO,
} from '@/src/schemas/sd-sla-policy.schema'
import type { SdSlaPolicyDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

const DEFAULT_REQUIRED =
  'A workspace precisa de uma política de SLA padrão: marque outra como padrão antes'

export const SdSlaPolicyService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdSlaPolicyDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdSlaPolicyRepository.list(workspaceId)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdSlaPolicyDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdSlaPolicyDTO,
  ): Promise<Result<SdSlaPolicyDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_sla_policy',
      action: 'create',
      targetId: (value) => value.id,
      run: async () => {
        const refs = await assertSdRefs(workspaceId, {
          calendarIds: [dto.calendarId],
          priorityIds: dto.targets.map((t) => t.priorityId),
        })
        if (!refs.ok) return refs

        const defaults = await SdSlaPolicyRepository.countDefaults(workspaceId)
        if (!defaults.ok) return defaults

        const { targets, ...data } = dto
        const created = await SdSlaPolicyRepository.create(
          workspaceId,
          { ...data, isDefault: data.isDefault || defaults.value === 0 },
          targets,
        )
        if (!created.ok) return created
        return ok(toSdSlaPolicyDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    policyId: string,
    dto: UpdateSdSlaPolicyDTO,
  ): Promise<Result<SdSlaPolicyDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_sla_policy',
      action: 'update',
      targetId: policyId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdSlaPolicyRepository.findById(
          policyId,
          workspaceId,
        )
        if (!existing.ok) return existing
        if (
          existing.value.isDefault &&
          (dto.isDefault === false || dto.active === false)
        ) {
          return err(sdConfigConflict(DEFAULT_REQUIRED))
        }

        const refs = await assertSdRefs(workspaceId, {
          calendarIds: [dto.calendarId],
          priorityIds: dto.targets?.map((t) => t.priorityId),
        })
        if (!refs.ok) return refs

        const { targets, ...data } = dto
        const updated = await SdSlaPolicyRepository.update(
          policyId,
          workspaceId,
          data,
          targets,
        )
        if (!updated.ok) return updated
        return ok(toSdSlaPolicyDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    policyId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_sla_policy',
      action: 'delete',
      targetId: policyId,
      run: async () => {
        const existing = await SdSlaPolicyRepository.findById(
          policyId,
          workspaceId,
        )
        if (!existing.ok) return existing
        if (existing.value.isDefault) {
          return err(sdConfigConflict(DEFAULT_REQUIRED))
        }
        return SdSlaPolicyRepository.delete(policyId, workspaceId)
      },
    })
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_sla_policy',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdSlaPolicyRepository.reorder(workspaceId, orderedIds),
    })
  },
}
