export type CrmQuotaPeriodDTO = 'MONTH' | 'QUARTER'

export interface CrmQuotaDTO {
  id: string
  workspaceId: string
  ownerId: string
  period: CrmQuotaPeriodDTO
  periodKey: string
  targetAmount: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}
