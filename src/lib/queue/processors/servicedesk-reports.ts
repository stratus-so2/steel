import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { SdReportRunner } from '@/src/services/sd-report-runner'
import { ServicedeskReportsJob } from '../jobs'

/**
 * Fila `servicedesk-reports`:
 *
 * - `run-tick` (de hora em hora, :10) procura os agendamentos com
 *   `nextRunAt` vencido, enfileira um `generate-report` por agendamento (com
 *   o período já carimbado) e recalcula o próximo envio;
 * - `generate-report` apura o período, grava PDF/CSV no MinIO e manda o
 *   e-mail. A trava `(reportId, periodStart)` garante que um retry não
 *   reenvie o mesmo relatório.
 *
 * O job falha (e o BullMQ tenta de novo) só quando a geração devolve erro; o
 * resto — e-mail de um destinatário, aviso in-app — é tolerante e vira log.
 */
export async function processServicedeskReports(job: Job): Promise<unknown> {
  switch (job.name) {
    case ServicedeskReportsJob.RunTick: {
      const result = await SdReportRunner.runTick()
      logger.info('queue.servicedesk_reports.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result,
      })
      return result
    }

    case ServicedeskReportsJob.GenerateReport: {
      const payload = job.data as {
        workspaceId: string
        reportId?: string
        requestedById?: string
        periodStart?: string
        periodEnd?: string
        recipients?: string[]
      }
      const result = await SdReportRunner.generateFromJob(payload)
      if (!result.ok) {
        logger.error('queue.servicedesk_reports.generate_failed', {
          component: 'Worker',
          jobId: job.id,
          workspaceId: payload.workspaceId,
          reportId: payload.reportId ?? null,
          code: result.error.code,
          message: result.error.message,
        })
        throw new Error(
          `ServiceDesk report generation failed: ${result.error.code}`,
        )
      }
      logger.info('queue.servicedesk_reports.generated', {
        component: 'Worker',
        jobId: job.id,
        workspaceId: payload.workspaceId,
        reportId: payload.reportId ?? null,
        runId: result.value.id,
        status: result.value.status,
      })
      return result.value
    }

    default:
      throw new Error(
        `Unknown servicedesk-reports job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
