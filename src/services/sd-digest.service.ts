import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import {
  SD_DIGEST_EVENT,
  SD_DIGEST_HOUR,
  sdNotificationEvent,
} from '@/src/config/servicedesk-notifications'
import { sendSdDailyDigestEmail } from '@/src/lib/mail/servicedesk/send-sd-daily-digest'
import { sdLocalHour, sdTicketNotificationHref } from '@/src/lib/servicedesk/notify'
import {
  formatSdTicketCode,
  resolveSdTicketPrefixes,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import {
  type SdDigestCounts,
  SdNotificationRepository,
} from '@/src/repositories/sd-notification.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { NotificationService } from './notification.service'

/**
 * Resumo diário do ServiceDesk (`servicedesk-digest`). Desligado por padrão:
 * só recebe quem marcou `digest.daily` na aba "Notificações". O tick roda de
 * hora em hora e cada workspace só é processado na hora local combinada
 * (`SD_DIGEST_HOUR`, fuso do calendário padrão) — como existe uma única hora
 * local assim por dia, o envio é naturalmente uma vez ao dia, sem carimbo de
 * controle. A fila usa `attempts: 1` justamente para que um retry não
 * reenvie.
 *
 * Nunca lança: erro de um workspace/usuário é contado e logado.
 */

/** Minutos antes do prazo em que o chamado já conta como "apertado". */
const RISK_WINDOW_MINUTES = 120
const MINUTE_MS = 60 * 1000

export interface SdDigestResult {
  /** Workspaces com o módulo habilitado. */
  workspaces: number
  /** Workspaces na hora local do resumo. */
  due: number
  /** Usuários que receberam ao menos um canal. */
  sent: number
  inApp: number
  email: number
  skipped: number
  errors: number
}

function emptyResult(): SdDigestResult {
  return {
    workspaces: 0,
    due: 0,
    sent: 0,
    inApp: 0,
    email: 0,
    skipped: 0,
    errors: 0,
  }
}

/** Frase do corpo da notificação in-app. */
export function sdDigestBody(counts: SdDigestCounts): string {
  const parts = [`${counts.queue} em aberto`]
  if (counts.atRisk > 0) parts.push(`${counts.atRisk} com prazo apertado`)
  if (counts.waiting > 0) parts.push(`${counts.waiting} aguardando resposta`)
  return `Sua fila hoje: ${parts.join(', ')}.`
}

async function digestFor(
  workspace: { id: string; name: string; slug: string },
  prefixes: SdTicketPrefixes,
  userId: string,
  channels: { inApp: boolean; email: boolean },
  now: Date,
  result: SdDigestResult,
): Promise<void> {
  const counts = await SdNotificationRepository.digestCounts(
    workspace.id,
    userId,
    new Date(now.getTime() + RISK_WINDOW_MINUTES * MINUTE_MS),
  )
  if (!counts.ok) {
    result.errors += 1
    logger.warn('servicedesk.digest.counts_failed', {
      workspaceId: workspace.id,
      reason: counts.error.code,
    })
    return
  }
  // Fila vazia não gera resumo — ninguém quer "você não tem nada".
  if (counts.value.queue === 0) {
    result.skipped += 1
    return
  }

  const spec = sdNotificationEvent(SD_DIGEST_EVENT)
  const queueHref = `/${workspace.slug}/servicedesk`
  let delivered = false

  if (channels.inApp && spec) {
    const created = await NotificationService.notifyUsers({
      workspaceId: workspace.id,
      userIds: [userId],
      kind: spec.kind,
      title: 'Resumo do ServiceDesk',
      body: sdDigestBody(counts.value),
      href: queueHref,
    })
    if (created.ok) {
      result.inApp += created.value
      delivered = true
    } else {
      result.errors += 1
      logger.warn('servicedesk.digest.in_app_failed', {
        workspaceId: workspace.id,
        reason: created.error.code,
      })
    }
  }

  if (channels.email) {
    const user = await SdNotificationRepository.findRecipients(workspace.id, [
      userId,
    ])
    const target = user.ok ? user.value[0] : undefined
    if (target) {
      try {
        await sendSdDailyDigestEmail({
          email: target.email,
          username: target.name,
          workspaceName: workspace.name,
          queue: counts.value.queue,
          atRisk: counts.value.atRisk,
          waiting: counts.value.waiting,
          highlights: counts.value.highlights.map((t) => ({
            code: formatSdTicketCode(t.type, t.number, prefixes),
            title: t.title,
            url: `${NEXT_PUBLIC_URL}${sdTicketNotificationHref(workspace.slug, t.number)}`,
          })),
          redirectUrl: `${NEXT_PUBLIC_URL}${queueHref}`,
        })
        result.email += 1
        delivered = true
      } catch (error) {
        result.errors += 1
        logger.warn('servicedesk.digest.email_failed', {
          workspaceId: workspace.id,
          reason: error instanceof Error ? error.message : 'unknown',
        })
      }
    } else {
      result.errors += 1
    }
  }

  if (delivered) result.sent += 1
}

export const SdDigestService = {
  /**
   * Um tick do resumo: percorre os workspaces com ServiceDesk habilitado e,
   * nos que estão na hora local combinada, envia a quem optou.
   */
  async runTick(now: Date = new Date()): Promise<SdDigestResult> {
    const result = emptyResult()
    const workspaces = await SdTicketContextRepository.listEnabledWorkspaceIds()
    if (!workspaces.ok) {
      logger.error('servicedesk.digest.workspaces_failed', {
        reason: workspaces.error.code,
      })
      result.errors += 1
      return result
    }
    result.workspaces = workspaces.value.length

    for (const workspaceId of workspaces.value) {
      const calendar =
        await SdTicketContextRepository.findDefaultCalendar(workspaceId)
      const timeZone = calendar.ok
        ? (calendar.value?.timezone ?? 'America/Sao_Paulo')
        : 'America/Sao_Paulo'
      if (sdLocalHour(now, timeZone) !== SD_DIGEST_HOUR) continue
      result.due += 1

      const [inAppIds, emailIds, workspace, settings] = await Promise.all([
        SdNotificationRepository.listDigestUserIds(
          workspaceId,
          SD_DIGEST_EVENT,
          'IN_APP',
        ),
        SdNotificationRepository.listDigestUserIds(
          workspaceId,
          SD_DIGEST_EVENT,
          'EMAIL',
        ),
        SdTicketContextRepository.findWorkspace(workspaceId),
        SdTicketContextRepository.ensureSettings(workspaceId),
      ])
      if (
        !inAppIds.ok ||
        !emailIds.ok ||
        !settings.ok ||
        !workspace.ok ||
        !workspace.value
      ) {
        result.errors += 1
        logger.warn('servicedesk.digest.workspace_failed', { workspaceId })
        continue
      }

      const inApp = new Set(inAppIds.value)
      const email = new Set(emailIds.value)
      const userIds = Array.from(new Set([...inApp, ...email]))
      for (const userId of userIds) {
        await digestFor(
          workspace.value,
          resolveSdTicketPrefixes(settings.value.ticketPrefixes),
          userId,
          { inApp: inApp.has(userId), email: email.has(userId) },
          now,
          result,
        )
      }
    }

    logger.info('servicedesk.digest.tick', { ...result })
    return result
  },
}
