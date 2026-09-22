import type { Prisma, SdConfigItemStatus, SdRiskLevel } from '@prisma/client'
import { sdConfigItemNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { ListSdConfigItemsDTO } from '@/src/schemas/sd-config-item.schema'
import { dbError } from './db-error'
import {
  type SdLinkedTicketRow,
  sdLinkedTicketSelect,
} from './sd-linked-ticket'

const liveChildren = { where: { deletedAt: null } } as const

const itemInclude = {
  type: { select: { id: true, name: true, icon: true, color: true } },
  parent: { select: { id: true, name: true, code: true, deletedAt: true } },
  customer: {
    select: { id: true, name: true, kind: true, deletedAt: true },
  },
  department: { select: { id: true, name: true, deletedAt: true } },
  owner: { select: { id: true, name: true, email: true, image: true } },
  _count: { select: { children: liveChildren } },
} satisfies Prisma.SdConfigItemInclude

export type SdConfigItemRow = Prisma.SdConfigItemGetPayload<{
  include: typeof itemInclude
}>

const childSelect = {
  id: true,
  name: true,
  code: true,
  status: true,
  type: { select: { name: true } },
  _count: { select: { children: liveChildren } },
} satisfies Prisma.SdConfigItemSelect

export type SdConfigItemChildRow = Prisma.SdConfigItemGetPayload<{
  select: typeof childSelect
}>

export interface SdConfigItemRefRow {
  id: string
  name: string
  code: string | null
  parentId: string | null
}

export interface SdConfigItemWriteData {
  name?: string
  typeId?: string | null
  parentId?: string | null
  code?: string | null
  status?: SdConfigItemStatus
  criticality?: SdRiskLevel
  customerId?: string | null
  departmentId?: string | null
  ownerId?: string | null
  serialNumber?: string | null
  manufacturer?: string | null
  model?: string | null
  location?: string | null
  ipAddress?: string | null
  purchasedAt?: Date | null
  warrantyUntil?: Date | null
  attributes?: Prisma.InputJsonValue
  customFields?: Prisma.InputJsonValue
  notes?: string | null
}

export interface SdConfigItemOptionRow {
  id: string
  name: string
  code: string | null
  type: { name: string } | null
  customer: { name: string } | null
}

/** Profundidade máxima percorrida na cadeia de pais (guarda contra ciclos). */
export const SD_CI_MAX_DEPTH = 50

const NULLABLE_SORTS = new Set<string>(['code', 'warrantyUntil'])

function searchWhere(q: string | undefined): Prisma.SdConfigItemWhereInput {
  if (!q) return {}
  const contains = { contains: q, mode: 'insensitive' as const }
  return {
    OR: [
      { name: contains },
      { code: contains },
      { serialNumber: contains },
      { manufacturer: contains },
      { model: contains },
      { location: contains },
      { ipAddress: contains },
    ],
  }
}

function warrantyWhere(
  days: number | undefined,
  now: Date,
): Prisma.SdConfigItemWhereInput {
  if (days === undefined) return {}
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + days + 1)
  return { warrantyUntil: { gte: start, lt: end } }
}

