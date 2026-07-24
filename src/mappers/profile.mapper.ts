import type { Profile } from '@prisma/client'
import type { PermissionMap } from '@/src/lib/permissions'
import type { ProfileDTO } from '@/src/schemas/profile.schema'

/** `Prisma.Profile` → `ProfileDTO`. */
export function toProfileDTO(profile: Profile): ProfileDTO {
  return {
    id: profile.id,
    name: profile.name,
    isSystem: profile.isSystem,
    systemKey: profile.systemKey,
    permissions: profile.permissions as PermissionMap as Record<
      string,
      string[]
    >,
    workspaceId: profile.workspaceId,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }
}
