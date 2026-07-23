import type { CrmBillingTypeDTO } from './crm-product'

export interface CrmOpportunityDTO {
  id: string
  name: string
  amount: number | null
  closeDate: string | null
  pipelineId: string
  stageId: string
  companyId: string | null
  pointOfContactId: string | null
  ownerId: string | null
  source: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
  /** Valores de campos customizados achatados, chave `cf_<definitionId>`. */
  customFields?: Record<string, unknown>
}

export interface CrmOpportunityLineItemDTO {
  id: string
  opportunityId: string
  productId: string | null
  name: string
  quantity: number
  unitPrice: number
  discountPct: number
  billingType: CrmBillingTypeDTO
  total: number
  position: number
  createdAt: string
  updatedAt: string
}
