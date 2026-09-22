import type { Profile, Role, User } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb } from './sd-config-db'

export type SdRefKind =
  | 'departmentIds'
  | 'userIds'
  | 'templateIds'
  | 'categoryIds'
  | 'priorityIds'
  | 'calendarIds'
  | 'slaPolicyIds'
  | 'classificationIds'
  | 'impactIds'
  | 'urgencyIds'
  | 'severityIds'
  | 'phaseIds'

type IdRow = { id: string }

function ids(rows: IdRow[]): string[] {
  return rows.map((r) => r.id)
}

export interface SdWorkspaceMemberRow {
  role: Role
  profile: Pick<Profile, 'isSystem' | 'systemKey' | 'permissions'> | null
  user: Pick<User, 'id' | 'name' | 'email' | 'image'>
  departments: { departmentId: string; isLead: boolean }[]
}

/**
 * Consultas transversais da configuração do ServiceDesk: existência de ids
 * referenciados e membros do workspace com seus departamentos.
 */
export const SdConfigRepository = {
  /** Membros do workspace + vínculos com departamentos ativos. */
  async listWorkspaceMembers(
    workspaceId: string,
  ): Promise<Result<SdWorkspaceMemberRow[]>> {
    return sdDb('Failed to list ServiceDesk workspace members', async () => {
      const rows = await prisma.membership.findMany({
        where: { workspaceId },
        select: {
          role: true,
          profile: {
            select: { isSystem: true, systemKey: true, permissions: true },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              sdDepartmentMemberships: {
                where: {
                  department: { workspaceId, deletedAt: null, active: true },
                },
                select: { departmentId: true, isLead: true },
              },
            },
          },
        },
        orderBy: { user: { name: 'asc' } },
      })
      return rows.map(({ role, profile, user }) => {
        const { sdDepartmentMemberships, ...rest } = user
        return {
          role,
          profile,
          user: rest,
          departments: sdDepartmentMemberships,
        }
      })
    })
  },

  /** Dos ids pedidos, devolve os que existem na workspace (por tipo). */
  async findExistingRefs(
    workspaceId: string,
    wanted: Partial<Record<SdRefKind, string[]>>,
  ): Promise<Result<Partial<Record<SdRefKind, string[]>>>> {
    return sdDb('Failed to check ServiceDesk references', async () => {
      const select = { id: true } as const
      const where = (list: string[]) => ({ id: { in: list }, workspaceId })
      const loaders: Record<SdRefKind, (list: string[]) => Promise<string[]>> =
        {
          departmentIds: async (list) =>
            ids(
              await prisma.sdDepartment.findMany({
                where: { ...where(list), deletedAt: null },
                select,
              }),
            ),
          userIds: async (list) =>
            (
              await prisma.membership.findMany({
                where: { userId: { in: list }, workspaceId },
                select: { userId: true },
              })
            ).map((m) => m.userId),
          templateIds: async (list) =>
            ids(
              await prisma.sdTicketTemplate.findMany({
                where: where(list),
                select,
              }),
            ),
          categoryIds: async (list) =>
            ids(
              await prisma.sdCategory.findMany({ where: where(list), select }),
            ),
          priorityIds: async (list) =>
            ids(
              await prisma.sdPriority.findMany({ where: where(list), select }),
            ),
          calendarIds: async (list) =>
            ids(
              await prisma.sdBusinessCalendar.findMany({
                where: where(list),
                select,
              }),
            ),
          slaPolicyIds: async (list) =>
            ids(
              await prisma.sdSlaPolicy.findMany({ where: where(list), select }),
            ),
          classificationIds: async (list) =>
            ids(
              await prisma.sdClassification.findMany({
                where: where(list),
                select,
              }),
            ),
          impactIds: async (list) =>
            ids(await prisma.sdImpact.findMany({ where: where(list), select })),
          urgencyIds: async (list) =>
            ids(
              await prisma.sdUrgency.findMany({ where: where(list), select }),
            ),
          severityIds: async (list) =>
            ids(
              await prisma.sdSeverity.findMany({ where: where(list), select }),
            ),
          phaseIds: async (list) =>
            ids(await prisma.sdPhase.findMany({ where: where(list), select })),
        }

      const entries = await Promise.all(
        (Object.keys(wanted) as SdRefKind[])
          .filter((key) => (wanted[key]?.length ?? 0) > 0)
          .map(
            async (key) =>
              [key, await loaders[key](wanted[key] as string[])] as const,
          ),
      )
      return Object.fromEntries(entries) as Partial<Record<SdRefKind, string[]>>
    })
  },
}
