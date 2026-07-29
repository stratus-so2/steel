import type { Membership, Profile, Workspace } from '@prisma/client'
import {
  profileInUse,
  profileNameTaken,
  profileNotFound,
  profileSystemProtected,
} from '@/src/errors'
import { sanitizePermissions } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import { toAdminWorkspaceSummaryDTO } from '@/src/mappers/admin-workspace.mapper'
import { toProfileDTO } from '@/src/mappers/profile.mapper'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { ProfileRepository } from '@/src/repositories/profile.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import type {
  CreateProfileInput,
  ProfileDTO,
  UpdateProfileInput,
} from '@/src/schemas/profile.schema'
import type { AdminWorkspaceSummaryDTO } from '@/types/admin-workspace'
import type { WorkspaceMemberDTO } from '@/types/membership'
import { assertPlatformAdmin } from './authz'

async function loadProfileInWorkspace(
  workspaceId: string,
  id: string,
): Promise<Result<Profile>> {
  const found = await ProfileRepository.findById(id)
  if (!found.ok) return found
  const profile = found.value
  if (!profile || profile.workspaceId !== workspaceId) {
    return err(profileNotFound())
  }
  return ok(profile)
}

/**
 * Operações do painel admin global sobre workspaces alheios: bypassa
 * `assertMember` (o admin não é necessariamente membro do workspace) e usa
 * `assertPlatformAdmin` como gate único, delegando às mesmas repositories
 * usadas pelos services voltados a membros.
 */
export const AdminWorkspaceService = {
  async listWorkspaces(
    actorId: string,
  ): Promise<Result<AdminWorkspaceSummaryDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const result = await WorkspaceRepository.listAllWithCounts()
    if (!result.ok) return result
    return ok(result.value.map(toAdminWorkspaceSummaryDTO))
  },

  async getWorkspace(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<Workspace>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    return WorkspaceRepository.findById(workspaceId)
  },

  async listMembers(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceMemberDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

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

  async setMemberProfile(
    actorId: string,
    workspaceId: string,
    targetUserId: string,
    profileId: string | null,
  ): Promise<Result<Membership>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    if (profileId) {
      const profile = await ProfileRepository.findById(profileId)
      if (!profile.ok) return profile
      if (!profile.value || profile.value.workspaceId !== workspaceId) {
        return err(profileNotFound())
      }
    }

    return MembershipRepository.setProfile(targetUserId, workspaceId, profileId)
  },

  async listProfiles(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<ProfileDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const seeded = await ProfileRepository.ensureSystemProfiles(workspaceId)
    if (!seeded.ok) return seeded
    return ok(
      [...seeded.value]
        .sort((a, b) =>
          a.isSystem === b.isSystem
            ? a.name.localeCompare(b.name)
            : a.isSystem
              ? -1
              : 1,
        )
        .map(toProfileDTO),
    )
  },

  async createProfile(
    actorId: string,
    workspaceId: string,
    input: CreateProfileInput,
  ): Promise<Result<ProfileDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const taken = await ProfileRepository.existsByName(workspaceId, input.name)
    if (!taken.ok) return taken
    if (taken.value) return err(profileNameTaken())

    const created = await ProfileRepository.create({
      workspaceId,
      name: input.name,
      permissions: sanitizePermissions(input.permissions),
    })
    if (!created.ok) return created
    return ok(toProfileDTO(created.value))
  },

  async updateProfile(
    actorId: string,
    workspaceId: string,
    id: string,
    input: UpdateProfileInput,
  ): Promise<Result<ProfileDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const existing = await loadProfileInWorkspace(workspaceId, id)
    if (!existing.ok) return existing
    if (existing.value.isSystem) return err(profileSystemProtected())

    if (input.name && input.name !== existing.value.name) {
      const taken = await ProfileRepository.existsByName(
        workspaceId,
        input.name,
        id,
      )
      if (!taken.ok) return taken
      if (taken.value) return err(profileNameTaken())
    }

    const updated = await ProfileRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.permissions !== undefined && {
        permissions: sanitizePermissions(input.permissions),
      }),
    })
    if (!updated.ok) return updated
    return ok(toProfileDTO(updated.value))
  },

  async removeProfile(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<true>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const existing = await loadProfileInWorkspace(workspaceId, id)
    if (!existing.ok) return existing
    if (existing.value.isSystem) return err(profileSystemProtected())

    const count = await ProfileRepository.countMemberships(id)
    if (!count.ok) return count
    if (count.value > 0) return err(profileInUse())

    return ProfileRepository.delete(id)
  },
}
