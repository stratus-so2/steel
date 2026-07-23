import { ok, type Result } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import type { CrmMemberDTO } from '@/types/crm-member'
import { assertMember } from './authz'

/// Lista os membros da workspace para os selects de "responsável"/"criado
/// por" usados nas grades do CRM (RelationEditor com relationKind: 'users').
export const CrmMemberService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmMemberDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await MembershipRepository.listWithUserByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(
      result.value.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
      })),
    )
  },
}
