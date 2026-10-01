import type { SdSettings } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { ServicedeskAiJob } from '@/src/lib/queue/jobs'
import { getServicedeskAiQueue } from '@/src/lib/queue/queues'

/**
 * Enfileiramento da IA do ServiceDesk (fila `servicedesk-ai`). Nunca lança:
 * a IA é acessória — falha ao enfileirar só é logada e o fluxo segue.
 */

/**
 * Triagem automática de um chamado recém-aberto. Chamado pelo motor
 * (`SdTicketEngine.create`) — o único ponto por onde passam todas as
 * aberturas (agente, portal, WhatsApp, IA, automação) —, só quando a IA e
 * a triagem estão ligadas. `jobId` fixo: um chamado é triado uma vez.
 */
export async function enqueueSdAiTriage(
  settings: Pick<SdSettings, 'aiEnabled' | 'aiAutoTriageEnabled'>,
  ticketId: string,
): Promise<void> {
  if (!settings.aiEnabled || !settings.aiAutoTriageEnabled) return
  try {
    await getServicedeskAiQueue().add(
      ServicedeskAiJob.TriageTicket,
      { ticketId },
      { jobId: `triage-${ticketId}` },
    )
  } catch (error) {
    logger.error('servicedesk.ai.enqueue_failed', {
      job: ServicedeskAiJob.TriageTicket,
      ticketId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Resposta da IA a uma mensagem recebida no WhatsApp do ServiceDesk. */
export async function enqueueSdAiWhatsappReply(
  conversationId: string,
  messageId: string,
): Promise<void> {
  try {
    await getServicedeskAiQueue().add(
      ServicedeskAiJob.WhatsappReply,
      { conversationId, messageId },
      { jobId: `wa-reply-${messageId}` },
    )
  } catch (error) {
    logger.error('servicedesk.ai.enqueue_failed', {
      job: ServicedeskAiJob.WhatsappReply,
      conversationId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
