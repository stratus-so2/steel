import type { SdUserSummaryDTO } from './sd-ticket'

export type SdPartStatusDTO =
  | 'REQUESTED'
  | 'RESERVED'
  | 'INSTALLED'
  | 'RETURNED'
  | 'CANCELED'

export interface SdTicketPartDTO {
  id: string
  ticketId: string
  /** Peça do catálogo (`null` = texto livre ou peça excluída do catálogo). */
  partId: string | null
  name: string
  sku: string | null
  quantity: number
  unitCost: string
  total: string
  serialNumber: string | null
  status: SdPartStatusDTO
  notes: string | null
  /** Estoque atual da peça do catálogo (`null` = não controlado). */
  catalogStock: number | null
  /** Próximos status permitidos a partir do atual. */
  nextStatuses: SdPartStatusDTO[]
  createdBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}

export interface SdTicketPartSummaryDTO {
  /** Soma das peças ativas (sem canceladas/devolvidas). */
  total: string
  /** Soma das instaladas. */
  installed: string
  /** Quantidade de linhas ativas. */
  count: number
}

export interface SdTicketPartListDTO {
  items: SdTicketPartDTO[]
  summary: SdTicketPartSummaryDTO
}
