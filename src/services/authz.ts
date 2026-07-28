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
import { UserRepository } from '../repositories/user.repository'

export const PRIVILEGED_ROLES = ['OWNER', 'ADMIN'] as const

/**
 * Domínio de e-mail exigido do admin global, além da flag `isPlatformAdmin`.
 * Segunda camada de defesa: a flag sozinha já basta, mas exigir o domínio
 * também barra o caso de a flag vazar/ficar esquecida numa conta errada.
 */
const PLATFORM_ADMIN_EMAIL_DOMAIN = '@stratustelecom.com.br'

export interface PlatformAdminContext {
  userId: string
  email: string
}

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

/**
 * Verifica acesso ao painel admin global (fora do escopo de qualquer
 * workspace). Exige a flag `isPlatformAdmin` **e** o e-mail no domínio da
 * Stratus Telecom — as duas condições, não uma ou outra.
 */
export async function assertPlatformAdmin(
  actorId: string,
): Promise<Result<PlatformAdminContext>> {
  const user = await UserRepository.findById(actorId)
  if (!user.ok) return user

  if (
    !user.value.isPlatformAdmin ||
    !user.value.email.toLowerCase().endsWith(PLATFORM_ADMIN_EMAIL_DOMAIN)
  ) {
    return err(forbidden())
  }

  return ok({ userId: user.value.id, email: user.value.email })
}
