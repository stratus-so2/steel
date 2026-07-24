import { createId } from '@paralleldrive/cuid2'
import type { CrmHookVaultItem } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmHookVaultItem(
  overrides?: Partial<CrmHookVaultItem>,
): CrmHookVaultItem {
  const now = new Date()
  return {
    id: createId(),
    text: 'Você sabia que 90% das startups falham por isso?',
    platform: null,
    usageCount: 0,
    notes: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmHookVaultItem(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmHookVaultItem,
      'text' | 'platform' | 'usageCount' | 'notes' | 'deletedAt'
    >
  >,
) {
  return prisma.crmHookVaultItem.create({
    data: { text: 'Hook de teste', workspaceId, createdById, ...overrides },
  })
}
