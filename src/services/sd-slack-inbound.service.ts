import type { SdIntegration } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import {
  sdIntegrationNotConfigured,
  sdIntegrationSignatureInvalid,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  parseSdSlackConfig,
  type SdSlackConfig,
  sdSlackReplyBody,
  sdSlackThreadKey,
  sdSlackTicketBody,
  sdSlackTicketOpenedText,
  sdSlackTicketTitle,
  verifySlackSignature,
} from '@/src/lib/servicedesk/integrations'
import { sdTicketNotificationHref } from '@/src/lib/servicedesk/notify'
import {
  getSlackAppConfig,
  SlackClient,
} from '@/src/lib/servicedesk/slack-client'
import { SdIntegrationRepository } from '@/src/repositories/sd-integration.repository'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { assertModuleEnabled } from './authz'
import { fireSdAutomations } from './sd-automation-engine'
import { decryptSdIntegrationToken } from './sd-integration-credentials'
import {
  type SdEngineConfig,
  SdTicketEngine,
  sdSystemActor,
  sdTicketCode,
} from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'

/**
 * Entrada pública do Slack (`POST /api/servicedesk/integrations/slack`) —
 * um único endpoint para os três tipos de requisição do Slack:
 *
 * 1. **url_verification** (JSON): responde o `challenge` do painel do app;
 * 2. **event_callback** (JSON): resposta na thread de um chamado vira
 *    mensagem **pública** no histórico;
 * 3. **atalho de mensagem / slash command** (`x-www-form-urlencoded`): abre
 *    o chamado a partir da mensagem e responde na thread com o código e o
 *    link.
 *
 * Toda requisição é verificada por assinatura (`X-Slack-Signature` +
 * `X-Slack-Request-Timestamp`, HMAC em tempo constante, timestamp velho
 * recusado) **antes** de o corpo ser interpretado, e é idempotente por
 * `event_id`/`trigger_id`: o Slack reentrega.
 */

const SOURCE = 'slack'

export type SdSlackInboundOutcome =
  | 'challenge'
  | 'ticket_created'
  | 'message_mirrored'
  | 'duplicate'
  | 'ignored'

export interface SdSlackInboundResult {
  outcome: SdSlackInboundOutcome
  /** Só em `challenge`: o valor que o Slack espera de volta. */
  challenge?: string
  ticketCode?: string
}

export interface SdSlackInboundInput {
  rawBody: string
  signature: string | null
  timestamp: string | null
  contentType: string | null
  now?: number
}

interface SlackEventEnvelope {
  type?: string
  challenge?: string
  team_id?: string
  event_id?: string
  event?: {
    type?: string
    subtype?: string
    channel?: string
    channel_type?: string
    user?: string
    bot_id?: string
    text?: string
    ts?: string
    thread_ts?: string
  }
}

interface SlackShortcut {
  type?: string
  callback_id?: string
  trigger_id?: string
  team?: { id?: string }
  user?: { id?: string }
  channel?: { id?: string; name?: string }
  message?: { ts?: string; text?: string; user?: string }
}

interface SlackCommand {
  teamId: string
  channelId: string
  channelName: string | null
  userId: string | null
  text: string
  triggerId: string
}

/** Pedido já reconhecido, pronto para ser roteado. */
type SlackRequest =
  | { kind: 'challenge'; challenge: string }
  | { kind: 'event'; envelope: SlackEventEnvelope }
  | {
      kind: 'message_action'
      teamId: string
      eventId: string
      channelId: string
      channelName: string | null
      messageTs: string
      messageText: string
      authorSlackId: string | null
    }
  | { kind: 'command'; command: SlackCommand }
  | { kind: 'ignored' }

function parseJsonBody(rawBody: string): SlackEventEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(rawBody)
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as SlackEventEnvelope)
      : null
  } catch {
    return null
  }
}

