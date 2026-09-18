import { createId } from '@paralleldrive/cuid2'
import type { WorkspaceFeatureOverride } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeWorkspaceFeatureOverride(
  overrides?: Partial<WorkspaceFeatureOverride>,
): WorkspaceFeatureOverride {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    key: 'crm.aiAssistant',
    enabled: false,
    note: null,
    expiresAt: null,
    updatedById: createId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedWorkspaceFeatureOverride(
  workspaceId: string,
  updatedById: string | null,
  overrides?: Partial<
    Pick<WorkspaceFeatureOverride, 'key' | 'enabled' | 'note' | 'expiresAt'>
  >,
) {
  return prisma.workspaceFeatureOverride.create({
    data: {
      workspaceId,
      updatedById,
      key: 'crm.aiAssistant',
      enabled: false,
      ...overrides,
    },
  })
}
