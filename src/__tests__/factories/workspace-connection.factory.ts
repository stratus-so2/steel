import { createId } from '@paralleldrive/cuid2'
import type { ModuleKind, WorkspaceModuleConnection } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeWorkspaceConnection(
  overrides?: Partial<WorkspaceModuleConnection>,
): WorkspaceModuleConnection {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    module: 'CRM' as ModuleKind,
    host: 'db.example.com',
    port: 5432,
    username: 'app_user',
    encryptedPassword: '$ba$1$deadbeef',
    database: 'crm_db',
    sslEnabled: true,
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedWorkspaceConnection(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      WorkspaceModuleConnection,
      | 'module'
      | 'host'
      | 'port'
      | 'username'
      | 'encryptedPassword'
      | 'database'
      | 'sslEnabled'
    >
  >,
) {
  return prisma.workspaceModuleConnection.create({
    data: {
      workspaceId,
      createdById,
      module: 'CRM' as ModuleKind,
      host: 'db.example.com',
      port: 5432,
      username: 'app_user',
      encryptedPassword: '$ba$1$deadbeef',
      database: 'crm_db',
      sslEnabled: true,
      ...overrides,
    },
  })
}
