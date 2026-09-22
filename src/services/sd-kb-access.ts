import type { PermissionAction } from '@/src/lib/permissions'
import type { Result } from '@/src/lib/result'
import { SdAccess, type SdAccessContext } from './sd-access'

/**
 * Regras de acesso da KB. Agentes (e admins) leem tudo e editam conforme a
 * matriz (`sd-knowledge`); solicitantes só leem artigos **publicados** com
 * visibilidade **portal** e não arquivados.
 */

/** Leitura: qualquer membro com acesso ao módulo e `sd-knowledge:VIEW`. */
export function resolveSdKbReader(
  actorId: string,
  workspaceId: string,
): Promise<Result<SdAccessContext>> {
  return SdAccess.resolve(actorId, workspaceId, {
    resource: 'sd-knowledge',
    action: 'VIEW',
  })
}

/** Escrita: só agentes, com a ação pedida em `sd-knowledge`. */
export function resolveSdKbEditor(
  actorId: string,
  workspaceId: string,
  action: PermissionAction,
): Promise<Result<SdAccessContext>> {
  return SdAccess.requireAgent(actorId, workspaceId, {
    resource: 'sd-knowledge',
    action,
  })
}

export function isSdKbPortalReadable(article: {
  status: string
  visibility: string
  archivedAt: Date | null
}): boolean {
  return (
    article.status === 'PUBLISHED' &&
    article.visibility === 'PORTAL' &&
    article.archivedAt === null
  )
}

export function canReadSdKbArticle(
  ctx: Pick<SdAccessContext, 'isAgent'>,
  article: { status: string; visibility: string; archivedAt: Date | null },
): boolean {
  return ctx.isAgent || isSdKbPortalReadable(article)
}
