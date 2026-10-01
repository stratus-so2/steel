import type { Prisma } from '@prisma/client'
import { sdContactNotFound, sdTicketNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'
import { SD_MESSAGE_INCLUDE } from './sd-ticket-message.repository'

/**
 * Acesso a dados do **portal do contato externo**: os links mágicos
 * (`SdPortalAccess`), o contato que eles representam e o recorte de
 * chamados/mensagens que esse contato pode ver. Sem regra de negócio — o
 * escopo (contato × empresas) chega pronto do service, que é quem decide.
 */

const CONTACT_SELECT = {
  id: true,
  workspaceId: true,
  name: true,
  email: true,
  active: true,
  deletedAt: true,
  customers: {
    orderBy: { isPrimary: 'desc' },
    select: {
      isPrimary: true,
      customer: { select: { id: true, name: true, deletedAt: true } },
    },
  },
} as const satisfies Prisma.SdContactSelect

export type SdPortalContactRow = Prisma.SdContactGetPayload<{
  select: typeof CONTACT_SELECT
}>

const ACCESS_INCLUDE = {
  requestedBy: { select: { id: true, name: true } },
} as const satisfies Prisma.SdPortalAccessInclude

export type SdPortalAccessRow = Prisma.SdPortalAccessGetPayload<{
  include: typeof ACCESS_INCLUDE
}>

export type SdPortalAccessWithContact = Prisma.SdPortalAccessGetPayload<{
  include: {
    requestedBy: { select: { id: true; name: true } }
    contact: { select: typeof CONTACT_SELECT }
    workspace: { select: { id: true; name: true; slug: true; status: true } }
  }
}>

const ACCESS_WITH_CONTACT_INCLUDE = {
  ...ACCESS_INCLUDE,
  contact: { select: CONTACT_SELECT },
  workspace: { select: { id: true, name: true, slug: true, status: true } },
} as const satisfies Prisma.SdPortalAccessInclude

/** Chamado no recorte do portal — nada de SLA, custo, plano nem IA. */
const PORTAL_TICKET_SELECT = {
  id: true,
  workspaceId: true,
  number: true,
  type: true,
  title: true,
  description: true,
  completionPercent: true,
  solution: true,
  resolvedAt: true,
  closedAt: true,
  csatScore: true,
  csatComment: true,
  lastActivityAt: true,
  createdAt: true,
  contactId: true,
  customerId: true,
  companyId: true,
  phase: {
    select: { id: true, name: true, color: true, category: true },
  },
  urgency: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  subcategory: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  company: { select: { id: true, name: true } },
  customer: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
} as const satisfies Prisma.SdTicketSelect

export type SdPortalTicketRow = Prisma.SdTicketGetPayload<{
  select: typeof PORTAL_TICKET_SELECT
}>

/** Quais chamados o contato enxerga (resolvido pelo service). */
export interface SdPortalTicketScope {
  workspaceId: string
  contactId: string
  /** Ids das empresas do contato; vazio = só os chamados dele. */
  customerIds: string[]
}

const CLOSED_CATEGORIES = ['RESOLVED', 'CLOSED', 'CANCELED'] as const

/**
 * O `where` do escopo: o contato é o contato do chamado **ou** (com escopo
 * de empresa ligado) o chamado é de uma empresa dele. Sempre dentro do
 * workspace e fora da lixeira — nunca por id adivinhado.
 */
export function sdPortalTicketWhere(
  scope: SdPortalTicketScope,
): Prisma.SdTicketWhereInput {
  const or: Prisma.SdTicketWhereInput[] = [{ contactId: scope.contactId }]
  if (scope.customerIds.length > 0) {
    or.push(
      { customerId: { in: scope.customerIds } },
      { companyId: { in: scope.customerIds } },
    )
  }
  return { workspaceId: scope.workspaceId, deletedAt: null, OR: or }
}

export const SdPortalRepository = {
  /* --------------------------- links de acesso --------------------------- */

  async createAccess(data: {
    workspaceId: string
    contactId: string
    tokenHash: string
    email: string
    requestedById: string | null
    expiresAt: Date
  }): Promise<Result<SdPortalAccessRow>> {
    try {
      const row = await prisma.sdPortalAccess.create({
        data,
        include: ACCESS_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk portal access', error))
    }
  },

  /** O link pelo hash do token (com contato e workspace); `null` = não existe. */
  async findByTokenHash(
    tokenHash: string,
  ): Promise<Result<SdPortalAccessWithContact | null>> {
    try {
      const row = await prisma.sdPortalAccess.findUnique({
        where: { tokenHash },
        include: ACCESS_WITH_CONTACT_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk portal access', error))
    }
  },

  /** A sessão pelo hash do cookie. */
  async findBySessionHash(
    sessionHash: string,
  ): Promise<Result<SdPortalAccessWithContact | null>> {
    try {
      const row = await prisma.sdPortalAccess.findUnique({
        where: { sessionHash },
        include: ACCESS_WITH_CONTACT_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk portal session', error))
    }
  },

  /**
   * Consome o link: marca `usedAt` e abre a sessão. A condição
   * `usedAt: null` no `WHERE` torna o uso único mesmo com dois cliques ao
   * mesmo tempo — `false` quando o link já tinha sido usado.
   */
  async consume(params: {
    id: string
    usedAt: Date
    sessionHash: string
    sessionExpiresAt: Date
  }): Promise<Result<boolean>> {
    try {
      const result = await prisma.sdPortalAccess.updateMany({
        where: { id: params.id, usedAt: null, revokedAt: null },
        data: {
          usedAt: params.usedAt,
          sessionHash: params.sessionHash,
          sessionExpiresAt: params.sessionExpiresAt,
        },
      })
      return ok(result.count === 1)
    } catch (error) {
      return err(dbError('Failed to open ServiceDesk portal session', error))
    }
  },

  /** Encerra a sessão (sair do portal) sem revogar o registro. */
  async closeSession(id: string): Promise<Result<void>> {
    try {
      await prisma.sdPortalAccess.update({
        where: { id },
        data: { sessionHash: null, sessionExpiresAt: null },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to close ServiceDesk portal session', error))
    }
  },

  /** Revoga um link (e derruba a sessão aberta por ele). */
  async revoke(
    id: string,
    workspaceId: string,
    at: Date,
  ): Promise<Result<SdPortalAccessRow | null>> {
    try {
      const result = await prisma.sdPortalAccess.updateMany({
        where: { id, workspaceId, revokedAt: null },
        data: { revokedAt: at, sessionHash: null, sessionExpiresAt: null },
      })
      if (result.count === 0) return ok(null)
      const row = await prisma.sdPortalAccess.findUnique({
        where: { id },
        include: ACCESS_INCLUDE,
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to revoke ServiceDesk portal access', error))
    }
  },

  /** Revoga os links ainda não usados de um contato (ao emitir outro). */
  async revokePending(contactId: string, at: Date): Promise<Result<number>> {
    try {
      const result = await prisma.sdPortalAccess.updateMany({
        where: { contactId, usedAt: null, revokedAt: null },
        data: { revokedAt: at },
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to revoke ServiceDesk portal links', error))
    }
  },

  /** Histórico de links de um contato (o agente vê na tela do contato). */
  async listByContact(
    workspaceId: string,
    contactId: string,
    limit: number,
  ): Promise<Result<SdPortalAccessRow[]>> {
    try {
      const rows = await prisma.sdPortalAccess.findMany({
        where: { workspaceId, contactId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: ACCESS_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk portal accesses', error))
    }
  },

  /* ------------------------------- contatos ------------------------------ */

  async findContact(
    contactId: string,
    workspaceId: string,
  ): Promise<Result<SdPortalContactRow>> {
    try {
      const row = await prisma.sdContact.findFirst({
        where: { id: contactId, workspaceId, deletedAt: null },
        select: CONTACT_SELECT,
      })
      if (!row) return err(sdContactNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contact', error))
    }
  },

  /**
   * Contatos ativos com este e-mail em workspaces ativos e com o portal
   * ligado — um link por workspace. A busca é `insensitive`: o contato
   * digita como quiser.
   */
  async findActiveContactsByEmail(
    email: string,
  ): Promise<Result<SdPortalContactRow[]>> {
    try {
      const rows = await prisma.sdContact.findMany({
        where: {
          email: { equals: email, mode: 'insensitive' },
          active: true,
          deletedAt: null,
          workspace: {
            status: 'ACTIVE',
            sdSettings: { portalEnabled: true },
            moduleAccess: { some: { module: 'SERVICE_DESK', enabled: true } },
          },
        },
        select: CONTACT_SELECT,
        take: 10,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk contacts', error))
    }
  },

  /* ------------------------------- chamados ------------------------------ */

  async listTickets(params: {
    scope: SdPortalTicketScope
    status: 'open' | 'closed' | 'all'
    q?: string
    qNumber?: number
    page: number
    pageSize: number
  }): Promise<Result<{ items: SdPortalTicketRow[]; total: number }>> {
    const where: Prisma.SdTicketWhereInput = {
      ...sdPortalTicketWhere(params.scope),
    }
    const and: Prisma.SdTicketWhereInput[] = []
    if (params.status === 'open') {
      and.push({ phase: { category: { notIn: [...CLOSED_CATEGORIES] } } })
    } else if (params.status === 'closed') {
      and.push({ phase: { category: { in: [...CLOSED_CATEGORIES] } } })
    }
    if (params.q) {
      const or: Prisma.SdTicketWhereInput[] = [
        { title: { contains: params.q, mode: 'insensitive' } },
      ]
      if (params.qNumber !== undefined) or.push({ number: params.qNumber })
      and.push({ OR: or })
    }
    if (and.length > 0) where.AND = and

    try {
      const [items, total] = await Promise.all([
        prisma.sdTicket.findMany({
          where,
          orderBy: [{ lastActivityAt: 'desc' }, { id: 'asc' }],
          skip: (params.page - 1) * params.pageSize,
          take: params.pageSize,
          select: PORTAL_TICKET_SELECT,
        }),
        prisma.sdTicket.count({ where }),
      ])
      return ok({ items, total })
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk portal tickets', error))
    }
  },

  /**
   * Um chamado do escopo pelo **número** — nunca por id solto, para não
   * existir IDOR por id adivinhado: o escopo entra no mesmo `WHERE`.
   */
  async findTicketByNumber(
    scope: SdPortalTicketScope,
    number: number,
  ): Promise<Result<SdPortalTicketRow>> {
    try {
      const row = await prisma.sdTicket.findFirst({
        where: { ...sdPortalTicketWhere(scope), number },
        select: PORTAL_TICKET_SELECT,
      })
      if (!row) return err(sdTicketNotFound())
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk portal ticket', error))
    }
  },

  /** Só as mensagens públicas e vivas do chamado, da mais antiga à mais nova. */
  async listPublicMessages(
    ticketId: string,
    limit: number,
  ): Promise<
    Result<
      Prisma.SdTicketMessageGetPayload<{ include: typeof SD_MESSAGE_INCLUDE }>[]
    >
  > {
    try {
      const rows = await prisma.sdTicketMessage.findMany({
        where: { ticketId, deletedAt: null, visibility: 'PUBLIC' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: limit,
        include: SD_MESSAGE_INCLUDE,
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk portal messages', error))
    }
  },

  /** Mensagem do contato (sempre pública) com os anexos dela, numa transação. */
  async createContactMessage(data: {
    workspaceId: string
    ticketId: string
    contactId: string
    body: string
    attachments: {
      id: string
      kind: Prisma.SdTicketAttachmentCreateManyInput['kind']
      fileName: string
      mimeType: string
      size: number
      storageKey: string
    }[]
  }): Promise<
    Result<
      Prisma.SdTicketMessageGetPayload<{ include: typeof SD_MESSAGE_INCLUDE }>
    >
  > {
    try {
      const row = await prisma.$transaction(async (tx) => {
        const created = await tx.sdTicketMessage.create({
          data: {
            workspaceId: data.workspaceId,
            ticketId: data.ticketId,
            authorKind: 'CONTACT',
            authorContactId: data.contactId,
            visibility: 'PUBLIC',
            channel: 'PLATFORM',
            body: data.body,
          },
          select: { id: true },
        })
        if (data.attachments.length > 0) {
          await tx.sdTicketAttachment.createMany({
            data: data.attachments.map((file) => ({
              ...file,
              workspaceId: data.workspaceId,
              ticketId: data.ticketId,
              messageId: created.id,
              uploadedById: null,
            })),
          })
        }
        return tx.sdTicketMessage.findUniqueOrThrow({
          where: { id: created.id },
          include: SD_MESSAGE_INCLUDE,
        })
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk portal message', error))
    }
  },

  /**
   * Um anexo do chamado visível ao contato: preso a uma mensagem pública e
   * viva. Anexo interno ou solto de agente nunca sai por aqui.
   */
  async findPublicAttachment(
    attachmentId: string,
    ticketId: string,
  ): Promise<
    Result<{ fileName: string; mimeType: string; storageKey: string } | null>
  > {
    try {
      const row = await prisma.sdTicketAttachment.findFirst({
        where: {
          id: attachmentId,
          ticketId,
          deletedAt: null,
          message: { visibility: 'PUBLIC', deletedAt: null },
        },
        select: { fileName: true, mimeType: true, storageKey: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to find ServiceDesk portal attachment', error))
    }
  },

  /* ----------------------- opções do formulário -------------------------- */

  /** Catálogo, modelos, urgências e campos customizados liberados no portal. */
  async formOptions(workspaceId: string): Promise<
    Result<{
      categories: Prisma.SdCategoryGetPayload<{
        select: {
          id: true
          name: true
          parentId: true
          level: true
          ticketTypes: true
          position: true
        }
      }>[]
      templates: Prisma.SdTicketTemplateGetPayload<{
        select: {
          id: true
          name: true
          description: true
          ticketType: true
          position: true
        }
      }>[]
      urgencies: { id: string; name: string; level: number }[]
      customFields: Prisma.SdCustomFieldDefinitionGetPayload<{
        select: {
          id: true
          key: true
          label: true
          description: true
          type: true
          options: true
          required: true
          ticketTypes: true
          categoryIds: true
          position: true
        }
      }>[]
    }>
  > {
    try {
      const [categories, templates, urgencies, customFields] =
        await Promise.all([
          prisma.sdCategory.findMany({
            where: { workspaceId, active: true, portalVisible: true },
            orderBy: [{ position: 'asc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              parentId: true,
              level: true,
              ticketTypes: true,
              position: true,
            },
          }),
          prisma.sdTicketTemplate.findMany({
            where: { workspaceId, active: true, portalVisible: true },
            orderBy: [{ position: 'asc' }, { name: 'asc' }],
            select: {
              id: true,
              name: true,
              description: true,
              ticketType: true,
              position: true,
            },
          }),
          prisma.sdUrgency.findMany({
            where: { workspaceId },
            orderBy: { level: 'asc' },
            select: { id: true, name: true, level: true },
          }),
          prisma.sdCustomFieldDefinition.findMany({
            where: {
              workspaceId,
              entity: 'TICKET',
              active: true,
              visibleInPortal: true,
            },
            orderBy: [{ position: 'asc' }, { label: 'asc' }],
            select: {
              id: true,
              key: true,
              label: true,
              description: true,
              type: true,
              options: true,
              required: true,
              ticketTypes: true,
              categoryIds: true,
              position: true,
            },
          }),
        ])
      return ok({ categories, templates, urgencies, customFields })
    } catch (error) {
      return err(dbError('Failed to load ServiceDesk portal options', error))
    }
  },
}
