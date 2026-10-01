import { logger } from '@/lib/axiom/logger'
import { ServicedeskMailJob } from '@/src/lib/queue/jobs'
import { getServicedeskMailQueue } from '@/src/lib/queue/queues'

/**
 * Enfileiramento do canal de e-mail (fila `servicedesk-mail`). Nunca lança:
 * o tick de 1 min lê a caixa de todo jeito — isto só adianta a primeira
 * leitura de uma caixa recém-cadastrada.
 */
export async function enqueueSdMailboxSync(mailboxId: string): Promise<void> {
  try {
    await getServicedeskMailQueue().add(
      ServicedeskMailJob.SyncMailbox,
      { mailboxId },
      { jobId: `mailbox-sync-${mailboxId}-${Date.now()}` },
    )
  } catch (error) {
    logger.error('servicedesk.mail.enqueue_failed', {
      job: ServicedeskMailJob.SyncMailbox,
      mailboxId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
