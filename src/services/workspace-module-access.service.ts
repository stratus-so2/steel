import type { ModuleKind } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { persistAdminAction } from '@/src/lib/admin-audit'
import { ok, type Result } from '@/src/lib/result'
import { toWorkspaceModuleAccessDTO } from '@/src/mappers/workspace-module-access.mapper'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmPipelineSeedService } from '@/src/services/crm-pipeline-seed.service'
import { SdDashboardSeedService } from '@/src/services/sd-dashboard-seed.service'
import { SdSeedService } from '@/src/services/sd-seed.service'
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
    await persistAdminAction({
      actor: admin.value,
      action: enabled ? 'module.grant' : 'module.revoke',
      targetType: 'workspace',
      targetId: workspaceId,
      meta: { module },
    })

    // Default zap dashboards/reports and the default CRM pipeline — a failing
    // seed does not block granting the module. That decision stands; what
    // changed is that the failure now comes back in `seedWarnings` instead of
    // living only in the log, so whoever enabled it knows the module was
    // granted half-configured.
    const seedWarnings: string[] = []
    const warn = (event: string, error: unknown, message: string) => {
      logger.error(event, { workspaceId, actorId, error })
      seedWarnings.push(message)
    }

    if (module === 'COMMUNICATION' && enabled) {
      const seed = await WhatsAppDashboardSeedService.seedDefaults(
        workspaceId,
        actorId,
      )
      if (!seed.ok) {
        warn(
          'workspace_module_access.seed_defaults_failed',
          seed.error,
          'Os painéis e relatórios padrão do WhatsApp não foram criados. Crie-os na tela de dashboards ou tente liberar o módulo de novo.',
        )
      }
    }

    if (module === 'CRM' && enabled) {
      const seed = await CrmPipelineSeedService.seedDefaultPipeline(
        workspaceId,
        actorId,
      )
      if (!seed.ok) {
        warn(
          'workspace_module_access.seed_default_pipeline_failed',
          seed.error,
          'O pipeline padrão do CRM não foi criado. Crie um pipeline nas configurações do CRM antes de usar os leads.',
        )
      }
    }

    if (module === 'SERVICE_DESK' && enabled) {
      const seed = await SdSeedService.seedDefaults(workspaceId, actorId)
      if (!seed.ok) {
        warn(
          'workspace_module_access.seed_servicedesk_failed',
          seed.error,
          'Os padrões ITIL do ServiceDesk não foram criados: sem fases, o kanban de chamados fica sem coluna. Use "Restaurar padrões ITIL" em Configurações > Geral do módulo.',
        )
      }
      // Dashboards padrão (Analítico e KPIs/TV) — também não bloqueiam.
      const dashboards = await SdDashboardSeedService.seedDefaults(
        workspaceId,
        actorId,
      )
      if (!dashboards.ok) {
        warn(
          'workspace_module_access.seed_sd_dashboards_failed',
          dashboards.error,
          'Os dashboards padrão do ServiceDesk não foram criados. Crie-os na tela de dashboards do módulo.',
        )
      }
    }

    return ok(toWorkspaceModuleAccessDTO(result.value, seedWarnings))
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
