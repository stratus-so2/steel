import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdEscalationRuleDTO } from '@/src/mappers/sd-escalation-rule.mapper'
import { SdEscalationRuleRepository } from '@/src/repositories/sd-escalation-rule.repository'
import type {
  CreateSdEscalationRuleDTO,
  UpdateSdEscalationRuleDTO,
} from '@/src/schemas/sd-escalation-rule.schema'
import type { SdEscalationActions } from '@/src/schemas/sd-rule.schema'
import type { SdEscalationRuleDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

function actionRefs(actions: SdEscalationActions | undefined) {
  return {
    userIds: [...(actions?.notifyUserIds ?? []), actions?.reassignUserId],
    departmentIds: [actions?.reassignDepartmentId],
  }
}

export const SdEscalationRuleService = {
  /** Agentes leem (a aba Escalonamento do chamado mostra as regras). */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdEscalationRuleDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdEscalationRuleRepository.list(workspaceId)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdEscalationRuleDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdEscalationRuleDTO,
  ): Promise<Result<SdEscalationRuleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_escalation_rule',
      action: 'create',
      targetId: (value) => value.id,
      meta: { trigger: dto.trigger },
      run: async () => {
        const refs = await assertSdRefs(workspaceId, actionRefs(dto.actions))
        if (!refs.ok) return refs
        const created = await SdEscalationRuleRepository.create(workspaceId, {
          ...dto,
          thresholdMinutes:
            dto.trigger === 'NO_UPDATE' ? (dto.thresholdMinutes ?? null) : null,
        })
        if (!created.ok) return created
        return ok(toSdEscalationRuleDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    ruleId: string,
    dto: UpdateSdEscalationRuleDTO,
  ): Promise<Result<SdEscalationRuleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_escalation_rule',
      action: 'update',
      targetId: ruleId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdEscalationRuleRepository.findById(
          ruleId,
          workspaceId,
        )
        if (!existing.ok) return existing

        const trigger = dto.trigger ?? existing.value.trigger
        const threshold =
          dto.thresholdMinutes !== undefined
            ? dto.thresholdMinutes
            : existing.value.thresholdMinutes
        if (trigger === 'NO_UPDATE' && !threshold) {
          return err(validationError('Informe os minutos sem atualização'))
        }
        const refs = await assertSdRefs(workspaceId, actionRefs(dto.actions))
        if (!refs.ok) return refs

        const updated = await SdEscalationRuleRepository.update(
          ruleId,
          workspaceId,
          {
            ...dto,
            thresholdMinutes: trigger === 'NO_UPDATE' ? threshold : null,
          },
        )
        if (!updated.ok) return updated
        return ok(toSdEscalationRuleDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    ruleId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_escalation_rule',
      action: 'delete',
      targetId: ruleId,
      run: async () => {
        const existing = await SdEscalationRuleRepository.findById(
          ruleId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdEscalationRuleRepository.delete(ruleId, workspaceId)
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
      entity: 'sd_escalation_rule',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdEscalationRuleRepository.reorder(workspaceId, orderedIds),
    })
  },
}
