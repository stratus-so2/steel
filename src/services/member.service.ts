import type { Role } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { removeSearchDocument } from '@/src/lib/search/index-hooks'
import type {
  ListMembersResult,
  MemberDTO,
  MemberImportResult,
  MemberImportRowResult,
  MemberSeatUsage,
} from '@/types/member'
import { UserCache } from '../cache/user.cache'
import { memberNotFound, memberProtected } from '../errors'
import { limitOf } from '../lib/plans'
import { err, ok, type Result } from '../lib/result'
import { toMemberDTO } from '../mappers/member.mapper'
import { InvitationRepository } from '../repositories/invitation.repository'
import { MembershipRepository } from '../repositories/membership.repository'
import { WorkspaceRepository } from '../repositories/workspace.repository'
import type {
  ListMembersQuery,
  MemberImportRowDTO,
  UpdateMemberRoleDTO,
} from '../schemas/member.schema'
import { assertPrivileged } from './authz'
import { InvitationService } from './invitation.service'

const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
}

function compareMembers(
  a: MemberDTO,
  b: MemberDTO,
  sortBy: ListMembersQuery['sortBy'],
): number {
  if (sortBy === 'role') return ROLE_RANK[a.role] - ROLE_RANK[b.role]
  if (sortBy === 'joinedAt') {
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  }
  return a[sortBy].localeCompare(b[sortBy], 'pt-BR', { sensitivity: 'base' })
}

/** Invitation errors that mean "nothing to do" rather than a failure. */
const SKIPPED_IMPORT_CODES = new Set([
  'INVITATION_DUPLICATE',
  'INVITATION_ALREADY_MEMBER',
])

/**
 * Loads the target membership and checks the actor may change it: nobody
 * changes themselves or the owner here, and only the owner manages admins.
 */
async function resolveManageableTarget(
  actorId: string,
  workspaceId: string,
  targetUserId: string,
): Promise<Result<{ role: Role }>> {
  const actor = await assertPrivileged(actorId, workspaceId)
  if (!actor.ok) return actor

  if (targetUserId === actorId) {
    return err(memberProtected('Você não pode alterar o seu próprio acesso'))
  }

  const target = await MembershipRepository.findByUserAndWorkspace(
    targetUserId,
    workspaceId,
  )
  if (!target.ok) return target
  if (!target.value) return err(memberNotFound())

  if (target.value.role === 'OWNER') {
    return err(memberProtected('O dono do workspace não pode ser alterado'))
  }
  if (target.value.role === 'ADMIN' && actor.value.role !== 'OWNER') {
    return err(
      memberProtected('Só o dono do workspace pode alterar administradores'),
    )
  }

  return ok({ role: target.value.role })
}

export const MemberService = {
  /** Paginated member directory. OWNER/ADMIN only (it exposes e-mails). */
  async list(
    actorId: string,
    workspaceId: string,
    query: ListMembersQuery,
  ): Promise<Result<ListMembersResult>> {
    const privileged = await assertPrivileged(actorId, workspaceId)
    if (!privileged.ok) return privileged

    const result = await MembershipRepository.listByWorkspaceWithUser(
      workspaceId,
      { search: query.search, roles: query.roles },
    )
    if (!result.ok) return result

    const direction = query.sortOrder === 'asc' ? 1 : -1
    const members = result.value
      .map(toMemberDTO)
      .sort((a, b) => compareMembers(a, b, query.sortBy) * direction)

    const seats = await this.seatUsage(workspaceId)
    if (!seats.ok) return seats

    const start = (query.page - 1) * query.pageSize

    return ok({
      members: members.slice(start, start + query.pageSize),
      total: members.length,
      page: query.page,
      pageSize: query.pageSize,
      seats: seats.value,
    })
  },

  /** Same count `InvitationService` enforces: members + pending invites. */
  async seatUsage(workspaceId: string): Promise<Result<MemberSeatUsage>> {
    const [workspace, members, pending] = await Promise.all([
      WorkspaceRepository.findById(workspaceId),
      MembershipRepository.countByWorkspace(workspaceId),
      InvitationRepository.countPendingByWorkspace(workspaceId),
    ])
    if (!workspace.ok) return workspace
    if (!members.ok) return members
    if (!pending.ok) return pending

    return ok({
      used: members.value + pending.value,
      limit: limitOf(workspace.value.activePlan, 'seats'),
    })
  },

  async updateRole(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
    dto: UpdateMemberRoleDTO,
  ): Promise<Result<{ userId: string; role: Role }>> {
    const target = await resolveManageableTarget(
      actorId,
      workspaceId,
      targetUserId,
    )
    if (!target.ok) return target

    const updated = await MembershipRepository.updateRole(
      targetUserId,
      workspaceId,
      dto.role,
    )
    if (!updated.ok) return updated

    await UserCache.invalidate(targetUserId)

    auditMutation({
      entity: 'membership',
      action: 'update',
      actorId,
      targetId: targetUserId,
      reason: 'role_change',
      meta: { workspaceId, from: target.value.role, to: dto.role },
    })

    return ok({ userId: targetUserId, role: updated.value.role })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
  ): Promise<Result<{ userId: string }>> {
    const target = await resolveManageableTarget(
      actorId,
      workspaceId,
      targetUserId,
    )
    if (!target.ok) return target

    const removed = await MembershipRepository.remove(targetUserId, workspaceId)
    if (!removed.ok) return removed

    await UserCache.invalidate(targetUserId)
    void removeSearchDocument('member', workspaceId, targetUserId)

    auditMutation({
      entity: 'membership',
      action: 'delete',
      actorId,
      targetId: targetUserId,
      meta: { workspaceId, role: target.value.role },
    })

    return ok({ userId: targetUserId })
  },

  /**
   * One invitation per CSV row through `InvitationService.create`, so seat
   * limit, duplicates and e-mail delivery follow the single-invite rules.
   */
  async import(
    actorId: string,
    workspaceId: string,
    rows: MemberImportRowDTO[],
  ): Promise<Result<MemberImportResult>> {
    const privileged = await assertPrivileged(actorId, workspaceId)
    if (!privileged.ok) return privileged

    const results: MemberImportRowResult[] = []
    for (const [index, row] of rows.entries()) {
      const invited = await InvitationService.create(actorId, workspaceId, {
        email: row.email,
        role: row.role,
      })
      const base = { row: index + 1, email: row.email }
      if (invited.ok) {
        results.push({ ...base, status: 'invited' })
      } else {
        results.push({
          ...base,
          status: SKIPPED_IMPORT_CODES.has(invited.error.code)
            ? 'skipped'
            : 'error',
          reason: invited.error.message,
        })
      }
    }

    const count = (status: MemberImportRowResult['status']) =>
      results.filter((r) => r.status === status).length
    const summary = {
      invited: count('invited'),
      skipped: count('skipped'),
      errors: count('error'),
    }

    auditMutation({
      entity: 'invitation',
      action: 'create',
      actorId,
      targetId: workspaceId,
      reason: 'csv_import',
      meta: { workspaceId, total: rows.length, ...summary },
    })

    return ok({ ...summary, rows: results })
  },
}
