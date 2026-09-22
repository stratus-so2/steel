import { createId } from '@paralleldrive/cuid2'
import type { Prisma, SdConfigItem, SdConfigItemType } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { SdConfigItemRow } from '@/src/repositories/sd-config-item.repository'
import type { SdConfigItemTypeRow } from '@/src/repositories/sd-config-item-type.repository'

export function createFakeSdConfigItemType(
  overrides?: Partial<SdConfigItemTypeRow>,
): SdConfigItemTypeRow {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    name: 'Servidor',
    icon: 'server',
    color: '#2563eb',
    attributeSchema: [
      { key: 'hostname', label: 'Hostname', type: 'text', required: true },
      { key: 'ram_gb', label: 'RAM (GB)', type: 'number' },
    ],
    position: 0,
    createdAt: now,
    updatedAt: now,
    _count: { items: 0 },
    ...overrides,
  }
}

export function createFakeSdConfigItem(
  overrides?: Partial<SdConfigItemRow>,
): SdConfigItemRow {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    typeId: null,
    parentId: null,
    name: 'SRV-01',
    code: 'PAT-0001',
    status: 'ACTIVE',
    criticality: 'MEDIUM',
    customerId: null,
    departmentId: null,
    ownerId: null,
    serialNumber: null,
    manufacturer: 'Dell',
    model: 'R740',
    location: 'Datacenter SP',
    ipAddress: '10.0.0.10',
    purchasedAt: null,
    warrantyUntil: null,
    attributes: {},
    customFields: {},
    notes: null,
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    type: null,
    parent: null,
    customer: null,
    department: null,
    owner: null,
    _count: { children: 0 },
    ...overrides,
  }
}

export async function seedSdConfigItemType(
  workspaceId: string,
  overrides?: Partial<Omit<Prisma.SdConfigItemTypeUncheckedCreateInput, 'id'>>,
): Promise<SdConfigItemType> {
  return prisma.sdConfigItemType.create({
    data: {
      workspaceId,
      name: `Tipo ${createId().slice(0, 6)}`,
      ...overrides,
    },
  })
}

export async function seedSdConfigItem(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Omit<Prisma.SdConfigItemUncheckedCreateInput, 'id'>>,
): Promise<SdConfigItem> {
  return prisma.sdConfigItem.create({
    data: {
      workspaceId,
      createdById,
      name: `CI ${createId().slice(0, 6)}`,
      ...overrides,
    },
  })
}
