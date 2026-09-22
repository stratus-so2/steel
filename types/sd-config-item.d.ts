import type { SdCustomerKindDTO } from './sd-customer'
import type { SdCustomFieldValuesDTO, SdLinkedTicketDTO } from './sd-directory'

export type SdCiAttributeTypeDTO =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'

export interface SdCiAttributeDefinitionDTO {
  key: string
  label: string
  type: SdCiAttributeTypeDTO
  options?: string[]
  required?: boolean
}

/** Tipo de item de configuração (CMDB). */
export interface SdConfigItemTypeDTO {
  id: string
  workspaceId: string
  name: string
  icon: string | null
  color: string | null
  attributeSchema: SdCiAttributeDefinitionDTO[]
  position: number
  itemsCount: number
  createdAt: string
  updatedAt: string
}

export type SdConfigItemStatusDTO =
  | 'PLANNED'
  | 'IN_STOCK'
  | 'ACTIVE'
  | 'MAINTENANCE'
  | 'RETIRED'

export type SdRiskLevelDTO = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH'

/** Referência curta a um CI (pai, ancestrais). */
export interface SdConfigItemRefDTO {
  id: string
  name: string
  code: string | null
}

export interface SdConfigItemDTO {
  id: string
  workspaceId: string
  name: string
  code: string | null
  status: SdConfigItemStatusDTO
  criticality: SdRiskLevelDTO
  typeId: string | null
  type: {
    id: string
    name: string
    icon: string | null
    color: string | null
  } | null
  parentId: string | null
  parent: SdConfigItemRefDTO | null
  customerId: string | null
  customer: { id: string; name: string; kind: SdCustomerKindDTO } | null
  departmentId: string | null
  department: { id: string; name: string } | null
  ownerId: string | null
  owner: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
  serialNumber: string | null
  manufacturer: string | null
  model: string | null
  location: string | null
  ipAddress: string | null
  /** ISO. */
  purchasedAt: string | null
  warrantyUntil: string | null
  attributes: Record<string, string | number | boolean>
  customFields: SdCustomFieldValuesDTO
  notes: string | null
  childrenCount: number
  createdById: string
  createdAt: string
  updatedAt: string
}

/** Filho direto exibido na árvore de relacionamento. */
export interface SdConfigItemChildDTO extends SdConfigItemRefDTO {
  status: SdConfigItemStatusDTO
  typeName: string | null
  childrenCount: number
}

export interface SdConfigItemDetailDTO extends SdConfigItemDTO {
  /** Cadeia de pais, da raiz até o pai direto. */
  ancestors: SdConfigItemRefDTO[]
  children: SdConfigItemChildDTO[]
  /** Últimos 10 chamados vinculados ao CI. */
  recentTickets: SdLinkedTicketDTO[]
}
