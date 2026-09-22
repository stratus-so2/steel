import { forbidden, sdNotAgent } from '@/src/errors'
import { can } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import { SdAccessRepository } from '@/src/repositories/sd-access.repository'
import {
  assertModuleMember,
  type MembershipContext,
  type PermissionRequirement,
} from './authz'

/**
 * Contexto de acesso ao ServiceDesk. Além da matriz RBAC (`sd-*`), o módulo
 * distingue **agente** (membro de ao menos um departamento ativo) de
 * **solicitante** (sem departamento: portal e os próprios chamados). OWNER/
 * ADMIN e perfis com `sd-settings:EDIT` são **admins** do módulo e contam
 * como agentes mesmo sem departamento.
 */
export interface SdAccessContext extends MembershipContext {
  userId: string
  isAdmin: boolean
  isAgent: boolean
  departmentIds: string[]
  leadDepartmentIds: string[]
}

export const SdAccess = {
  /**
   * Associação → módulo `SERVICE_DESK` habilitado → permissão opcional →
   * departamentos do usuário.
   */
  async resolve(
    actorId: string,
    workspaceId: string,
    require?: PermissionRequirement,
  ): Promise<Result<SdAccessContext>> {
    const membership = await assertModuleMember(
      actorId,
      workspaceId,
      'SERVICE_DESK',
      require,
    )
    if (!membership.ok) return membership

    const links = await SdAccessRepository.listDepartmentLinks(
      actorId,
      workspaceId,
    )
    if (!links.ok) return links

    const isAdmin =
      membership.value.isPrivileged ||
      (membership.value.permissions !== null &&
        can(membership.value.permissions, 'sd-settings', 'EDIT'))

    return ok({
      ...membership.value,
      userId: actorId,
      isAdmin,
      isAgent: isAdmin || links.value.length > 0,
      departmentIds: links.value.map((l) => l.departmentId),
      leadDepartmentIds: links.value
        .filter((l) => l.isLead)
        .map((l) => l.departmentId),
    })
  },

  /** Como `resolve`, mas recusa solicitantes (`SD_NOT_AGENT`). */
  async requireAgent(
    actorId: string,
    workspaceId: string,
    require?: PermissionRequirement,
  ): Promise<Result<SdAccessContext>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId, require)
    if (!ctx.ok) return ctx
    if (!ctx.value.isAgent) return err(sdNotAgent())
    return ctx
  },

  /** Configuração do módulo: só admins (`sd-settings`). */
  async requireAdmin(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdAccessContext>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    if (!ctx.value.isAdmin)
      return err(
        forbidden(
          'Apenas administradores do ServiceDesk podem alterar a configuração',
        ),
      )
    return ctx
  },
}
