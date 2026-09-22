import type { SdCustomerKindDTO } from './sd-customer'
import type { SdCustomFieldValuesDTO, SdLinkedTicketDTO } from './sd-directory'

/** Cliente/empresa vinculado ao contato. */
export interface SdContactCustomerDTO {
  id: string
  name: string
  kind: SdCustomerKindDTO
  isPrimary: boolean
}

/** Usuário da plataforma vinculado ao contato. */
export interface SdContactUserDTO {
  id: string
  name: string
  email: string
  image: string | null
}

export interface SdContactDTO {
  id: string
  workspaceId: string
  name: string
  jobTitle: string | null
  email: string | null
  /** Só dígitos com DDI (ex.: `5511987654321`). */
  phone: string | null
  whatsapp: string | null
  userId: string | null
  user: SdContactUserDTO | null
  notes: string | null
  customFields: SdCustomFieldValuesDTO
  active: boolean
  /** Principal primeiro. */
  customers: SdContactCustomerDTO[]
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface SdContactDetailDTO extends SdContactDTO {
  /** Últimos 10 chamados do contato. */
  recentTickets: SdLinkedTicketDTO[]
}
