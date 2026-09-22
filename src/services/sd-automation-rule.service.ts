import { ok, type Result } from '@/src/lib/result'
import { toSdAutomationRuleDTO } from '@/src/mappers/sd-automation-rule.mapper'
import { SdAutomationRuleRepository } from '@/src/repositories/sd-automation-rule.repository'
import {
  type CreateSdAutomationRuleDTO,
  type ListSdAutomationRulesDTO,
  sdAutomationActionRefs,
  type UpdateSdAutomationRuleDTO,
} from '@/src/schemas/sd-automation-rule.schema'
import type { SdAutomationRuleDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

export const SdAutomationRuleService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdAutomationRulesDTO = {},
  ): Promise<Result<SdAutomationRuleDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdAutomationRuleRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdAutomationRuleDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdAutomationRuleDTO,
  ): Promise<Result<SdAutomationRuleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_automation_rule',
      action: 'create',
      targetId: (value) => value.id,
      meta: { event: dto.event },
      run: async () => {
        const refs = await assertSdRefs(
          workspaceId,
          sdAutomationActionRefs(dto.actions),
        )
        if (!refs.ok) return refs
        const created = await SdAutomationRuleRepository.create(
          workspaceId,
          dto,
        )
        if (!created.ok) return created
        return ok(toSdAutomationRuleDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    ruleId: string,
    dto: UpdateSdAutomationRuleDTO,
  ): Promise<Result<SdAutomationRuleDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_automation_rule',
      action: 'update',
      targetId: ruleId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdAutomationRuleRepository.findById(
          ruleId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const refs = await assertSdRefs(
          workspaceId,
          sdAutomationActionRefs(dto.actions ?? []),
        )
        if (!refs.ok) return refs
        const updated = await SdAutomationRuleRepository.update(
          ruleId,
          workspaceId,
          dto,
        )
        if (!updated.ok) return updated
        return ok(toSdAutomationRuleDTO(updated.value))
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
      entity: 'sd_automation_rule',
      action: 'delete',
      targetId: ruleId,
      run: async () => {
        const existing = await SdAutomationRuleRepository.findById(
          ruleId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdAutomationRuleRepository.delete(ruleId, workspaceId)
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
      entity: 'sd_automation_rule',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdAutomationRuleRepository.reorder(workspaceId, orderedIds),
    })
  },
}
