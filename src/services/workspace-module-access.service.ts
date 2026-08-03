import type { ModuleKind } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import { toWorkspaceModuleAccessDTO } from '@/src/mappers/workspace-module-access.mapper'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmPipelineSeedService } from '@/src/services/crm-pipeline-seed.service'
import { WhatsAppDashboardSeedService } from '@/src/services/whatsapp-dashboard-seed.service'
import type {
  WorkspaceModuleAccessDTO,
  WorkspaceModuleAccessSummaryDTO,
} from '@/types/workspace-module-access'
import { assertPlatformAdmin } from './authz'

const ALL_MODULES: ModuleKind[] = ['SERVICE_DESK', 'CRM', 'COMMUNICATION']

export const WorkspaceModuleAccessService = {
  /** Visão dos 3 módulos para o painel admin global, incluindo os nunca concedidos. */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceModuleAccessSummaryDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const result =
      await WorkspaceModuleAccessRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    const byModule = new Map(result.value.map((a) => [a.module, a]))

    return ok(
      ALL_MODULES.map((module) => {
        const access = byModule.get(module)
        return access
          ? {
              module,
              enabled: access.enabled,
              grantedById: access.grantedById,
              updatedAt: access.updatedAt.toISOString(),
            }
          : { module, enabled: false, grantedById: null, updatedAt: null }
      }),
    )
  },

  async setEnabled(
    actorId: string,
    workspaceId: string,
    module: ModuleKind,
    enabled: boolean,
  ): Promise<Result<WorkspaceModuleAccessDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const result = await WorkspaceModuleAccessRepository.upsert(
      workspaceId,
      module,
      enabled,
      actorId,
    )

    if (!result.ok) {
      auditMutation({
        entity: 'workspace_module_access',
        action: enabled ? 'grant' : 'revoke',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: result.error.code,
        meta: { module, enabled },
      })
      return result
    }

    auditMutation({
      entity: 'workspace_module_access',
      action: enabled ? 'grant' : 'revoke',
      actorId,
      targetId: workspaceId,
      meta: { module, enabled },
    })

    // Dashboards/relatórios padrão do zap e pipeline padrão do CRM — não
    // bloqueiam a concessão do módulo se o seed falhar, só registram pra
    // investigação.
    if (module === 'COMMUNICATION' && enabled) {
      const seed = await WhatsAppDashboardSeedService.seedDefaults(
        workspaceId,
        actorId,
      )
      if (!seed.ok) {
        logger.error('workspace_module_access.seed_defaults_failed', {
          workspaceId,
          actorId,
          error: seed.error,
        })
      }
    }

    if (module === 'CRM' && enabled) {
      const seed = await CrmPipelineSeedService.seedDefaultPipeline(
        workspaceId,
        actorId,
      )
      if (!seed.ok) {
        logger.error('workspace_module_access.seed_default_pipeline_failed', {
          workspaceId,
          actorId,
          error: seed.error,
        })
      }
    }

    return ok(toWorkspaceModuleAccessDTO(result.value))
  },

  /**
   * Leitura usada pelo enforcement nos layouts de módulo — sem checagem de
   * platform admin, é uma checagem de negócio (acesso do workspace), não
   * uma ação administrativa.
   */
  async isModuleEnabled(
    workspaceId: string,
    module: ModuleKind,
  ): Promise<Result<boolean>> {
    return WorkspaceModuleAccessRepository.isEnabled(workspaceId, module)
  },
}
