import type { Workspace } from '@prisma/client'
import type { AdminWorkspaceSummaryDTO } from '@/types/admin-workspace'

/** `Prisma.Workspace` (+ contagem de membros) → `AdminWorkspaceSummaryDTO`. */
export function toAdminWorkspaceSummaryDTO(
  workspace: Workspace & { memberCount: number },
): AdminWorkspaceSummaryDTO {
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    activePlan: workspace.activePlan,
    memberCount: workspace.memberCount,
    createdAt: workspace.createdAt.toISOString(),
  }
}
