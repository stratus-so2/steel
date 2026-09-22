import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface SdDepartmentLink {
  departmentId: string
  parentId: string | null
  isLead: boolean
}

export const SdAccessRepository = {
  /** Departamentos ativos (não excluídos) do usuário nesta workspace. */
  async listDepartmentLinks(
    userId: string,
    workspaceId: string,
  ): Promise<Result<SdDepartmentLink[]>> {
    try {
      const rows = await prisma.sdDepartmentMember.findMany({
        where: {
          userId,
          department: { workspaceId, deletedAt: null, active: true },
        },
        select: {
          departmentId: true,
          isLead: true,
          department: { select: { parentId: true } },
        },
      })
      return ok(
        rows.map((r) => ({
          departmentId: r.departmentId,
          parentId: r.department.parentId,
          isLead: r.isLead,
        })),
      )
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk department links', error))
    }
  },
}
