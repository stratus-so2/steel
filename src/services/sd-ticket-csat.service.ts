import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdCsatAlreadySubmitted,
  sdCsatNotAvailable,
  sdTicketForbidden,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { SdTicketCsatRepository } from '@/src/repositories/sd-ticket-csat.repository'
import type { SubmitSdTicketCsatDTO } from '@/src/schemas/sd-ticket-csat.schema'
import type { SdTicketCsatDTO } from '@/types/sd-dashboard'
import { SdAccess } from './sd-access'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { canViewSdTicket } from './sd-ticket-visibility'

const DONE = new Set(['RESOLVED', 'CLOSED'])

/**
 * Avaliação do atendimento (CSAT) pelo solicitante, no portal: 1–5 estrelas
 * e comentário. Regras: só quem abriu o chamado (solicitante ou o usuário do
 * contato vinculado), só depois de resolvido/fechado e uma única vez. Gera
 * evento de rastreabilidade (`csat.submitted`), aviso em tempo real e
 * auditoria (a nota é dado do atendimento; o comentário não vai para log).
 */
export const SdTicketCsatService = {
  async submit(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: SubmitSdTicketCsatDTO,
  ): Promise<Result<SdTicketCsatDTO>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'EDIT',
    })
    if (!ctx.ok) return ctx

    const config = await SdTicketEngine.loadConfig(workspaceId)
    if (!config.ok) return config

    const ticket = await SdTicketEngine.resolveRef(
      workspaceId,
      ticketRef,
      config.value.prefixes,
    )
    if (!ticket.ok) return ticket
    const t = ticket.value

    const isRequester =
      t.requesterId === actorId || t.contact?.userId === actorId
    if (!isRequester) {
      return err(
        canViewSdTicket(ctx.value, t)
          ? sdTicketForbidden('Só o solicitante avalia o atendimento')
          : sdTicketForbidden(),
      )
    }
    if (!DONE.has(t.phase.category)) return err(sdCsatNotAvailable())
    if (t.csatScore !== null) return err(sdCsatAlreadySubmitted())

    const comment = dto.comment?.trim() || null
    const written = await SdTicketCsatRepository.submit(
      t.id,
      workspaceId,
      dto.score,
      comment,
    )
    if (!written.ok) {
      auditMutation({
        entity: 'sd_ticket_csat',
        action: 'create',
        actorId,
        targetId: t.id,
        outcome: 'failure',
        reason: written.error.code,
        meta: { workspaceId },
      })
      return written
    }
    if (!written.value) return err(sdCsatAlreadySubmitted())

    await recordSdTicketEvent({
      workspaceId,
      ticketId: t.id,
      actorKind: 'REQUESTER',
      actorUserId: actorId,
      action: 'csat.submitted',
      field: 'csatScore',
      fromValue: null,
      toValue: dto.score,
      meta: { hasComment: comment !== null },
    })
    await publishSdTicketEvent(
      workspaceId,
      {
        type: 'ticket.updated',
        ticketId: t.id,
        number: t.number,
        at: new Date().toISOString(),
        actorId,
      },
      {
        requesterId: t.requesterId,
        participantIds: t.participants.map((p) => p.userId),
        contactUserId: t.contact?.userId ?? null,
      },
    )
    auditMutation({
      entity: 'sd_ticket_csat',
      action: 'create',
      actorId,
      targetId: t.id,
      meta: { workspaceId, score: dto.score },
    })
    logger.info('servicedesk.csat.submitted', {
      workspaceId,
      ticketId: t.id,
      score: dto.score,
    })

    return ok({
      ticketId: t.id,
      number: t.number,
      csatScore: dto.score,
      csatComment: comment,
    })
  },
}
