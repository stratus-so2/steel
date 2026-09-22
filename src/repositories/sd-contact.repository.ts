import type { Prisma, SdContact } from '@prisma/client'
import { sdContactNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { ListSdContactsDTO } from '@/src/schemas/sd-contact.schema'
import { dbError } from './db-error'
import {
  type SdLinkedTicketRow,
  sdLinkedTicketSelect,
} from './sd-linked-ticket'

const contactInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
  customers: {
    where: { customer: { deletedAt: null } },
    orderBy: [{ isPrimary: 'desc' }, { customer: { name: 'asc' } }],
    include: { customer: { select: { id: true, name: true, kind: true } } },
  },
} satisfies Prisma.SdContactInclude

export type SdContactRow = Prisma.SdContactGetPayload<{
  include: typeof contactInclude
}>

export interface SdContactWriteData {
  name?: string
  jobTitle?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  userId?: string | null
  notes?: string | null
  customFields?: Prisma.InputJsonValue
  active?: boolean
}

export interface SdContactLinkInput {
  customerId: string
  isPrimary: boolean
}

export type SdContactOptionRow = Pick<
  SdContact,
  'id' | 'name' | 'jobTitle' | 'email' | 'whatsapp'
> & { customers: { customer: { name: string } }[] }

function searchWhere(q: string | undefined): Prisma.SdContactWhereInput {
  if (!q) return {}
  const contains = { contains: q, mode: 'insensitive' as const }
  const or: Prisma.SdContactWhereInput[] = [
    { name: contains },
    { jobTitle: contains },
    { email: contains },
  ]
  // Telefones são guardados só com dígitos: "(11) 9876" também casa.
  const digits = q.replace(/\D/g, '')
  if (digits.length >= 3) {
    or.push({ phone: { contains: digits } }, { whatsapp: { contains: digits } })
  }
  return { OR: or }
}

function customerWhere(
  customerId: string | undefined,
): Prisma.SdContactWhereInput {
  return customerId ? { customers: { some: { customerId } } } : {}
}

export const SdContactRepository = {
  async list(
    workspaceId: string,
    filters: ListSdContactsDTO,
  ): Promise<Result<{ items: SdContactRow[]; total: number }>> {
    try {
      const where: Prisma.SdContactWhereInput = {
        workspaceId,
        deletedAt: null,
        ...(filters.active !== undefined ? { active: filters.active } : {}),
        ...customerWhere(filters.customerId),
        ...searchWhere(filters.q),
      }
      const [items, total] = await prisma.$transaction([
        prisma.sdContact.findMany({
          where,
          include: contactInclude,
          orderBy: [{ [filters.sort]: filters.order }, { id: 'asc' }],
          skip: (filters.page - 1) * filters.pageSize,
          take: filters.pageSize,
        }),
        prisma.sdContact.count({ where }),
      ])
      return ok({ items, total })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk contacts', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdContactRow>> {
    try {
      const contact = await prisma.sdContact.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: contactInclude,
      })
      if (!contact) return err(sdContactNotFound())
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contact', error))
    }
  },

  async listRecentTickets(
    workspaceId: string,
    contactId: string,
    limit = 10,
  ): Promise<Result<SdLinkedTicketRow[]>> {
    try {
      const tickets = await prisma.sdTicket.findMany({
        where: { workspaceId, deletedAt: null, contactId },
        select: sdLinkedTicketSelect,
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(tickets)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk contact tickets', error))
    }
  },

  /**
   * Primeiro contato ativo (mais recente) com um dos números de WhatsApp ou
   * com o e-mail (sem diferenciar maiúsculas).
   */
  async findByChannel(
    workspaceId: string,
    channel: { whatsapp: string[]; email?: string },
  ): Promise<Result<SdContactRow | null>> {
    try {
      const or: Prisma.SdContactWhereInput[] = []
      if (channel.whatsapp.length > 0) {
        or.push(
          { whatsapp: { in: channel.whatsapp } },
          { phone: { in: channel.whatsapp } },
        )
      }
      if (channel.email) {
        or.push({ email: { equals: channel.email, mode: 'insensitive' } })
      }
      if (or.length === 0) return ok(null)
      const contact = await prisma.sdContact.findFirst({
        where: { workspaceId, deletedAt: null, active: true, OR: or },
        include: contactInclude,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      })
      return ok(contact)
    } catch (error) {
      return err(
        dbError('Failed to find ServiceDesk contact by channel', error),
      )
    }
  },

  async options(
    workspaceId: string,
    query: { q?: string; customerId?: string; limit: number },
  ): Promise<Result<SdContactOptionRow[]>> {
    try {
      const rows = await prisma.sdContact.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          active: true,
          ...customerWhere(query.customerId),
          ...searchWhere(query.q),
        },
        select: {
          id: true,
          name: true,
          jobTitle: true,
          email: true,
          whatsapp: true,
          customers: {
            where: { customer: { deletedAt: null } },
            orderBy: { isPrimary: 'desc' },
            take: 1,
            select: { customer: { select: { name: true } } },
          },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        take: query.limit,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to search ServiceDesk contact options', error))
    }
  },

  /** O usuário é membro desta workspace? */
  async isWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<Result<boolean>> {
    try {
      const membership = await prisma.membership.findFirst({
        where: { workspaceId, userId },
        select: { id: true },
      })
      return ok(membership !== null)
    } catch (error) {
      return err(dbError('Failed to check workspace membership', error))
    }
  },

  async create(
    data: SdContactWriteData & {
      workspaceId: string
      createdById: string
      name: string
    },
    links: SdContactLinkInput[],
  ): Promise<Result<SdContactRow>> {
    try {
      const contact = await prisma.sdContact.create({
        data: { ...data, customers: { create: links } },
        include: contactInclude,
      })
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk contact', error))
    }
  },

  /** Atualiza; `links` (quando enviado) substitui todos os vínculos. */
  async update(
    id: string,
    data: SdContactWriteData,
    links?: SdContactLinkInput[],
  ): Promise<Result<SdContactRow>> {
    try {
      const contact = await prisma.sdContact.update({
        where: { id },
        data: {
          ...data,
          ...(links ? { customers: { deleteMany: {}, create: links } } : {}),
        },
        include: contactInclude,
      })
      return ok(contact)
    } catch (error) {
      return err(dbError('Failed to update ServiceDesk contact', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.sdContact.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete ServiceDesk contact', error))
    }
  },
}
