export type CrmBillingTypeDTO = 'ONE_TIME' | 'MONTHLY' | 'YEARLY'

export interface CrmProductDTO {
  id: string
  workspaceId: string
  name: string
  sku: string | null
  description: string | null
  unitPrice: number
  currency: string
  billingType: CrmBillingTypeDTO
  active: boolean
  position: number
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}
