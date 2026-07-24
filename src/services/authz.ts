import type { Role } from '@prisma/client'
import { forbidden } from '../errors'
import {
  can,
  type PermissionAction,
  type PermissionMap,
  SYSTEM_PROFILE_PERMISSIONS,
} from '../lib/permissions'
import { err, ok, type Result } from '../lib/result'
import { MembershipRepository } from '../repositories/membership.repository'

export const PRIVILEGED_ROLES = ['OWNER', 'ADMIN'] as const

export function isPrivilegedRole(role: Role): boolean {
  return (PRIVILEGED_ROLES as readonly string[]).includes(role)
}

export interface MembershipContext {
  role: Role
  isPrivileged: boolean
  /** Permissões efetivas (perfil, ou fallback do papel), ou `null`. */
  permissions: PermissionMap | null
}

export interface PermissionRequirement {
  resource: string
  action: PermissionAction
}

/**
 * Verifica associação ao workspace e, opcionalmente, uma permissão específica
 * (recurso × ação). Sem `require`, só confirma associação — o comportamento
 * histórico de `assertMember`, preservado para não quebrar os chamadores
 * existentes. Membros com role privilegiado (OWNER/ADMIN) sempre passam.
 */
export async function assertMember(
  actorId: string,
  workspaceId: string,
  require?: PermissionRequirement,
): Promise<Result<MembershipContext>> {
  const membership = await MembershipRepository.findByUserAndWorkspace(
    actorId,
    workspaceId,
  )
  if (!membership.ok) return membership
  if (!membership.value) return err(forbidden())

  const isPrivileged = isPrivilegedRole(membership.value.role)
  const profile = membership.value.profile
  const permissions: PermissionMap | null = profile
    ? (profile.permissions as PermissionMap)
    : (SYSTEM_PROFILE_PERMISSIONS[membership.value.role] ?? null)

  if (require && !isPrivileged) {
    // `null` = não determinável → permite (membro verificado).
    if (permissions && !can(permissions, require.resource, require.action)) {
      return err(forbidden())
    }
  }

  return ok({ role: membership.value.role, isPrivileged, permissions })
}

export async function assertPrivileged(
  actorId: string,
  workspaceId: string,
): Promise<Result<MembershipContext>> {
  const membership = await assertMember(actorId, workspaceId)
  if (!membership.ok) return membership
  if (!membership.value.isPrivileged) return err(forbidden())
  return ok(membership.value)
}
