import type { SdTicketType } from '@prisma/client'
import {
  formatSdTicketCode,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import type {
  SdPortalAccessRow,
  SdPortalContactRow,
  SdPortalTicketRow,
} from '@/src/repositories/sd-portal.repository'
import type { SdTicketMessageWithRelations } from '@/src/repositories/sd-ticket-message.repository'
import type {
  SdPortalAccessDTO,
  SdPortalCatalogNodeDTO,
  SdPortalCustomerDTO,
  SdPortalCustomFieldDTO,
  SdPortalMessageDTO,
  SdPortalTemplateDTO,
  SdPortalTicketDetailDTO,
  SdPortalTicketSummaryDTO,
} from '@/types/sd-portal'
import type { SdTicketTypeDTO } from '@/types/sd-settings'

/**
 * Prisma → DTO do **portal do contato externo**. O recorte é deliberado:
 * nada de nota interna, custo, peça, aprovação, assinatura, SLA,
 * departamento, rastreabilidade ou IA — só o andamento do pedido. Quem
 * filtra o acesso é o service; aqui a regra é **não expor o que não foi
 * pedido**.
 */

const CLOSED = new Set(['RESOLVED', 'CLOSED', 'CANCELED'])
/** Quem já pode avaliar o atendimento. */
const RATEABLE = new Set(['RESOLVED', 'CLOSED'])

const iso = (date: Date | null): string | null =>
  date ? date.toISOString() : null

/** "Ana Souza Lima" → "Ana S." (o cliente não precisa do nome completo). */
export function sdPortalShortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0].toUpperCase()}.`
}

/** Categoria › subcategoria › serviço, ou `null` quando nada foi informado. */
export function sdPortalSubject(ticket: SdPortalTicketRow): string | null {
  const parts = [ticket.category, ticket.subcategory, ticket.service]
    .filter((node): node is { id: string; name: string } => node !== null)
    .map((node) => node.name)
  return parts.length > 0 ? parts.join(' › ') : null
}

export function toSdPortalCustomerDTOs(
  contact: SdPortalContactRow,
): SdPortalCustomerDTO[] {
  return contact.customers
    .filter((link) => link.customer.deletedAt === null)
    .map((link) => ({
      id: link.customer.id,
      name: link.customer.name,
      isPrimary: link.isPrimary,
    }))
}

export function toSdPortalTicketSummaryDTO(
  ticket: SdPortalTicketRow,
  prefixes: SdTicketPrefixes,
): SdPortalTicketSummaryDTO {
  return {
    id: ticket.id,
    number: ticket.number,
    code: formatSdTicketCode(ticket.type, ticket.number, prefixes),
    type: ticket.type,
    title: ticket.title,
    phase: {
      name: ticket.phase.name,
      color: ticket.phase.color,
      category: ticket.phase.category,
    },
    completionPercent: ticket.completionPercent,
    companyName: ticket.company?.name ?? ticket.customer?.name ?? null,
    assigneeName: ticket.assignee
      ? sdPortalShortName(ticket.assignee.name)
      : null,
    closed: CLOSED.has(ticket.phase.category),
    csatScore: ticket.csatScore,
    lastActivityAt: ticket.lastActivityAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
  }
}

/**
 * Como o contato vê o autor: o nome curto do agente, o nome do outro
 * contato, ou "Equipe de atendimento" quando foi a IA/o sistema.
 */
function messageAuthorName(message: SdTicketMessageWithRelations): string {
  if (message.authorUser) return sdPortalShortName(message.authorUser.name)
  if (message.authorContact) return message.authorContact.name
  return 'Equipe de atendimento'
}

export function toSdPortalMessageDTO(
  message: SdTicketMessageWithRelations,
  viewer: { contactId: string; ticketNumber: number },
): SdPortalMessageDTO {
  const mine = message.authorContactId === viewer.contactId
  const authorName = mine ? 'Você' : messageAuthorName(message)
  return {
    id: message.id,
    authorKind: message.authorKind,
    authorName,
    mine,
    body: message.body,
    attachments: message.attachments.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      url: `/api/servicedesk/portal/tickets/${viewer.ticketNumber}/attachments/${file.id}`,
    })),
    createdAt: message.createdAt.toISOString(),
  }
}

export function toSdPortalTicketDetailDTO(
  ticket: SdPortalTicketRow,
  messages: SdTicketMessageWithRelations[],
  context: { prefixes: SdTicketPrefixes; contactId: string },
): SdPortalTicketDetailDTO {
  const summary = toSdPortalTicketSummaryDTO(ticket, context.prefixes)
  return {
    ...summary,
    description: ticket.description,
    subject: sdPortalSubject(ticket),
    urgencyName: ticket.urgency?.name ?? null,
    solution: ticket.solution,
    resolvedAt: iso(ticket.resolvedAt),
    closedAt: iso(ticket.closedAt),
    csatComment: ticket.csatComment,
    canReply: ticket.phase.category !== 'CANCELED',
    canRate: RATEABLE.has(ticket.phase.category) && ticket.csatScore === null,
    messages: messages.map((message) =>
      toSdPortalMessageDTO(message, {
        contactId: context.contactId,
        ticketNumber: ticket.number,
      }),
    ),
  }
}

/** `pending` | `active` | `used` | `expired` | `revoked`. */
export function sdPortalAccessStatus(
  row: Pick<
    SdPortalAccessRow,
    'revokedAt' | 'usedAt' | 'expiresAt' | 'sessionExpiresAt'
  >,
  now: Date = new Date(),
): SdPortalAccessDTO['status'] {
  if (row.revokedAt) return 'revoked'
  if (row.usedAt) {
    const live =
      row.sessionExpiresAt !== null &&
      row.sessionExpiresAt.getTime() > now.getTime()
    return live ? 'active' : 'used'
  }
  return row.expiresAt.getTime() <= now.getTime() ? 'expired' : 'pending'
}

export function toSdPortalAccessDTO(
  row: SdPortalAccessRow,
  now: Date = new Date(),
): SdPortalAccessDTO {
  return {
    id: row.id,
    contactId: row.contactId,
    email: row.email,
    requestedBy: row.requestedBy,
    expiresAt: row.expiresAt.toISOString(),
    usedAt: iso(row.usedAt),
    sessionExpiresAt: iso(row.sessionExpiresAt),
    revokedAt: iso(row.revokedAt),
    status: sdPortalAccessStatus(row, now),
    createdAt: row.createdAt.toISOString(),
  }
}

/* ------------------------- opções do formulário ------------------------- */

interface CategoryRow {
  id: string
  name: string
  parentId: string | null
  ticketTypes: SdTicketType[]
  position: number
}

/** Monta a árvore do catálogo a partir das linhas visíveis no portal. */
export function toSdPortalCatalogTree(
  rows: CategoryRow[],
): SdPortalCatalogNodeDTO[] {
  const byId = new Map<string, SdPortalCatalogNodeDTO>()
  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      ticketTypes: row.ticketTypes,
      children: [],
    })
  }
  const roots: SdPortalCatalogNodeDTO[] = []
  for (const row of rows) {
    const node = byId.get(row.id) as SdPortalCatalogNodeDTO
    const parent = row.parentId ? byId.get(row.parentId) : undefined
    if (parent) parent.children.push(node)
    else if (!row.parentId) roots.push(node)
  }
  return roots
}

export function toSdPortalTemplateDTO(row: {
  id: string
  name: string
  description: string | null
  ticketType: SdTicketType
}): SdPortalTemplateDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    ticketType: row.ticketType,
  }
}

function toOptionList(value: unknown): { value: string; label: string }[] {
  if (!Array.isArray(value)) return []
  const out: { value: string; label: string }[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const option = item as { value?: unknown; label?: unknown }
    if (typeof option.value !== 'string') continue
    out.push({
      value: option.value,
      label: typeof option.label === 'string' ? option.label : option.value,
    })
  }
  return out
}

export function toSdPortalCustomFieldDTO(row: {
  id: string
  key: string
  label: string
  description: string | null
  type: string
  options: unknown
  required: boolean
  ticketTypes: SdTicketType[]
  categoryIds: string[]
}): SdPortalCustomFieldDTO {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    description: row.description,
    type: row.type,
    required: row.required,
    options: toOptionList(row.options),
    ticketTypes: row.ticketTypes as SdTicketTypeDTO[],
    categoryIds: row.categoryIds,
  }
}
