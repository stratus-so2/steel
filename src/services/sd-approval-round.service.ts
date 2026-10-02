import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdApprovalRoundClosed,
  sdApprovalRoundNotFound,
  sdCabBoardNotFound,
  sdCabQuorumInvalid,
} from '@/src/errors'
import { sendSdApprovalRequestEmail } from '@/src/lib/mail/servicedesk/send-sd-approval-request'
import { err, ok, type Result } from '@/src/lib/result'
import { sdNotifyTicketOf } from '@/src/lib/servicedesk/notify'
import {
  sdApprovalRoundOutcome,
  toSdApprovalRoundDTO,
} from '@/src/mappers/sd-approval-round.mapper'
import { sdEffectiveQuorum } from '@/src/mappers/sd-cab-board.mapper'
import {
  type SdApprovalRoundMemberData,
  SdApprovalRoundRepository,
  type SdApprovalRoundWithRelations,
} from '@/src/repositories/sd-approval-round.repository'
import { SdCabBoardRepository } from '@/src/repositories/sd-cab-board.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type { OpenSdApprovalRoundDTO } from '@/src/schemas/sd-approval-round.schema'
import type { SdApprovalRoundDTO } from '@/types/sd-cab'
import { selectSdCabBoard } from './sd-cab-board.service'
import { notifySdEvent, type SdNotifyInput } from './sd-notification.service'
import { newSdApprovalToken, sdApprovalUrl } from './sd-ticket-approval.service'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { sdTicketRowFacts } from './sd-ticket-rules'
import {
  loadSdTicketTab,
  publishSdTicketTab,
  type SdTicketTabScope,
} from './sd-ticket-tab-support'

/**
 * Rodadas de aprovação do comitê de mudanças (CAB).
 *
 * Abrir uma rodada dispara **um `SdTicketApproval` por membro** do comitê
 * (mesmo link público por e-mail do pedido avulso) e guarda o quórum aplicado.
 * A cada resposta a rodada é reavaliada: fecha em `APPROVED` ao bater o quórum
 * (desde que todo membro `required` já tenha votado), em `REJECTED` na
 * primeira reprovação quando `rejectEnds`, e os pedidos que sobram são
 * cancelados. Expiração é **lazy**, como no pedido avulso: ao listar, a rodada
 * cujos pedidos todos venceram vira `EXPIRED`.
 *
 * O comitê vem do `boardId` informado ou da seleção por condições
 * (`selectSdCabBoard`) entre os comitês ativos, na ordem de `position`.
 */

const DAY_MS = 24 * 60 * 60 * 1000

const EXPIRES_FORMAT = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

/** Notificar nunca derruba o fluxo da rodada: falha vira log. */
async function notifyRound(input: SdNotifyInput): Promise<void> {
  const sent = await notifySdEvent(input)
  if (!sent.ok) {
    logger.warn('servicedesk.approval_round.notify_failed', {
      workspaceId: input.workspaceId,
      ticketId: input.ticket.id,
      event: input.event,
      reason: sent.error.code,
    })
  }
}

async function lazyExpire(ticketId: string): Promise<void> {
  const expired = await SdApprovalRoundRepository.expireOverdue(
    ticketId,
    new Date(),
  )
  if (!expired.ok) {
    logger.warn('servicedesk.approval_round.expire_failed', {
      ticketId,
      reason: expired.error.code,
    })
  }
}

interface RoundMailContext {
  workspaceName: string
  requestedByName: string
  ticketCode: string
  ticketTitle: string
}

async function mailContext(scope: SdTicketTabScope): Promise<RoundMailContext> {
  const [users, workspace] = await Promise.all([
    SdTicketContextRepository.findUserNames([scope.ctx.userId]),
    SdTicketContextRepository.findWorkspace(scope.ticket.workspaceId),
  ])
  return {
    workspaceName:
      (workspace.ok ? workspace.value?.name : undefined) ?? 'Steel',
    requestedByName:
      (users.ok ? users.value.get(scope.ctx.userId)?.name : undefined) ??
      'Um agente',
    ticketCode: scope.code,
    ticketTitle: scope.ticket.title,
  }
}

