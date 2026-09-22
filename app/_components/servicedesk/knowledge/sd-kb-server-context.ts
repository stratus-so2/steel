import 'server-only'
import { cache } from 'react'
import { getAuthSession } from '@/src/lib/auth-session'
import { can } from '@/src/lib/permissions'
import { MembershipService } from '@/src/services/membership.service'
import { SdAccess } from '@/src/services/sd-access'

/** Quem está vendo a KB e o que pode fazer (derivado de `SdAccess`). */
export interface SdKbViewer {
  userId: string
  userName: string
  workspaceId: string
  workspaceSlug: string
  isAgent: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
}

/**
 * Contexto das telas da KB (port de `getWikiContext` do Nexo): sessão →
 * membro do workspace → acesso ao ServiceDesk (`sd-knowledge:VIEW`). `null`
 * quando não há acesso — a página chama `notFound()`.
 */
export const getSdKbViewer = cache(
  async (workspaceSlug: string): Promise<SdKbViewer | null> => {
    const session = await getAuthSession()
    if (!session.ok) return null

    const membership = await MembershipService.getByUserAndSlug(
      session.value.user.id,
      workspaceSlug,
    )
    if (!membership.ok || !membership.value) return null

    const workspaceId = membership.value.workspaceId
    const access = await SdAccess.resolve(session.value.user.id, workspaceId, {
      resource: 'sd-knowledge',
      action: 'VIEW',
    })
    if (!access.ok) return null

    const ctx = access.value
    const allows = (action: 'CREATE' | 'EDIT' | 'DELETE') =>
      ctx.isAgent &&
      (ctx.isPrivileged ||
        (ctx.permissions !== null &&
          can(ctx.permissions, 'sd-knowledge', action)))

    return {
      userId: session.value.user.id,
      userName: session.value.user.name,
      workspaceId,
      workspaceSlug,
      isAgent: ctx.isAgent,
      canCreate: allows('CREATE'),
      canEdit: allows('EDIT'),
      canDelete: allows('DELETE'),
    }
  },
)
