import type { Membership } from '@prisma/client'
import type { WorkspaceMemberDTO } from '@/types/membership'
import { profileNotFound } from '../errors'
import { err, ok, type Result } from '../lib/result'
import {
  MembershipRepository,
  type MembershipWithWorkspace,
} from '../repositories/membership.repository'
import { ProfileRepository } from '../repositories/profile.repository'
import { assertMember } from './authz'

export const MembershipService = {
  async getByUserAndSlug(
    userId: string,
    slug: string,
  ): Promise<Result<MembershipWithWorkspace | null>> {
    return MembershipRepository.findByUserAndSlug(userId, slug)
  },

  async listByUser(userId: string): Promise<Result<MembershipWithWorkspace[]>> {
    return MembershipRepository.listByUser(userId)
  },

  async countByWorkspace(workspaceId: string): Promise<Result<number>> {
    return MembershipRepository.countByWorkspace(workspaceId)
  },

  async listWithUserByWorkspace(workspaceId: string): Promise<
    Result<
      (Membership & {
        user: { id: string; name: string; email: string; image: string | null }
      })[]
    >
  > {
    return MembershipRepository.listWithUserByWorkspace(workspaceId)
  },

  /** Membros da workspace com papel e perfil, para a seção de configurações. */
  async listMembers(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceMemberDTO[]>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'members',
      action: 'VIEW',
    })
    if (!membership.ok) return membership

    const result =
      await MembershipRepository.listWithUserByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(
      result.value.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        image: m.user.image,
        role: m.role,
        profileId: m.profileId,
      })),
    )
  },

  /** Atribui (ou remove, com `profileId: null`) o perfil de acesso de um membro. */
  async setProfile(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
    profileId: string | null,
  ): Promise<Result<Membership>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'members',
      action: 'EDIT',
    })
    if (!membership.ok) return membership

    if (profileId) {
      const profile = await ProfileRepository.findById(profileId)
      if (!profile.ok) return profile
      if (!profile.value || profile.value.workspaceId !== workspaceId) {
        return err(profileNotFound())
      }
    }

    return MembershipRepository.setProfile(targetUserId, workspaceId, profileId)
  },
}
