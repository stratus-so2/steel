import 'server-only'

import { redirect } from 'next/navigation'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'
import { SdAccess } from '@/src/services/sd-access'

export interface SdDirectoryContext {
  workspaceId: string
  isAgent: boolean
  isAdmin: boolean
}

/**
 * Sessão → associação pelo slug → acesso ao ServiceDesk. `null` quando o
 * usuário não é membro (a página chama `notFound()` no próprio corpo).
 */
export async function loadSdDirectoryContext(
  slug: string,
): Promise<SdDirectoryContext | null> {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) return null

  const workspaceId = membership.value.workspaceId
  const access = await SdAccess.resolve(session.value.user.id, workspaceId)
  if (!access.ok) return null

  return {
    workspaceId,
    isAgent: access.value.isAgent,
    isAdmin: access.value.isAdmin,
  }
}
