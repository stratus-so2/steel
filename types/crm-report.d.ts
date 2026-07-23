import type {
  CrmReportFilter,
  CrmReportQuery,
  CrmReportSort,
} from '@/src/schemas/crm-report.schema'

export type { CrmReportFilter, CrmReportSort }

export interface CrmReportDTO {
  id: string
  workspaceId: string
  name: string
  source: string
  columns: string[]
  filters: CrmReportFilter[]
  groupBy: string | null
  sort: CrmReportSort | null
  /** Query normalizada do mega-relatório (join/union). Sempre presente na
   * leitura — sintetizada a partir dos campos legados quando ausente no DB. */
  query: CrmReportQuery
  position: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}
