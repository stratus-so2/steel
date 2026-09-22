import type {
  SdCustomerDetailRow,
  SdCustomerWithCounts,
} from '@/src/repositories/sd-customer.repository'
import type { SdLinkedTicketRow } from '@/src/repositories/sd-linked-ticket'
import type { SdCustomerDetailDTO, SdCustomerDTO } from '@/types/sd-customer'
import {
  toSdCustomFieldValues,
  toSdLinkedTicketDTO,
} from './sd-directory.mapper'

export function toSdCustomerDTO(row: SdCustomerWithCounts): SdCustomerDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    kind: row.kind,
    personType: row.personType,
    name: row.name,
    tradeName: row.tradeName,
    document: row.document,
    email: row.email,
    phone: row.phone,
    whatsapp: row.whatsapp,
    zipCode: row.zipCode,
    street: row.street,
    number: row.number,
    complement: row.complement,
    district: row.district,
    city: row.city,
    state: row.state,
    country: row.country,
    ibgeCode: row.ibgeCode,
    notes: row.notes,
    customFields: toSdCustomFieldValues(row.customFields),
    active: row.active,
    contactsCount: row._count.contacts,
    configItemsCount: row._count.configItems,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdCustomerDetailDTO(
  row: SdCustomerDetailRow,
  tickets: SdLinkedTicketRow[],
): SdCustomerDetailDTO {
  return {
    ...toSdCustomerDTO(row),
    contacts: row.contacts.map((link) => ({
      id: link.contact.id,
      name: link.contact.name,
      jobTitle: link.contact.jobTitle,
      email: link.contact.email,
      phone: link.contact.phone,
      whatsapp: link.contact.whatsapp,
      isPrimary: link.isPrimary,
    })),
    recentTickets: tickets.map(toSdLinkedTicketDTO),
  }
}
