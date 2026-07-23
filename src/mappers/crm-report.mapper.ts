import type { CrmReport } from '@prisma/client'
import type { CrmReportDTO, CrmReportSort } from '@/types/crm-report'

export function toCrmReportDTO(report: CrmReport): CrmReportDTO {
  return {
    id: report.id,
    workspaceId: report.workspaceId,
    name: report.name,
    source: report.source,
    columns: report.columns as string[],
    filters: report.filters as Record<string, unknown>,
    groupBy: report.groupBy,
    sort: report.sort as CrmReportSort | null,
    position: report.position,
    createdById: report.createdById,
    updatedById: report.updatedById,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  }
}
