import { createId } from '@paralleldrive/cuid2'
import type { CrmIntegrationApiKey } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmIntegrationKey(
  overrides?: Partial<CrmIntegrationApiKey>,
): CrmIntegrationApiKey {
  const now = new Date()
  return {
    id: createId(),
    name: 'Zapier',
    keyHash: createId(),
    prefix: 'crm_live_ab12',
    workspaceId: createId(),
    createdById: createId(),
    lastUsedAt: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmIntegrationKey(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmIntegrationApiKey, 'name' | 'keyHash' | 'prefix' | 'revokedAt'>
  >,
) {
  return prisma.crmIntegrationApiKey.create({
    data: {
      name: 'Seed Key',
      keyHash: createId(),
      prefix: 'crm_live_ab12',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}
