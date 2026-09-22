import type { SdContactRow } from '@/src/repositories/sd-contact.repository'
import type { SdLinkedTicketRow } from '@/src/repositories/sd-linked-ticket'
import type { SdContactDetailDTO, SdContactDTO } from '@/types/sd-contact'
import {
  toSdCustomFieldValues,
  toSdLinkedTicketDTO,
} from './sd-directory.mapper'

export function toSdContactDTO(row: SdContactRow): SdContactDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    jobTitle: row.jobTitle,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    userId: row.userId,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          image: row.user.image,
        }
      : null,
    notes: row.notes,
    customFields: toSdCustomFieldValues(row.customFields),
    active: row.active,
    customers: row.customers.map((link) => ({
      id: link.customer.id,
      name: link.customer.name,
      kind: link.customer.kind,
      isPrimary: link.isPrimary,
    })),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdContactDetailDTO(
  row: SdContactRow,
  tickets: SdLinkedTicketRow[],
): SdContactDetailDTO {
  return {
    ...toSdContactDTO(row),
    recentTickets: tickets.map(toSdLinkedTicketDTO),
  }
}
