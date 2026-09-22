import type { SdLinkedTicketRow } from '@/src/repositories/sd-linked-ticket'
import type {
  SdCustomFieldValuesDTO,
  SdLinkedTicketDTO,
} from '@/types/sd-directory'

export function toSdLinkedTicketDTO(row: SdLinkedTicketRow): SdLinkedTicketDTO {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    title: row.title,
    phaseName: row.phase.name,
    phaseCategory: row.phase.category,
    createdAt: row.createdAt.toISOString(),
  }
}

/** JSON de campos customizados → objeto (valores fora de objeto viram `{}`). */
export function toSdCustomFieldValues(value: unknown): SdCustomFieldValuesDTO {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as SdCustomFieldValuesDTO
  }
  return {}
}
