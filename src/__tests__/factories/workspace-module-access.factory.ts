import { createId } from '@paralleldrive/cuid2'
import type { ModuleKind, WorkspaceModuleAccess } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeWorkspaceModuleAccess(
  overrides?: Partial<WorkspaceModuleAccess>,
): WorkspaceModuleAccess {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    module: 'CRM' as ModuleKind,
    enabled: true,
    grantedById: createId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedWorkspaceModuleAccess(
  workspaceId: string,
  grantedById: string,
  overrides?: Partial<Pick<WorkspaceModuleAccess, 'module' | 'enabled'>>,
) {
  return prisma.workspaceModuleAccess.create({
    data: {
      workspaceId,
      grantedById,
      module: 'CRM' as ModuleKind,
      enabled: true,
      ...overrides,
    },
  })
}
