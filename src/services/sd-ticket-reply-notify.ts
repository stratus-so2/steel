import { logger } from '@/lib/axiom/logger'
import { sdNotifyTicketOf } from '@/src/lib/servicedesk/notify'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import { notifySdEvent } from './sd-notification.service'
import { SdTicketEngine, sdTicketCode } from './sd-ticket-engine'

/**
 * Message that arrived on an existing ticket from outside the platform
 * (customer e-mail, WhatsApp, a Slack thread reply, a GitHub state change).
 * The team is told through the catalog event `ticket.message`, so the SD
 * preferences and channels apply.
 *
 * The notified audience is only the team (assignee, participants and
 * followers): the requester and the contact are stripped from the notify
 * ticket so the customer never gets an echo of their own message.
 */

export type SdTicketReplyChannel =
  | 'EMAIL'
  | 'WHATSAPP'
  | 'SLACK'
  | 'GITHUB'
  | 'GITLAB'

const PREVIEW_LENGTH = 140

const TITLES: Record<SdTicketReplyChannel, (code: string) => string> = {
  EMAIL: (code) => `Cliente respondeu ${code} por e-mail`,
  WHATSAPP: (code) => `Cliente respondeu ${code} pelo WhatsApp`,
  SLACK: (code) => `Nova resposta no Slack em ${code}`,
  GITHUB: (code) => `Atualização do GitHub em ${code}`,
  GITLAB: (code) => `Atualização do GitLab em ${code}`,
}

export function sdReplyPreview(body: string, attachments = 0): string {
  const text = body.replace(/\s+/g, ' ').trim()
  if (!text)
    return attachments > 0 ? `${attachments} anexo(s)` : 'Nova mensagem'
  return text.length > PREVIEW_LENGTH
    ? `${text.slice(0, PREVIEW_LENGTH - 1)}…`
    : text
}

export interface SdTicketReplyNotifyInput {
  workspaceId: string
  /** The loaded ticket, or only its id (the helper loads it). */
  ticket: SdTicketWithRelations | { id: string }
  channel: SdTicketReplyChannel
  /** Platform user that wrote the message, if any — never notified. */
  actorId?: string | null
  body: string
  attachments?: number
}

/**
 * Tells the team about an inbound reply. Never throws and never fails the
 * caller: every problem is only logged.
 */
export async function notifySdTicketReply(
  input: SdTicketReplyNotifyInput,
): Promise<void> {
  const log = (reason: string) =>
    logger.warn('servicedesk.reply.notify_failed', {
      workspaceId: input.workspaceId,
      ticketId: input.ticket.id,
      channel: input.channel,
      reason,
    })

  let ticket: SdTicketWithRelations
  if ('number' in input.ticket) ticket = input.ticket
  else {
    const found = await SdTicketRepository.findById(
      input.ticket.id,
      input.workspaceId,
    )
    if (!found.ok) return log(found.error.code)
    ticket = found.value
  }

  const config = await SdTicketEngine.loadConfig(input.workspaceId)
  if (!config.ok) return log(config.error.code)
  const code = sdTicketCode(ticket, config.value.prefixes)

  const sent = await notifySdEvent({
    workspaceId: input.workspaceId,
    event: 'ticket.message',
    ticket: {
      ...sdNotifyTicketOf(ticket, code),
      requesterId: null,
      contact: null,
    },
    actorId: input.actorId ?? null,
    payload: {
      title: TITLES[input.channel](code),
      body: sdReplyPreview(input.body, input.attachments ?? 0),
      meta: { channel: input.channel },
    },
  })
  if (!sent.ok) log(sent.error.code)
}
