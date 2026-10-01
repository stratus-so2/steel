import { z } from 'zod'
import { NOTIFICATION_MODULES } from '@/src/lib/notification-kind'

/** Sem `ids`, marca todas as notificações do usuário no workspace. */
export const MarkNotificationsReadSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional(),
})

export type MarkNotificationsReadDTO = z.infer<
  typeof MarkNotificationsReadSchema
>

/**
 * Pasta da caixa de entrada. `all` esconde as arquivadas (como um cliente de
 * e-mail); excluídas nunca aparecem em pasta alguma.
 */
export const NOTIFICATION_FOLDERS = ['all', 'unread', 'archived'] as const

export const NotificationFolderSchema = z.enum(NOTIFICATION_FOLDERS)

export type NotificationFolder = z.infer<typeof NotificationFolderSchema>

export const NOTIFICATION_PAGE_SIZE = 25

/** Filtros da listagem (query string de `GET .../notifications`). */
export const NotificationListQuerySchema = z.object({
  folder: NotificationFolderSchema.default('all'),
  /** Filtro por módulo de origem, derivado do `kind`. */
  module: z.enum(NOTIFICATION_MODULES).optional(),
  /** Filtro por tipo de evento (`Notification.kind`). */
  kind: z.string().min(1).max(64).optional(),
  /** Busca em título e corpo (case-insensitive). */
  search: z.string().trim().min(1).max(200).optional(),
  /** Id da última notificação da página anterior. */
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(NOTIFICATION_PAGE_SIZE),
})

export type NotificationListQueryDTO = z.infer<
  typeof NotificationListQuerySchema
>

/**
 * Ações de cliente de e-mail aplicadas a uma ou mais notificações. A ação em
 * lote e a ação de uma linha são a mesma rota — a interface só muda o tamanho
 * de `ids`. `delete` é exclusão lógica (`deletedAt`), o que permite "desfazer".
 */
export const NOTIFICATION_ACTIONS = [
  'read',
  'unread',
  'archive',
  'unarchive',
  'delete',
  'restore',
] as const

export const NotificationActionSchema = z.enum(NOTIFICATION_ACTIONS)

export type NotificationAction = z.infer<typeof NotificationActionSchema>

export const NotificationBulkActionSchema = z.object({
  action: NotificationActionSchema,
  ids: z.array(z.string().min(1)).min(1).max(100),
})

export type NotificationBulkActionDTO = z.infer<
  typeof NotificationBulkActionSchema
>
