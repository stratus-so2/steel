export interface CrmReportSort {
  field: string
  direction: 'asc' | 'desc'
}

export interface CrmReportDTO {
  id: string
  workspaceId: string
  name: string
  source: string
  columns: string[]
  filters: Record<string, unknown>
  groupBy: string | null
  sort: CrmReportSort | null
  position: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}
