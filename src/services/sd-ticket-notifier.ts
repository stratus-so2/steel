import type { NotificationKind } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { sendSdTicketNotificationEmail } from '@/src/lib/mail/servicedesk/send-sd-ticket-notification'
import { ok, type Result } from '@/src/lib/result'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { NotificationService } from './notification.service'

export interface SdTicketNotifyInput {
  workspaceId: string
  userIds: (string | null | undefined)[]
  /** Nunca notifica estes (ex.: quem causou a mudança). */
  excludeUserIds?: (string | null | undefined)[]
  kind: NotificationKind
  ticket: { number: number; code: string; title: string }
  /** Título da notificação no app (e frase principal do e-mail). */
  title: string
  body: string
  /** Também envia e-mail (dry-run em teste/`MAIL_DRY_RUN`). */
  email?: boolean
}

/** Caminho interno da tela do chamado. */
export function sdTicketHref(slug: string, number: number): string {
  return `/${slug}/servicedesk/tickets/${number}`
}

/**
 * Notificações de chamado do ServiceDesk: in-app (`Notification`) e,
 * opcionalmente, e-mail. Nunca falha o fluxo que chamou — erros são
 * logados e a contagem volta como 0.
 */
export const SdTicketNotifier = {
  async notify(input: SdTicketNotifyInput): Promise<Result<number>> {
    const exclude = new Set(input.excludeUserIds ?? [])
    const userIds = Array.from(
      new Set(
        input.userIds.filter(
          (id): id is string => typeof id === 'string' && !exclude.has(id),
        ),
      ),
    )
    if (userIds.length === 0) return ok(0)

    const workspace = await SdTicketContextRepository.findWorkspace(
      input.workspaceId,
    )
    if (!workspace.ok || !workspace.value) {
      logger.warn('servicedesk.notify.workspace_missing', {
        workspaceId: input.workspaceId,
      })
      return ok(0)
    }
    const href = sdTicketHref(workspace.value.slug, input.ticket.number)

    const created = await NotificationService.notifyUsers({
      workspaceId: input.workspaceId,
      userIds,
      kind: input.kind,
      title: input.title,
      body: input.body,
      href,
    })
    if (!created.ok) {
      logger.error('servicedesk.notify.in_app_failed', {
        workspaceId: input.workspaceId,
        kind: input.kind,
        reason: created.error.code,
      })
    }

    if (input.email) {
      const users = await SdTicketContextRepository.findUserNames(userIds)
      if (users.ok) {
        const results = await Promise.allSettled(
          [...users.value.values()].map((u) =>
            sendSdTicketNotificationEmail({
              email: u.email,
              username: u.name,
              workspaceName: workspace.value?.name ?? '',
              ticketCode: input.ticket.code,
              ticketTitle: input.ticket.title,
              headline: input.title,
              message: input.body,
              redirectUrl: `${NEXT_PUBLIC_URL}${href}`,
            }),
          ),
        )
        const failed = results.filter((r) => r.status === 'rejected').length
        if (failed > 0) {
          logger.warn('servicedesk.notify.email_failed', {
            workspaceId: input.workspaceId,
            kind: input.kind,
            failed,
          })
        }
      }
    }

    return ok(created.ok ? created.value : 0)
  },
}
