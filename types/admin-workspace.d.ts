import type { Plan } from '@prisma/client'

/** Linha da listagem de workspaces do painel admin global. */
export interface AdminWorkspaceSummaryDTO {
  id: string
  name: string
  slug: string
  activePlan: Plan
  memberCount: number
  createdAt: string
}
