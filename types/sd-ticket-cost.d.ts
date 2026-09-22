import type { SdUserSummaryDTO } from './sd-ticket'

export type SdCostCategoryDTO =
  | 'LABOR'
  | 'TRAVEL'
  | 'MATERIAL'
  | 'SERVICE'
  | 'LICENSE'
  | 'OTHER'

export interface SdTicketCostDTO {
  id: string
  ticketId: string
  category: SdCostCategoryDTO
  description: string
  /** Decimal serializado (`"1.50"`). */
  quantity: string
  unitCost: string
  /** Quantidade × custo unitário (`"225.00"`). */
  total: string
  billable: boolean
  incurredAt: string
  /** Técnico a quem o custo se refere. */
  user: SdUserSummaryDTO | null
  createdBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}

export interface SdTicketCostSummaryDTO {
  total: string
  billable: string
  nonBillable: string
  /** Só categorias com lançamentos, em ordem decrescente de total. */
  byCategory: { category: SdCostCategoryDTO; total: string }[]
}

export interface SdTicketCostListDTO {
  items: SdTicketCostDTO[]
  summary: SdTicketCostSummaryDTO
}
