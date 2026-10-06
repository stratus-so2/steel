import type { Notification, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type {
  NotificationAction,
  NotificationFolder,
} from '@/src/schemas/notification.schema'
import type { NotificationFolderCountsDTO } from '@/types/notification'
import { dbError } from './db-error'

export interface NotificationListParams {
  workspaceId: string
  userId: string
  folder: NotificationFolder
  /** Tipos aceitos (filtro por módulo/tipo, já resolvido pelo service). */
  kinds?: string[]
  search?: string
  cursor?: string
  limit: number
}

/**
 * Excluídas (`deletedAt`) nunca aparecem; `all` e `unread` escondem as
 * arquivadas, `archived` mostra só elas — a lógica de pastas de um cliente de
 * e-mail.
 */
function folderWhere(
  folder: NotificationFolder,
): Prisma.NotificationWhereInput {
  if (folder === 'archived') return { archivedAt: { not: null } }
  if (folder === 'unread') return { archivedAt: null, readAt: null }
  return { archivedAt: null }
}

function listWhere(
  params: NotificationListParams,
): Prisma.NotificationWhereInput {
  return {
    workspaceId: params.workspaceId,
    userId: params.userId,
    deletedAt: null,
    ...folderWhere(params.folder),
    ...(params.kinds ? { kind: { in: params.kinds as never } } : {}),
    ...(params.search
      ? {
          OR: [
            { title: { contains: params.search, mode: 'insensitive' } },
            { body: { contains: params.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  }
}

/** Dados da ação de cliente de e-mail aplicada em lote. */
function actionData(
  action: NotificationAction,
): Prisma.NotificationUpdateInput {
  const now = new Date()
  switch (action) {
    case 'read':
      return { readAt: now }
    case 'unread':
      return { readAt: null }
    case 'archive':
      return { archivedAt: now }
    case 'unarchive':
      return { archivedAt: null }
    case 'delete':
      return { deletedAt: now }
    default:
      return { deletedAt: null }
  }
}

export const NotificationRepository = {
  async createMany(
    data: Prisma.NotificationCreateManyInput[],
  ): Promise<Result<number>> {
    if (data.length === 0) return ok(0)
    try {
      // `skipDuplicates` makes `dedupeKey` idempotent: a row whose
      // (userId, dedupeKey) already exists is silently skipped.
      const result = await prisma.notification.createMany({
        data,
        skipDuplicates: true,
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to create notifications', error))
    }
  },

  async listByUser(
    workspaceId: string,
    userId: string,
    limit: number,
  ): Promise<Result<Notification[]>> {
    try {
      const rows = await prisma.notification.findMany({
        where: { workspaceId, userId, deletedAt: null, archivedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list notifications', error))
    }
  },

  /**
   * Página da caixa de entrada: filtros de pasta/tipo/busca e paginação por
   * cursor (`id` da última linha). Devolve `nextCursor` quando há mais.
   */
  async listPage(
    params: NotificationListParams,
  ): Promise<Result<{ items: Notification[]; nextCursor: string | null }>> {
    try {
      const rows = await prisma.notification.findMany({
        where: listWhere(params),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: params.limit + 1,
        ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
      })
      const hasMore = rows.length > params.limit
      const items = hasMore ? rows.slice(0, params.limit) : rows
      return ok({
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
      })
    } catch (error) {
      return err(dbError('Failed to list notifications', error))
    }
  },

  async countUnread(
    workspaceId: string,
    userId: string,
  ): Promise<Result<number>> {
    try {
      const count = await prisma.notification.count({
        where: {
          workspaceId,
          userId,
          readAt: null,
          deletedAt: null,
          archivedAt: null,
        },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count unread notifications', error))
    }
  },

  /** Contagem das três pastas, para os marcadores das abas. */
  async countFolders(
    workspaceId: string,
    userId: string,
  ): Promise<Result<NotificationFolderCountsDTO>> {
    const scope = { workspaceId, userId, deletedAt: null }
    try {
      const [all, unread, archived] = await Promise.all([
        prisma.notification.count({ where: { ...scope, archivedAt: null } }),
        prisma.notification.count({
          where: { ...scope, archivedAt: null, readAt: null },
        }),
        prisma.notification.count({
          where: { ...scope, archivedAt: { not: null } },
        }),
      ])
      return ok({ all, unread, archived })
    } catch (error) {
      return err(dbError('Failed to count notifications', error))
    }
  },

  /** Marca como lidas as notificações do próprio usuário (todas, ou só
   * `ids`). Ids de outro usuário/workspace são ignorados pelo filtro. */
  async markRead(
    workspaceId: string,
    userId: string,
    ids?: string[],
  ): Promise<Result<number>> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          workspaceId,
          userId,
          readAt: null,
          deletedAt: null,
          ...(ids ? { id: { in: ids } } : { archivedAt: null }),
        },
        data: { readAt: new Date() },
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to mark notifications as read', error))
    }
  },

  /**
   * Aplica uma ação (ler/não ler, arquivar/desarquivar, excluir/restaurar) às
   * notificações do próprio usuário. Ids de outra pessoa não casam o filtro,
   * então são simplesmente ignorados. `restore` é o único que enxerga as
   * excluídas — é o "desfazer" da exclusão.
   */
  async applyAction(params: {
    workspaceId: string
    userId: string
    ids: string[]
    action: NotificationAction
  }): Promise<Result<number>> {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          workspaceId: params.workspaceId,
          userId: params.userId,
          id: { in: params.ids },
          ...(params.action === 'restore' ? {} : { deletedAt: null }),
        },
        data: actionData(params.action),
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to update notifications', error))
    }
  },
}
