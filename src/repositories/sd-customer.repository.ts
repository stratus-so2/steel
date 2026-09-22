import type {
  Prisma,
  SdCustomer,
  SdCustomerKind,
  SdPersonType,
} from '@prisma/client'
import { sdCustomerNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { ListSdCustomersDTO } from '@/src/schemas/sd-customer.schema'
import { dbError } from './db-error'
import {
  type SdLinkedTicketRow,
  sdLinkedTicketSelect,
} from './sd-linked-ticket'

/** Contagens exibidas na tabela (só vínculos não excluídos). */
const countsInclude = {
  _count: {
    select: {
      contacts: { where: { contact: { deletedAt: null } } },
      configItems: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.SdCustomerInclude

export type SdCustomerWithCounts = Prisma.SdCustomerGetPayload<{
  include: typeof countsInclude
}>

const detailInclude = {
  ...countsInclude,
  contacts: {
    where: { contact: { deletedAt: null } },
    orderBy: [{ isPrimary: 'desc' }, { contact: { name: 'asc' } }],
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          jobTitle: true,
          email: true,
          phone: true,
          whatsapp: true,
        },
      },
    },
  },
} satisfies Prisma.SdCustomerInclude

export type SdCustomerDetailRow = Prisma.SdCustomerGetPayload<{
  include: typeof detailInclude
}>

export interface SdCustomerWriteData {
  kind?: SdCustomerKind
  personType?: SdPersonType
  name?: string
  tradeName?: string | null
  document?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  zipCode?: string | null
  street?: string | null
  number?: string | null
  complement?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  country?: string
  ibgeCode?: string | null
  notes?: string | null
  customFields?: Prisma.InputJsonValue
  active?: boolean
}

export type SdCustomerOptionRow = Pick<
  SdCustomer,
  'id' | 'kind' | 'name' | 'tradeName' | 'document' | 'city' | 'state'
>

function searchWhere(q: string | undefined): Prisma.SdCustomerWhereInput {
  if (!q) return {}
  const contains = { contains: q, mode: 'insensitive' as const }
  const or: Prisma.SdCustomerWhereInput[] = [
    { name: contains },
    { tradeName: contains },
    { document: contains },
    { email: contains },
    { city: contains },
  ]
  // "12.345.678/0001-90" também casa com o documento guardado sem máscara.
  const docChars = q.toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (docChars.length >= 3 && docChars !== q) {
    or.push({ document: { contains: docChars } })
  }
  return { OR: or }
}

export const SdCustomerRepository = {
  async list(
    workspaceId: string,
    filters: ListSdCustomersDTO,
  ): Promise<Result<{ items: SdCustomerWithCounts[]; total: number }>> {
    try {
      const where: Prisma.SdCustomerWhereInput = {
        workspaceId,
        deletedAt: null,
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.active !== undefined ? { active: filters.active } : {}),
        ...(filters.state ? { state: filters.state } : {}),
        ...(filters.city
          ? { city: { equals: filters.city, mode: 'insensitive' } }
          : {}),
        ...searchWhere(filters.q),
      }
      const [items, total] = await prisma.$transaction([
        prisma.sdCustomer.findMany({
          where,
          include: countsInclude,
          orderBy: [{ [filters.sort]: filters.order }, { id: 'asc' }],
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
        }),
        prisma.sdCustomer.count({ where }),
      ])
      return ok({ items, total })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk customers', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdCustomerWithCounts>> {
    try {
      const customer = await prisma.sdCustomer.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: countsInclude,
      })
      if (!customer) return err(sdCustomerNotFound())
      return ok(customer)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk customer', error))
    }
  },

  async findDetail(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdCustomerDetailRow>> {
    try {
      const customer = await prisma.sdCustomer.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: detailInclude,
      })
      if (!customer) return err(sdCustomerNotFound())
      return ok(customer)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk customer detail', error))
    }
  },

  /** Últimos chamados em que o cadastro é o cliente ou a empresa. */
  async listRecentTickets(
    workspaceId: string,
    customerId: string,
    limit = 10,
  ): Promise<Result<SdLinkedTicketRow[]>> {
    try {
      const tickets = await prisma.sdTicket.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [{ customerId }, { companyId: customerId }],
        },
        select: sdLinkedTicketSelect,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(tickets)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk customer tickets', error))
    }
  },

  /** Cadastro não excluído com o documento (opcionalmente ignorando um id). */
  async findByDocument(
    workspaceId: string,
    document: string,
    excludeId?: string,
  ): Promise<Result<SdCustomer | null>> {
    try {
      const customer = await prisma.sdCustomer.findFirst({
        where: {
          workspaceId,
          document,
          deletedAt: null,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      })
      return ok(customer)
    } catch (error) {
      return err(
        dbError('Failed to find ServiceDesk customer by document', error),
      )
    }
  },

  /** Quais destes ids existem (não excluídos) nesta workspace. */
  async findExistingIds(
    workspaceId: string,
    ids: string[],
  ): Promise<Result<string[]>> {
    try {
      if (ids.length === 0) return ok([])
      const rows = await prisma.sdCustomer.findMany({
        where: { workspaceId, deletedAt: null, id: { in: ids } },
        select: { id: true },
      })
      return ok(rows.map((r) => r.id))
    } catch (error) {
      return err(dbError('Failed to check ServiceDesk customers', error))
    }
  },

  async options(
    workspaceId: string,
    query: { q?: string; kind?: SdCustomerKind; limit: number },
  ): Promise<Result<SdCustomerOptionRow[]>> {
    try {
      const rows = await prisma.sdCustomer.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          active: true,
          ...(query.kind ? { kind: query.kind } : {}),
          ...searchWhere(query.q),
        },
        select: {
          id: true,
          kind: true,
          name: true,
          tradeName: true,
          document: true,
          city: true,
          state: true,
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: query.limit,
      })
      return ok(rows)
    } catch (error) {
      return err(
        dbError('Failed to search ServiceDesk customer options', error),
      )
    }
  },

  async create(
    data: SdCustomerWriteData & {
      workspaceId: string
      createdById: string
      name: string
    },
  ): Promise<Result<SdCustomerWithCounts>> {
    try {
      const customer = await prisma.sdCustomer.create({
        data,
        include: countsInclude,
      })
      return ok(customer)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk customer', error))
    }
  },

  async update(
    id: string,
    data: SdCustomerWriteData,
  ): Promise<Result<SdCustomerWithCounts>> {
    try {
      const customer = await prisma.sdCustomer.update({
        where: { id },
        data,
        include: countsInclude,
      })
      return ok(customer)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk customer', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdCustomer.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk customer', error))
    }
  },
}
