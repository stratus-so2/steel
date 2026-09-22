import type { SdCustomFieldValuesDTO, SdLinkedTicketDTO } from './sd-directory'

export type SdCustomerKindDTO = 'CLIENT' | 'COMPANY'
export type SdPersonTypeDTO = 'INDIVIDUAL' | 'LEGAL'

/** Cliente ou empresa (`SdCustomer`). Documento e telefones só dígitos. */
export interface SdCustomerDTO {
  id: string
  workspaceId: string
  kind: SdCustomerKindDTO
  personType: SdPersonTypeDTO
  name: string
  tradeName: string | null
  document: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  zipCode: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string
  ibgeCode: string | null
  notes: string | null
  customFields: SdCustomFieldValuesDTO
  active: boolean
  contactsCount: number
  configItemsCount: number
  createdById: string
  createdAt: string
  updatedAt: string
}

/** Contato vinculado ao cliente (aba "Contatos"). */
export interface SdCustomerContactDTO {
  id: string
  name: string
  jobTitle: string | null
  email: string | null
  phone: string | null
  whatsapp: string | null
  isPrimary: boolean
}

export interface SdCustomerDetailDTO extends SdCustomerDTO {
  contacts: SdCustomerContactDTO[]
  /** Últimos 10 chamados como cliente ou empresa. */
  recentTickets: SdLinkedTicketDTO[]
}
