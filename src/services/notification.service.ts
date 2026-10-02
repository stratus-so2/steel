import type { NotificationKind } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { notificationKindsOfModule } from '@/src/lib/notification-kind'
import { publishNotificationEvent } from '@/src/lib/notifications/realtime'
import { ok, type Result } from '@/src/lib/result'
import { toNotificationDTO } from '@/src/mappers/notification.mapper'
import { NotificationRepository } from '@/src/repositories/notification.repository'
import type {
  MarkNotificationsReadDTO,
  NotificationBulkActionDTO,
  NotificationListQueryDTO,
} from '@/src/schemas/notification.schema'
import type {
  NotificationActionResultDTO,
  NotificationListDTO,
} from '@/types/notification'
import { assertMember } from './authz'

const LIST_LIMIT = 50

/**
 * Tipos aceitos pelo filtro: o cruzamento de `module` (resolvido pela tabela
 * pura de `kind`) com `kind`. `kind` fora do módulo escolhido devolve lista
 * vazia — e não a listagem inteira.
 */
function kindFilter(
  query: Pick<NotificationListQueryDTO, 'module' | 'kind'>,
): string[] | undefined {
  const ofModule = query.module
    ? notificationKindsOfModule(query.module)
    : undefined
  if (!query.kind) return ofModule
  if (ofModule && !ofModule.includes(query.kind)) return []
  return [query.kind]
}

export const NotificationService = {
  /** Caixa de entrada do usuário no workspace (mais recentes primeiro). */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<NotificationListDTO>> {
    return NotificationService.listInbox(actorId, workspaceId, {
      folder: 'all',
      limit: LIST_LIMIT,
    })
  },

  /**
   * Caixa de entrada com pastas, filtros, busca e paginação por cursor. Só
   * devolve as notificações de quem chamou — não há visão de administrador.
   */
  async listInbox(
    actorId: string,
    workspaceId: string,
    query: NotificationListQueryDTO,
  ): Promise<Result<NotificationListDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const [page, counts] = await Promise.all([
      NotificationRepository.listPage({
        workspaceId,
        userId: actorId,
        folder: query.folder,
        kinds: kindFilter(query),
        search: query.search,
        cursor: query.cursor,
        limit: query.limit,
      }),
      NotificationRepository.countFolders(workspaceId, actorId),
    ])
    if (!page.ok) return page
    if (!counts.ok) return counts

    return ok({
      items: page.value.items.map(toNotificationDTO),
      unreadCount: counts.value.unread,
      nextCursor: page.value.nextCursor,
      counts: counts.value,
    })
  },

  /** Marca como lidas as próprias notificações (todas, ou só `ids`). */
  async markRead(
    actorId: string,
    workspaceId: string,
    dto: MarkNotificationsReadDTO,
  ): Promise<Result<NotificationActionResultDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const updated = await NotificationRepository.markRead(
      workspaceId,
      actorId,
      dto.ids,
    )
    if (!updated.ok) return updated
    return ok({ updated: updated.value })
  },

  /**
   * Ação de cliente de e-mail (ler/não ler, arquivar/desarquivar,
   * excluir/restaurar) numa ou em várias notificações. `restore` é o
   * "desfazer" da exclusão. Ids de outra pessoa são ignorados pelo filtro do
   * repositório, então o resultado conta só o que era mesmo do usuário.
   */
  async applyAction(
    actorId: string,
    workspaceId: string,
    dto: NotificationBulkActionDTO,
  ): Promise<Result<NotificationActionResultDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const ids = Array.from(new Set(dto.ids))
    // Só a dupla destrutiva vai para o audit: ler/arquivar o usuário desfaz
    // na própria tela, excluir tira um aviso de vista (LGPD: conteúdo dele).
    const audited =
      dto.action === 'delete' || dto.action === 'restore' ? dto.action : null

    const updated = await NotificationRepository.applyAction({
      workspaceId,
      userId: actorId,
      ids,
      action: dto.action,
    })
    if (!updated.ok) {
      if (audited) {
        auditMutation({
          entity: 'notification',
          action: audited,
          actorId,
          outcome: 'failure',
          reason: updated.error.code,
          meta: { workspaceId, requested: ids.length },
        })
      }
      return updated
    }

    if (audited) {
      auditMutation({
        entity: 'notification',
        action: audited,
        actorId,
        meta: { workspaceId, updated: updated.value },
      })
    }

    return ok({ updated: updated.value })
  },

  /**
   * Cria a mesma notificação para vários usuários. Fluxo de sistema: quem
   * chama já decidiu os destinatários (membros do workspace). Publica o
   * evento genérico de tempo real para a caixa de entrada e o contador do
   * cabeçalho se atualizarem sem recarregar.
   */
  async notifyUsers(input: {
    workspaceId: string
    userIds: string[]
    kind: NotificationKind
    title: string
    body: string
    href?: string
  }): Promise<Result<number>> {
    const userIds = Array.from(new Set(input.userIds))
    const created = await NotificationRepository.createMany(
      userIds.map((userId) => ({
        workspaceId: input.workspaceId,
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
      })),
    )
    if (!created.ok || created.value === 0) return created

    await publishNotificationEvent(input.workspaceId, userIds, {
      type: 'notification.created',
      kind: input.kind,
      at: new Date().toISOString(),
    })

    return created
  },
}
