import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmSettingsDTO } from '@/src/mappers/crm-settings.mapper'
import { CrmSettingsRepository } from '@/src/repositories/crm-settings.repository'
import type { UpdateCrmSettingsDTO } from '@/src/schemas/crm-settings.schema'
import type { CrmSettingsDTO } from '@/types/crm-settings'
import { assertModuleMember, assertModulePrivileged } from './authz'

/** Valores efetivos usados pelas regras de negócio (salvos ou padrão). */
export type ResolvedCrmSettings = Pick<
  CrmSettingsDTO,
  'leadReopenStage' | 'proposalValidityDays' | 'notifyProposalExpiry'
>

export const CrmSettingsService = {
  /** Qualquer membro do CRM lê (a UI mostra, p.ex., para onde o lead volta). */
  async get(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmSettingsDTO>> {
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM')
    if (!membership.ok) return membership

    const result = await CrmSettingsRepository.findByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(toCrmSettingsDTO(workspaceId, result.value))
  },

  /** Só OWNER/ADMIN alteram as configurações do CRM. */
  async update(
    actorId: string,
    workspaceId: string,
    dto: UpdateCrmSettingsDTO,
  ): Promise<Result<CrmSettingsDTO>> {
    const membership = await assertModulePrivileged(actorId, workspaceId, 'CRM')
    if (!membership.ok) return membership

    const result = await CrmSettingsRepository.upsert(workspaceId, {
      ...dto,
      updatedById: actorId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_settings',
        action: 'update',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_settings',
      action: 'update',
      actorId,
      targetId: workspaceId,
      meta: { ...dto },
    })

    return ok(toCrmSettingsDTO(workspaceId, result.value))
  },

  /**
   * Configurações efetivas de uma workspace, sem checagem de acesso — para
   * uso interno de outros services e do worker (quem chama já autorizou).
   */
  async resolve(workspaceId: string): Promise<Result<ResolvedCrmSettings>> {
    const result = await CrmSettingsRepository.findByWorkspace(workspaceId)
    if (!result.ok) return result

    const { leadReopenStage, proposalValidityDays, notifyProposalExpiry } =
      toCrmSettingsDTO(workspaceId, result.value)
    return ok({ leadReopenStage, proposalValidityDays, notifyProposalExpiry })
  },
}
