import { parseCiAttributeSchema } from '@/src/lib/servicedesk/ci-attributes'
import type {
  SdConfigItemChildRow,
  SdConfigItemRefRow,
  SdConfigItemRow,
} from '@/src/repositories/sd-config-item.repository'
import type { SdConfigItemTypeRow } from '@/src/repositories/sd-config-item-type.repository'
import type { SdLinkedTicketRow } from '@/src/repositories/sd-linked-ticket'
import type {
  SdConfigItemDetailDTO,
  SdConfigItemDTO,
  SdConfigItemTypeDTO,
} from '@/types/sd-config-item'
import {
  toSdCustomFieldValues,
  toSdLinkedTicketDTO,
} from './sd-directory.mapper'

export function toSdConfigItemTypeDTO(
  row: SdConfigItemTypeRow,
): SdConfigItemTypeDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    icon: row.icon,
    color: row.color,
    attributeSchema: parseCiAttributeSchema(row.attributeSchema),
    position: row.position,
    itemsCount: row._count.items,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Relações apontando para registros excluídos aparecem como `null`. */
function live<T extends { deletedAt: Date | null }>(
  value: T | null,
): Omit<T, 'deletedAt'> | null {
  if (!value || value.deletedAt) return null
  const { deletedAt: _deletedAt, ...rest } = value
  return rest
}

export function toSdConfigItemDTO(row: SdConfigItemRow): SdConfigItemDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    code: row.code,
    status: row.status,
    criticality: row.criticality,
    typeId: row.typeId,
    type: row.type,
    parentId: row.parentId,
    parent: live(row.parent),
    customerId: row.customerId,
    customer: live(row.customer),
    departmentId: row.departmentId,
    department: live(row.department),
    ownerId: row.ownerId,
    owner: row.owner,
    serialNumber: row.serialNumber,
    manufacturer: row.manufacturer,
    model: row.model,
    location: row.location,
    ipAddress: row.ipAddress,
    purchasedAt: row.purchasedAt?.toISOString() ?? null,
    warrantyUntil: row.warrantyUntil?.toISOString() ?? null,
    attributes: toSdCustomFieldValues(row.attributes) as Record<
      string,
      string | number | boolean
    >,
    customFields: toSdCustomFieldValues(row.customFields),
    notes: row.notes,
    childrenCount: row._count.children,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdConfigItemDetailDTO(
  row: SdConfigItemRow,
  ancestors: SdConfigItemRefRow[],
  children: SdConfigItemChildRow[],
  tickets: SdLinkedTicketRow[],
): SdConfigItemDetailDTO {
  return {
    ...toSdConfigItemDTO(row),
    // `ancestors` chega do pai direto para a raiz; a UI quer raiz → pai.
    ancestors: [...ancestors]
      .reverse()
      .map((a) => ({ id: a.id, name: a.name, code: a.code })),
    children: children.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      status: c.status,
      typeName: c.type?.name ?? null,
      childrenCount: c._count.children,
    })),
    recentTickets: tickets.map(toSdLinkedTicketDTO),
  }
}
