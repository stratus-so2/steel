import { createId } from '@paralleldrive/cuid2'
import type { Prisma, Profile } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeProfile(overrides?: Partial<Profile>): Profile {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Vendedor',
    isSystem: false,
    systemKey: null,
    permissions: { companies: ['VIEW', 'CREATE', 'EDIT'] },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedProfile(
  workspaceId: string,
  overrides?: Partial<
    Pick<Profile, 'name' | 'isSystem' | 'systemKey'> & {
      permissions: Prisma.InputJsonValue
    }
  >,
) {
  return prisma.profile.create({
    data: {
      workspaceId,
      name: 'Vendedor',
      permissions: { companies: ['VIEW'] },
      ...overrides,
    },
  })
}
