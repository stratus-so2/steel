import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { SdMailInboundService } from '@/src/services/sd-mail-inbound.service'
import type { SdMailboxSyncDTO } from '@/types/sd-mailbox'
import { ServicedeskMailJob } from '../jobs'

/**
 * Fila `servicedesk-mail` (1×/min, `ServicedeskMailCron`): lê as caixas de
 * e-mail ativas do ServiceDesk por IMAP e deixa o
 * `SdMailInboundService` abrir/atualizar os chamados. `sync-mailbox` é a
 * leitura de uma caixa só (botão "Ler agora" das configurações).
 */
export async function processServicedeskMail(
  job: Job,
): Promise<(SdMailboxSyncDTO & { mailboxes?: number }) | SdMailboxSyncDTO> {
  switch (job.name) {
    case ServicedeskMailJob.PollMailboxes: {
      const result = await SdMailInboundService.runTick()
      logger.info('queue.servicedesk_mail.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result,
      })
      return result
    }
    case ServicedeskMailJob.SyncMailbox: {
      const { mailboxId } = job.data as { mailboxId?: string }
      if (!mailboxId) {
        throw new Error(
          `servicedesk-mail sync-mailbox without mailboxId (id=${job.id ?? 'unknown'})`,
        )
      }
      const result = await SdMailInboundService.syncMailbox(mailboxId)
      if (!result.ok) {
        throw new Error(
          `Failed to sync ServiceDesk mailbox ${mailboxId}: ${result.error.code}`,
        )
      }
      logger.info('queue.servicedesk_mail.mailbox_synced', {
        component: 'Worker',
        jobId: job.id,
        mailboxId,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown servicedesk-mail job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
