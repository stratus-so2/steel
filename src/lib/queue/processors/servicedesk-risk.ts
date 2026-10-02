import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  type SdClusterScanResult,
  SdRiskService,
  type SdRiskTickResult,
} from '@/src/services/sd-risk.service'
import { ServicedeskRiskJob } from '../jobs'

/**
 * Fila `servicedesk-risk` (ADR 0016):
 *
 * - `recompute-risk` (a cada 10 min) recalcula a previsão de violação de SLA
 *   dos chamados abertos — heurística explicável, sem LLM — e avisa quem
 *   atende quando um chamado **entra** na faixa de risco alto;
 * - `scan-clusters` (de hora em hora) agrupa os incidentes parecidos da
 *   janela e grava as sugestões de problema.
 *
 * Idempotente: a previsão é uma linha por chamado (upsert) e o agrupamento é
 * único por assinatura, então um retry não duplica nada nem reavisa.
 */
export async function processServicedeskRisk(
  job: Job<{ workspaceId?: string }>,
): Promise<SdRiskTickResult | SdClusterScanResult> {
  const workspaceId = job.data?.workspaceId

  switch (job.name) {
    case ServicedeskRiskJob.RecomputeRisk: {
      const result = await SdRiskService.recomputeTick({ workspaceId })
      if (!result.ok) {
        throw new Error(
          `servicedesk-risk recompute failed: ${result.error.code} ${result.error.message}`,
        )
      }
      logger.info('queue.servicedesk_risk.recompute_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    case ServicedeskRiskJob.ScanClusters: {
      const result = await SdRiskService.scanClusters({ workspaceId })
      if (!result.ok) {
        throw new Error(
          `servicedesk-risk cluster scan failed: ${result.error.code} ${result.error.message}`,
        )
      }
      logger.info('queue.servicedesk_risk.clusters_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown servicedesk-risk job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
