import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import type { Result } from '@/src/lib/result'
import {
  SdSeedRepository,
  type SdSeedSummary,
} from '@/src/repositories/sd-seed.repository'
import { sdAdminMutation } from './sd-config-support'
import { SD_SEED_PLAN, type SdSeedPlan } from './sd-seed-data'

/**
 * Padrões ITIL do ServiceDesk (fases por tipo, matriz 3×3, P1–P4,
 * severidades, classificações, calendários 8×5/24×7 com feriados, SLAs,
 * tipos de CI, departamentos, catálogo de exemplo, modelos e regras).
 * Idempotente — ver `SdSeedRepository.apply`.
 */
export const SdSeedService = {
  /**
   * Chamado por `WorkspaceModuleAccessService` ao liberar SERVICE_DESK e
   * pelo backfill `pnpm seed:servicedesk`. Sem checagem de autorização
   * (quem chama já é o admin da plataforma / script).
   */
  async seedDefaults(
    workspaceId: string,
    actorId: string,
    plan: SdSeedPlan = SD_SEED_PLAN,
  ): Promise<Result<SdSeedSummary>> {
    const result = await SdSeedRepository.apply(workspaceId, actorId, plan)
    if (!result.ok) {
      logger.error('servicedesk.seed.failed', {
        workspaceId,
        actorId,
        error: result.error.code,
      })
      auditMutation({
        entity: 'sd_seed',
        action: 'create',
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }
    logger.info('servicedesk.seed.applied', { workspaceId, ...result.value })
    auditMutation({
      entity: 'sd_seed',
      action: 'create',
      actorId,
      targetId: workspaceId,
      meta: result.value,
    })
    return result
  },

  /**
   * "Restaurar padrões" pela tela de configurações: recria o que falta dos
   * padrões ITIL sem mexer no que o admin já customizou.
   */
  async restoreDefaults(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdSeedSummary>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_seed',
      action: 'restore',
      targetId: workspaceId,
      run: () => SdSeedRepository.apply(workspaceId, actorId, SD_SEED_PLAN),
    })
  },
}
