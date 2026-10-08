import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { WorkspaceExportWithRelations } from '@/src/repositories/workspace-export.repository'

/** Ajustes › Exportações: fakes (unit) and seeds (integration/e2e). */

export function createFakeWorkspaceExport(
  overrides?: Partial<WorkspaceExportWithRelations>,
): WorkspaceExportWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    kind: 'DATA',
    status: 'PENDING',
    requestedById: 'u1',
    dayKey: '2026-10-08',
    periodFrom: null,
    periodTo: null,
    storageKey: null,
    fileName: null,
    sizeBytes: null,
    itemCount: null,
    errorMessage: null,
    createdAt: new Date('2026-10-08T12:00:00.000Z'),
    startedAt: null,
    completedAt: null,
    expiresAt: null,
    requestedBy: { id: 'u1', name: 'Ana Admin', email: 'ana@example.com' },
    ...overrides,
  }
}

export async function seedWorkspaceExport(
  workspaceId: string,
  requestedById: string | null,
  overrides?: Partial<
    Omit<Prisma.WorkspaceExportUncheckedCreateInput, 'workspaceId'>
  >,
) {
  return prisma.workspaceExport.create({
    data: {
      workspaceId,
      requestedById,
      kind: 'DATA',
      dayKey: '2026-10-08',
      ...overrides,
    },
  })
}