/** Reconhece o formato do corpo (JSON de eventos × formulário do Slack). */
function parseSlackRequest(input: SdSlackInboundInput): SlackRequest | null {
  const isForm = (input.contentType ?? '').includes(
    'application/x-www-form-urlencoded',
  )

  if (!isForm) {
    const envelope = parseJsonBody(input.rawBody)
    if (!envelope) return null
    if (envelope.type === 'url_verification') {
      return envelope.challenge
        ? { kind: 'challenge', challenge: envelope.challenge }
        : null
    }
    if (envelope.type === 'event_callback') return { kind: 'event', envelope }
    return { kind: 'ignored' }
  }

  const form = new URLSearchParams(input.rawBody)
  const payload = form.get('payload')
  if (payload) {
    let shortcut: SlackShortcut
    try {
      shortcut = JSON.parse(payload) as SlackShortcut
    } catch {
      return null
    }
    if (shortcut.type !== 'message_action') return { kind: 'ignored' }
    const teamId = shortcut.team?.id
    const channelId = shortcut.channel?.id
    const messageTs = shortcut.message?.ts
    if (!teamId || !channelId || !messageTs) return null
    return {
      kind: 'message_action',
      teamId,
      eventId: shortcut.trigger_id || `${channelId}:${messageTs}`,
      channelId,
      channelName: shortcut.channel?.name ?? null,
      messageTs,
      messageText: shortcut.message?.text ?? '',
      authorSlackId: shortcut.message?.user ?? shortcut.user?.id ?? null,
    }
  }

  const teamId = form.get('team_id')
  const channelId = form.get('channel_id')
  if (!teamId || !channelId) return null
  const text = form.get('text') ?? ''
  return {
    kind: 'command',
    command: {
      teamId,
      channelId,
      channelName: form.get('channel_name'),
      userId: form.get('user_id'),
      text,
      // Sem `trigger_id`, a chave de idempotência é o canal + o texto.
      triggerId: form.get('trigger_id') || `${channelId}:${text}`,
    },
  }
}

async function resolveIntegration(
  teamId: string,
): Promise<Result<{ integration: SdIntegration; config: SdSlackConfig }>> {
  const found = await SdIntegrationRepository.findByExternalId('SLACK', teamId)
  if (!found.ok) return found
  if (!found.value || found.value.status === 'DISCONNECTED') {
    return err(
      sdIntegrationNotConfigured(
        'Este workspace do Slack não está conectado a nenhum ServiceDesk',
      ),
    )
  }
  const enabled = await assertModuleEnabled(
    found.value.workspaceId,
    'SERVICE_DESK',
  )
  if (!enabled.ok) return enabled
  return ok({
    integration: found.value,
    config: parseSdSlackConfig(found.value.config),
  })
}

async function ticketHref(
  workspaceId: string,
  number: number,
): Promise<string> {
  const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
  const slug = workspace.ok ? (workspace.value?.slug ?? null) : null
  return slug
    ? `${NEXT_PUBLIC_URL}${sdTicketNotificationHref(slug, number)}`
    : NEXT_PUBLIC_URL
}

/** Abre o chamado com os padrões da integração e ator de sistema. */
async function openTicket(
  integration: SdIntegration,
  config: SdSlackConfig,
  engine: SdEngineConfig,
  input: { title: string; body: string },
): Promise<Result<SdTicketWithRelations>> {
  return SdTicketEngine.create(
    integration.workspaceId,
    {
      type: config.ticketType,
      title: input.title,
      description: input.body,
      channel: 'API',
      ...(config.departmentId ? { departmentId: config.departmentId } : {}),
    },
    sdSystemActor(SOURCE),
    engine,
  )
}

/**
 * Chamado a partir de uma mensagem (atalho) ou do texto do slash command:
 * abre, responde na thread com o código e o link e grava o vínculo
 * `SLACK_THREAD` — é ele que faz as respostas da thread voltarem ao chamado.
 */