export const SdConfigItemRepository = {
  async list(
    workspaceId: string,
    filters: ListSdConfigItemsDTO,
    now: Date = new Date(),
  ): Promise<Result<{ items: SdConfigItemRow[]; total: number }>> {
    try {
      const where: Prisma.SdConfigItemWhereInput = {
        workspaceId,
        deletedAt: null,
        ...(filters.typeId ? { typeId: filters.typeId } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.criticality ? { criticality: filters.criticality } : {}),
        ...(filters.customerId ? { customerId: filters.customerId } : {}),
        ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
        ...(filters.parentId ? { parentId: filters.parentId } : {}),
        ...warrantyWhere(filters.warrantyExpiringInDays, now),
        ...searchWhere(filters.q),
      }
      const [items, total] = await prisma.$transaction([
        prisma.sdConfigItem.findMany({
          where,
          include: itemInclude,
          orderBy: [
            // Colunas opcionais: vazios sempre no fim.
            {
              [filters.sort]: NULLABLE_SORTS.has(filters.sort)
                ? { sort: filters.order, nulls: 'last' }
                : filters.order,
            },
            { id: 'asc' },
          ],
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
        }),
        prisma.sdConfigItem.count({ where }),
      ])
      return ok({ items, total })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk config items', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdConfigItemRow>> {
    try {
      const item = await prisma.sdConfigItem.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: itemInclude,
      })
      if (!item) return err(sdConfigItemNotFound())
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk config item', error))
    }
  },

  async listChildren(
    workspaceId: string,
    parentId: string,
  ): Promise<Result<SdConfigItemChildRow[]>> {
    try {
      const children = await prisma.sdConfigItem.findMany({
        where: { workspaceId, parentId, deletedAt: null },
        select: childSelect,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
      })
      return ok(children)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk CI children', error))
    }
  },

  /**
   * Cadeia de pais a partir de `startId` (inclusive), subindo até a raiz —
   * no máximo {@link SD_CI_MAX_DEPTH} níveis. Pais excluídos encerram a
   * cadeia.
   */
  async listChain(
    workspaceId: string,
    startId: string,
  ): Promise<Result<SdConfigItemRefRow[]>> {
    try {
      const chain: SdConfigItemRefRow[] = []
      const seen = new Set<string>()
      let currentId: string | null = startId
      while (
        currentId &&
        !seen.has(currentId) &&
        chain.length < SD_CI_MAX_DEPTH
      ) {
        seen.add(currentId)
        const row: SdConfigItemRefRow | null =
          await prisma.sdConfigItem.findFirst({
            where: { id: currentId, workspaceId, deletedAt: null },
            select: { id: true, name: true, code: true, parentId: true },
          })
        if (!row) break
        chain.push(row)
        currentId = row.parentId
      }
      return ok(chain)
    } catch (error) {
      return err(dbError('Failed to walk ServiceDesk CI parents', error))
    }
  },

  async listRecentTickets(
    workspaceId: string,
    configItemId: string,
    limit = 10,
  ): Promise<Result<SdLinkedTicketRow[]>> {
    try {
      const tickets = await prisma.sdTicket.findMany({
        where: { workspaceId, deletedAt: null, configItemId },
        select: sdLinkedTicketSelect,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(tickets)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk CI tickets', error))
    }
  },

  /** Departamento ativo (não excluído) desta workspace? */
  async departmentExists(
    workspaceId: string,
    departmentId: string,
  ): Promise<Result<boolean>> {
    try {
      const found = await prisma.sdDepartment.findFirst({
        where: { id: departmentId, workspaceId, deletedAt: null },
        select: { id: true },
      })
      return ok(found !== null)
    } catch (error) {
      return err(dbError('Failed to check ServiceDesk department', error))
    }
  },

  async options(
    workspaceId: string,
    query: {
      q?: string
      customerId?: string
      excludeId?: string
      limit: number
    },
  ): Promise<Result<SdConfigItemOptionRow[]>> {
    try {
      const rows = await prisma.sdConfigItem.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          status: { not: 'RETIRED' },
          ...(query.customerId ? { customerId: query.customerId } : {}),
          ...(query.excludeId ? { id: { not: query.excludeId } } : {}),
          ...searchWhere(query.q),
        },
        select: {
          id: true,
          name: true,
          code: true,
          type: { select: { name: true } },
          customer: { select: { name: true } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: query.limit,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to search ServiceDesk CI options', error))
    }
  },

  async create(
    data: SdConfigItemWriteData & {
      workspaceId: string
      createdById: string
      name: string
    },
  ): Promise<Result<SdConfigItemRow>> {
    try {
      const item = await prisma.sdConfigItem.create({
        data,
        include: itemInclude,
      })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk config item', error))
    }
  },

  async update(
    id: string,
    data: SdConfigItemWriteData,
  ): Promise<Result<SdConfigItemRow>> {
    try {
      const item = await prisma.sdConfigItem.update({
        where: { id },
        data,
        include: itemInclude,
      })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk config item', error))
    }
  },

  /** Soft delete; os filhos sobem para o pai do item excluído. */
  async softDelete(id: string, parentId: string | null): Promise<Result<void>> {
    try {
      await prisma.$transaction([
        prisma.sdConfigItem.updateMany({
          where: { parentId: id },
          data: { parentId },
        }),
        prisma.sdConfigItem.update({
          where: { id },
          data: { deletedAt: new Date(), parentId: null },
        }),
      ])
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk config item', error))
    }
  },
}