/** Envia o e-mail do voto. Falha de envio nunca derruba a rodada. */
async function sendVoteEmail(
  mail: RoundMailContext,
  approval: { id: string; approverEmail: string; approverName: string | null },
  message: string | null,
  expiresAt: Date,
  token: string,
): Promise<boolean> {
  const url = sdApprovalUrl(token)
  try {
    await sendSdApprovalRequestEmail({
      email: approval.approverEmail,
      approverName: approval.approverName,
      workspaceName: mail.workspaceName,
      ticketCode: mail.ticketCode,
      ticketTitle: mail.ticketTitle,
      requestedByName: mail.requestedByName,
      message,
      expiresAtLabel: EXPIRES_FORMAT.format(expiresAt),
      approveUrl: `${url}?decision=APPROVED`,
      rejectUrl: `${url}?decision=REJECTED`,
      reviewUrl: url,
    })
    return true
  } catch (error) {
    logger.warn('servicedesk.approval_round.email_failed', {
      approvalId: approval.id,
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Fecha a rodada se ela já tem tudo para decidir, cancelando os pedidos que
 * sobraram. Devolve o status final ou `null` se segue aberta.
 */
export async function settleSdApprovalRound(
  round: SdApprovalRoundWithRelations,
): Promise<Result<'APPROVED' | 'REJECTED' | null>> {
  if (round.status !== 'PENDING') return ok(null)
  const outcome = sdApprovalRoundOutcome(round)
  if (!outcome) return ok(null)

  const closed = await SdApprovalRoundRepository.close(
    round.id,
    outcome,
    new Date(),
  )
  if (!closed.ok) return closed
  if (!closed.value) return ok(null)

  const canceled = await SdApprovalRoundRepository.cancelPendingApprovals(
    round.id,
  )
  if (!canceled.ok) return canceled

  await recordSdTicketEvent({
    workspaceId: round.workspaceId,
    ticketId: round.ticketId,
    actorKind: 'SYSTEM',
    action: 'approval_round.closed',
    field: 'approvalRound',
    fromValue: 'PENDING',
    toValue: outcome,
    meta: {
      roundId: round.id,
      boardId: round.boardId,
      quorum: round.quorum,
      canceled: canceled.value,
    },
  })
  logger.info('servicedesk.approval_round.closed', {
    workspaceId: round.workspaceId,
    ticketId: round.ticketId,
    roundId: round.id,
    outcome,
  })
  return ok(outcome)
}

/**
 * Gancho da resposta de um pedido: se o pedido pertence a uma rodada,
 * reavalia o quórum. Chamado pelo link público depois de gravar o voto;
 * nunca derruba a resposta (falha só é logada).
 */
export async function registerSdRoundVote(approvalId: string): Promise<void> {
  const round = await SdApprovalRoundRepository.findByApprovalId(approvalId)
  if (!round.ok) {
    logger.warn('servicedesk.approval_round.vote_lookup_failed', {
      approvalId,
      reason: round.error.code,
    })
    return
  }
  if (!round.value) return
  const settled = await settleSdApprovalRound(round.value)
  if (!settled.ok) {
    logger.warn('servicedesk.approval_round.settle_failed', {
      approvalId,
      roundId: round.value.id,
      reason: settled.error.code,
    })
  }
}

export const SdApprovalRoundService = {
  /** Rodadas do chamado, da mais recente para a mais antiga. */
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdApprovalRoundDTO[]>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    await lazyExpire(scope.value.ticket.id)
    const rows = await SdApprovalRoundRepository.listByTicket(
      scope.value.ticket.id,
    )
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdApprovalRoundDTO))
  },

  /**
   * Abre uma rodada: escolhe o comitê, dispara um pedido por membro e manda
   * os e-mails. Recusa uma segunda rodada aberta no mesmo chamado.
   */
  async open(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: OpenSdApprovalRoundDTO,
  ): Promise<Result<SdApprovalRoundDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const scope = loaded.value
    const { ticket } = scope

    await lazyExpire(ticket.id)
    const open = await SdApprovalRoundRepository.findOpenByTicket(ticket.id)
    if (!open.ok) return open
    if (open.value) {
      return err(
        sdApprovalRoundClosed(
          'Já existe uma rodada de aprovação em andamento neste chamado',
        ),
      )
    }

    const boards = await SdCabBoardRepository.list(workspaceId)
    if (!boards.ok) return boards
    const board = dto.boardId
      ? (boards.value.find((b) => b.id === dto.boardId) ?? null)
      : selectSdCabBoard(boards.value, sdTicketRowFacts(ticket))
    if (!board) {
      return err(
        dto.boardId
          ? sdCabBoardNotFound()
          : {
              ...sdCabBoardNotFound(),
              message:
                'Nenhum comitê de mudanças ativo atende a este chamado: ajuste as condições em Configurações › Mudanças',
            },
      )
    }
    if (board.members.length === 0) {
      return err(sdCabQuorumInvalid('O comitê escolhido não tem membros'))
    }

    const emails = await SdTicketContextRepository.findUserNames(
      board.members.map((m) => m.userId),
    )
    if (!emails.ok) return emails
    const members: SdApprovalRoundMemberData[] = []
    const tokens = new Map<string, string>()
    for (const member of board.members) {
      const user = emails.value.get(member.userId)
      if (!user?.email) continue
      const { token, hash } = newSdApprovalToken()
      tokens.set(hash, token)
      members.push({
        approverName: user.name,
        approverEmail: user.email.toLowerCase(),
        approverUserId: member.userId,
        tokenHash: hash,
        required: member.required,
      })
    }
    if (members.length === 0) {
      return err(
        sdCabQuorumInvalid('Nenhum membro do comitê tem e-mail cadastrado'),
      )
    }

    const quorum = sdEffectiveQuorum(board.quorum, members.length)
    const expiresAt = new Date(Date.now() + dto.expiresInDays * DAY_MS)
    const created = await SdApprovalRoundRepository.open({
      workspaceId,
      ticketId: ticket.id,
      boardId: board.id,
      quorum,
      rejectEnds: board.rejectEnds,
      requestedById: actorId,
      message: dto.message ?? null,
      expiresAt,
      members,
    })
    if (!created.ok) return created

    const mail = await mailContext(scope)
    let sent = 0
    for (const approval of created.value.approvals) {
      const token = tokens.get(approval.tokenHash)
      if (!token) continue
      const delivered = await sendVoteEmail(
        mail,
        approval,
        dto.message ?? null,
        expiresAt,
        token,
      )
      if (delivered) sent += 1
    }

    await SdTicketEngine.touchActivity(ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'approval_round.opened',
      toValue: { id: created.value.id, label: board.name },
      meta: {
        roundId: created.value.id,
        boardId: board.id,
        quorum,
        rejectEnds: board.rejectEnds,
        members: members.length,
        sent,
        expiresAt: expiresAt.toISOString(),
      },
    })
    await notifyRound({
      workspaceId,
      event: 'approval.requested',
      ticket: sdNotifyTicketOf(ticket, scope.code),
      actorId,
      audience: 'payload',
      payload: {
        title: `O comitê ${board.name} precisa aprovar ${scope.code}`,
        body: dto.message?.trim() || ticket.title,
        userIds: members.map((m) => m.approverUserId),
      },
    })
    await publishSdTicketTab(ticket, 'ticket.approval', actorId, true)
    auditMutation({
      entity: 'sd_approval_round',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: {
        workspaceId,
        ticketId: ticket.id,
        boardId: board.id,
        quorum,
        members: members.length,
        sent,
      },
    })
    return ok(toSdApprovalRoundDTO(created.value))
  },

  /** Cancela a rodada aberta e os pedidos que ainda não responderam. */
  async cancel(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    roundId: string,
  ): Promise<Result<SdApprovalRoundDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value

    const existing = await SdApprovalRoundRepository.findById(
      roundId,
      ticket.id,
    )
    if (!existing.ok) return existing
    if (existing.value.status !== 'PENDING') return err(sdApprovalRoundClosed())

    const closed = await SdApprovalRoundRepository.close(
      roundId,
      'CANCELED',
      new Date(),
    )
    if (!closed.ok) return closed
    if (!closed.value) return err(sdApprovalRoundClosed())
    const canceled =
      await SdApprovalRoundRepository.cancelPendingApprovals(roundId)
    if (!canceled.ok) return canceled

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'approval_round.canceled',
      fromValue: {
        id: roundId,
        label: existing.value.board?.name ?? 'Comitê removido',
      },
      meta: { roundId, canceled: canceled.value },
    })
    await publishSdTicketTab(ticket, 'ticket.approval', actorId, true)
    auditMutation({
      entity: 'sd_approval_round',
      action: 'cancel',
      actorId,
      targetId: roundId,
      meta: { workspaceId, ticketId: ticket.id, canceled: canceled.value },
    })
    const after = await SdApprovalRoundRepository.findById(roundId, ticket.id)
    if (!after.ok) return err(sdApprovalRoundNotFound())
    return ok(toSdApprovalRoundDTO(after.value))
  },
}