async function createTicketFromSlack(
  integration: SdIntegration,
  config: SdSlackConfig,
  input: {
    channelId: string
    channelName: string | null
    text: string
    authorSlackId: string | null
    /** `ts` da mensagem original (atalho). Ausente no slash command. */
    messageTs?: string
  },
): Promise<Result<SdSlackInboundResult>> {
  if (!config.allowTicketFromMessage) return ok({ outcome: 'ignored' })

  const token = await decryptSdIntegrationToken(integration)
  if (!token.ok) return token

  const author = input.authorSlackId
    ? await SlackClient.getUser(token.value, input.authorSlackId)
    : null
  const authorName = author?.ok ? author.value.name : 'usuário do Slack'

  const permalink = input.messageTs
    ? await SlackClient.permalink(token.value, {
        channel: input.channelId,
        ts: input.messageTs,
      })
    : null

  const engine = await SdTicketEngine.loadConfig(integration.workspaceId)
  if (!engine.ok) return engine

  const created = await openTicket(integration, config, engine.value, {
    title: sdSlackTicketTitle(input.text),
    body: sdSlackTicketBody({
      text: input.text,
      authorName,
      channelName: input.channelName,
      permalink,
    }),
  })
  if (!created.ok) return created

  const ticket = created.value
  const code = sdTicketCode(ticket, engine.value.prefixes)
  const url = await ticketHref(integration.workspaceId, ticket.number)

  // Resposta na thread da mensagem original (atalho) ou mensagem nova no
  // canal (slash command) — nos dois casos o `ts` da resposta vira a raiz
  // da thread espelhada quando não havia mensagem original.
  const replied = await SlackClient.postMessage(token.value, {
    channel: input.channelId,
    text: sdSlackTicketOpenedText({ ticketCode: code, url }),
    ...(input.messageTs ? { threadTs: input.messageTs } : {}),
  })

  const threadTs =
    input.messageTs ??
    (replied.ok && replied.value.ts !== '' ? replied.value.ts : null)

  if (threadTs) {
    const link = await SdIntegrationRepository.createLink({
      workspaceId: integration.workspaceId,
      integrationId: integration.id,
      ticketId: ticket.id,
      kind: 'SLACK_THREAD',
      externalKey: sdSlackThreadKey(input.channelId, threadTs),
      externalUrl: permalink,
      meta: { channelName: input.channelName, authorName },
    })
    if (!link.ok) {
      logger.warn('servicedesk.slack.thread_link_failed', {
        workspaceId: integration.workspaceId,
        ticketId: ticket.id,
        reason: link.error.code,
      })
    }
  }

  await recordSdTicketEvent({
    workspaceId: integration.workspaceId,
    ticketId: ticket.id,
    actorKind: 'SYSTEM',
    actorUserId: null,
    action: 'integration.ticket_from_slack',
    meta: { channel: input.channelId, authorName },
  })

  logger.info('servicedesk.slack.ticket_created', {
    workspaceId: integration.workspaceId,
    ticketId: ticket.id,
    channel: input.channelId,
  })

  return ok({ outcome: 'ticket_created', ticketCode: code })
}

/** Resposta na thread → mensagem pública no histórico do chamado. */
async function mirrorThreadReply(
  integration: SdIntegration,
  config: SdSlackConfig,
  event: NonNullable<SlackEventEnvelope['event']>,
): Promise<Result<SdSlackInboundResult>> {
  if (!config.mirrorThreadReplies) return ok({ outcome: 'ignored' })

  const channel = event.channel
  const threadTs = event.thread_ts
  const ts = event.ts
  // Só respostas de pessoa dentro de uma thread: a própria mensagem-raiz, os
  // avisos do bot e os eventos de edição/remoção não entram no histórico.
  if (!channel || !threadTs || !ts || threadTs === ts) {
    return ok({ outcome: 'ignored' })
  }
  if (event.bot_id || event.subtype || !event.user) {
    return ok({ outcome: 'ignored' })
  }

  const link = await SdIntegrationRepository.findSlackThread(
    integration.id,
    sdSlackThreadKey(channel, threadTs),
  )
  if (!link.ok) return link
  if (!link.value) return ok({ outcome: 'ignored' })

  const token = await decryptSdIntegrationToken(integration)
  if (!token.ok) return token

  const author = await SlackClient.getUser(token.value, event.user)
  if (author.ok && author.value.isBot) return ok({ outcome: 'ignored' })

  const authorName = author.ok ? author.value.name : 'usuário do Slack'
  const email = author.ok ? author.value.email : null
  let authorUserId: string | null = null
  if (email) {
    const matched = await SdIntegrationRepository.findWorkspaceUserByEmail(
      integration.workspaceId,
      email,
    )
    if (matched.ok) authorUserId = matched.value?.id ?? null
  }

  const created = await SdIntegrationRepository.createTicketMessage({
    workspaceId: integration.workspaceId,
    ticketId: link.value.ticketId,
    // Sem conta na plataforma, o autor fica registrado como externo (ator de
    // sistema) com o nome no corpo — mesma saída do e-mail e do WhatsApp.
    authorKind: authorUserId ? 'AGENT' : 'SYSTEM',
    authorUserId,
    body: sdSlackReplyBody({
      text: event.text ?? '',
      authorName,
      identified: authorUserId !== null,
    }),
  })
  if (!created.ok) return created

  await SdTicketEngine.touchActivity(link.value.ticketId)
  await recordSdTicketEvent({
    workspaceId: integration.workspaceId,
    ticketId: link.value.ticketId,
    actorKind: authorUserId ? 'AGENT' : 'SYSTEM',
    actorUserId: authorUserId,
    action: 'message.posted',
    meta: {
      messageId: created.value.id,
      channel: 'SLACK',
      visibility: 'PUBLIC',
      authorName,
    },
  })
  void fireSdAutomations('MESSAGE_RECEIVED', link.value.ticketId)

  logger.info('servicedesk.slack.reply_mirrored', {
    workspaceId: integration.workspaceId,
    ticketId: link.value.ticketId,
    identified: authorUserId !== null,
  })

  return ok({ outcome: 'message_mirrored' })
}

