import { createId } from '@paralleldrive/cuid2'
import type { CrmReport, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmReportDTO } from '@/types/crm-report'

export function createFakeCrmReport(overrides?: Partial<CrmReport>): CrmReport {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Pipeline por etapa',
    source: 'opportunity',
    columns: ['name', 'amount'],
    filters: {},
    groupBy: null,
    sort: null,
    position: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmReportDTO(
  overrides?: Partial<CrmReportDTO>,
): CrmReportDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Pipeline por etapa',
    source: 'opportunity',
    columns: ['name', 'amount'],
    filters: {},
    groupBy: null,
    sort: null,
    position: 0,
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmReport(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmReport, 'name' | 'source' | 'position' | 'deletedAt'>
  > & { columns?: Prisma.InputJsonValue },
) {
  return prisma.crmReport.create({
    data: {
      name: 'Seed Report',
      source: 'opportunity',
      columns: ['name'] as Prisma.InputJsonValue,
      filters: {} as Prisma.InputJsonValue,
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}
