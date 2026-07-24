import type { Profile } from '@prisma/client'
import {
  profileInUse,
  profileNameTaken,
  profileNotFound,
  profileSystemProtected,
} from '@/src/errors'
import { sanitizePermissions } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import { toProfileDTO } from '@/src/mappers/profile.mapper'
import { ProfileRepository } from '@/src/repositories/profile.repository'
import type {
  CreateProfileInput,
  ProfileDTO,
  UpdateProfileInput,
} from '@/src/schemas/profile.schema'
import { assertMember } from './authz'

async function loadInWorkspace(
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

export const ProfileService = {
  /** Lista os perfis, semeando os de sistema na primeira vez (lazy). */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<ProfileDTO[]>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'members',
      action: 'VIEW',
    })
    if (!membership.ok) return membership

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

  async create(
    actorId: string,
    workspaceId: string,
    input: CreateProfileInput,
  ): Promise<Result<ProfileDTO>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'members',
      action: 'EDIT',
    })
    if (!membership.ok) return membership

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

  async update(
    actorId: string,
    workspaceId: string,
    id: string,
    input: UpdateProfileInput,
  ): Promise<Result<ProfileDTO>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'members',
      action: 'EDIT',
    })
    if (!membership.ok) return membership

    const existing = await loadInWorkspace(workspaceId, id)
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

  async remove(
    actorId: string,
    workspaceId: string,
    id: string,
  ): Promise<Result<true>> {
    const membership = await assertMember(actorId, workspaceId, {
      resource: 'members',
      action: 'EDIT',
    })
    if (!membership.ok) return membership

    const existing = await loadInWorkspace(workspaceId, id)
    if (!existing.ok) return existing
    if (existing.value.isSystem) return err(profileSystemProtected())

    const count = await ProfileRepository.countMemberships(id)
    if (!count.ok) return count
    if (count.value > 0) return err(profileInUse())

    return ProfileRepository.delete(id)
  },
}
