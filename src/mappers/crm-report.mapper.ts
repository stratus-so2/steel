import type { CrmReport } from '@prisma/client'
import type {
  CrmReportQuery,
  CrmReportSource,
} from '@/src/schemas/crm-report.schema'
import type {
  CrmReportDTO,
  CrmReportFilter,
  CrmReportSort,
} from '@/types/crm-report'

/**
 * Sintetiza uma `CrmReportQuery` (modo join, dataset único) a partir dos
 * campos legados de um relatório antigo — garante que relatórios criados
 * antes do "mega relatório" continuem funcionando sem migração de dados.
 */
export function legacyToQuery(report: CrmReport): CrmReportQuery {
  const source = report.source as CrmReportSource
  const columns = (report.columns as string[]) ?? []
  const filters = (report.filters as unknown as CrmReportFilter[]) ?? []
  const sort = (report.sort as CrmReportSort | null) ?? null
  const groupBy = report.groupBy

  // Em modo agrupado a contagem usa o alias "count" (comportamento legado).
  const namespacedSort = sort
    ? {
        field: sort.field === 'count' ? 'count' : `${source}.${sort.field}`,
        direction: sort.direction,
      }
    : undefined

  return {
    mode: 'join',
    datasets: [{ alias: source, source, filters }],
    joins: [],
    columns: columns.map((c) => `${source}.${c}`),
    group: groupBy
      ? {
          by: [`${source}.${groupBy}`],
          aggregations: [{ fn: 'count', alias: 'count' }],
        }
      : undefined,
    sort: namespacedSort,
  }
}

/** `Prisma.CrmReport` → `CrmReportDTO` (Json → tipos; datas em ISO). */
export function toCrmReportDTO(report: CrmReport): CrmReportDTO {
  return {
    id: report.id,
    workspaceId: report.workspaceId,
    module: report.module,
    name: report.name,
    source: report.source,
    columns: (report.columns as string[]) ?? [],
    filters: (report.filters as unknown as CrmReportFilter[]) ?? [],
    groupBy: report.groupBy,
    sort: (report.sort as CrmReportSort | null) ?? null,
    query: (report.query as CrmReportQuery | null) ?? legacyToQuery(report),
    position: report.position,
    createdById: report.createdById,
    updatedById: report.updatedById,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  }
}