export const SdSlackInboundService = {
  async handle(
    input: SdSlackInboundInput,
  ): Promise<Result<SdSlackInboundResult>> {
    const app = getSlackAppConfig()
    if (!app) {
      return err(
        sdIntegrationNotConfigured(
          'O app do Slack não está configurado neste servidor',
        ),
      )
    }

    const signature = verifySlackSignature({
      signingSecret: app.signingSecret,
      timestamp: input.timestamp,
      signature: input.signature,
      rawBody: input.rawBody,
      now: input.now,
    })
    if (signature !== 'valid') {
      return err(
        sdIntegrationSignatureInvalid(
          signature === 'stale'
            ? 'Requisição do Slack fora da janela de 5 minutos'
            : 'Assinatura do Slack inválida',
        ),
      )
    }

    const request = parseSlackRequest(input)
    if (!request) return err(validationError('Corpo do Slack inválido'))
    if (request.kind === 'ignored') return ok({ outcome: 'ignored' })
    if (request.kind === 'challenge') {
      return ok({ outcome: 'challenge', challenge: request.challenge })
    }

    if (request.kind === 'event') {
      const envelope = request.envelope
      const teamId = envelope.team_id
      const event = envelope.event
      if (!teamId || !event || event.type !== 'message') {
        return ok({ outcome: 'ignored' })
      }
      const resolved = await resolveIntegration(teamId)
      if (!resolved.ok) return resolved

      const eventId = envelope.event_id ?? `${event.channel}:${event.ts}`
      const first = await SdIntegrationEventCache.claim('slack', eventId)
      if (!first) return ok({ outcome: 'duplicate' })

      const mirrored = await mirrorThreadReply(
        resolved.value.integration,
        resolved.value.config,
        event,
      )
      if (!mirrored.ok) await SdIntegrationEventCache.release('slack', eventId)
      return mirrored
    }

    if (request.kind === 'message_action') {
      const resolved = await resolveIntegration(request.teamId)
      if (!resolved.ok) return resolved

      const first = await SdIntegrationEventCache.claim(
        'slack',
        request.eventId,
      )
      if (!first) return ok({ outcome: 'duplicate' })

      const created = await createTicketFromSlack(
        resolved.value.integration,
        resolved.value.config,
        {
          channelId: request.channelId,
          channelName: request.channelName,
          text: request.messageText,
          authorSlackId: request.authorSlackId,
          messageTs: request.messageTs,
        },
      )
      if (!created.ok) {
        await SdIntegrationEventCache.release('slack', request.eventId)
      }
      return created
    }

    const { command } = request
    const resolved = await resolveIntegration(command.teamId)
    if (!resolved.ok) return resolved

    const first = await SdIntegrationEventCache.claim(
      'slack',
      command.triggerId,
    )
    if (!first) return ok({ outcome: 'duplicate' })

    const created = await createTicketFromSlack(
      resolved.value.integration,
      resolved.value.config,
      {
        channelId: command.channelId,
        channelName: command.channelName,
        text: command.text,
        authorSlackId: command.userId,
      },
    )
    if (!created.ok) {
      await SdIntegrationEventCache.release('slack', command.triggerId)
    }
    return created
  },
}
