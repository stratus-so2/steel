import { createId } from '@paralleldrive/cuid2'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdAttachmentInvalid,
  sdAttachmentNotFound,
  sdCsatAlreadySubmitted,
  sdCsatNotAvailable,
  sdKbArticleNotFound,
  sdTicketForbidden,
  sdTicketNotFound,
  storageError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { sanitizeSdHtml } from '@/src/lib/servicedesk/html'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { parseSdTicketCode } from '@/src/lib/servicedesk/ticket-code'
import {
  SD_ATTACHMENT_MAX_BYTES,
  SD_TICKET_BUCKET,
  sdAttachmentKey,
  sdAttachmentKind,
  sdBaseMime,
} from '@/src/lib/servicedesk/ticket-files'
import { ensureBucket, getObject, putObject } from '@/src/lib/storage/s3'
import {
  toSdKbArticleDTO,
  toSdKbArticleSummaryDTO,
  toSdKbSearchResultDTO,
} from '@/src/mappers/sd-kb-article.mapper'
import {
  toSdPortalCatalogTree,
  toSdPortalCustomFieldDTO,
  toSdPortalMessageDTO,
  toSdPortalTemplateDTO,
  toSdPortalTicketDetailDTO,
  toSdPortalTicketSummaryDTO,
} from '@/src/mappers/sd-portal.mapper'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbCatalogRepository } from '@/src/repositories/sd-kb-catalog.repository'
import {
  SdPortalRepository,
  type SdPortalTicketRow,
  type SdPortalTicketScope,
} from '@/src/repositories/sd-portal.repository'
import { SdTicketRepository } from '@/src/repositories/sd-ticket.repository'
import { SdTicketCsatRepository } from '@/src/repositories/sd-ticket-csat.repository'
import type {
  CreateSdPortalMessageDTO,
  CreateSdPortalTicketDTO,
  ListSdPortalTicketsDTO,
  SearchSdPortalKbDTO,
} from '@/src/schemas/sd-portal.schema'
import type {
  SdPortalFormOptionsDTO,
  SdPortalKbArticleDTO,
  SdPortalKbListDTO,
  SdPortalMessageDTO,
  SdPortalTicketDetailDTO,
  SdPortalTicketSummaryDTO,
} from '@/types/sd-portal'
import { fireSdAutomations } from './sd-automation-engine'
import type { SdPortalSessionContext } from './sd-portal-access.service'
import { SdTicketEngine, sdContactActor } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { SdTicketNotifier } from './sd-ticket-notifier'

/**
 * O que o **contato externo** faz no portal (`/suporte`): listar os
 * chamados do escopo dele, abrir um chamado novo, acompanhar o histórico,
 * responder (com anexo), avaliar o atendimento e ler a base de conhecimento
 * publicada no portal.
 *
 * Segurança (a parte sensível desta fatia):
 * - **todo** acesso é filtrado aqui, nunca na UI: o `SdPortalSessionContext`
 *   traz o contato e as empresas dele e o `WHERE` do repositório sempre
 *   carrega esse escopo;
 * - chamados são resolvidos por **código/número + escopo**, nunca por id, de
 *   modo que não existe IDOR por id adivinhado;
 * - só mensagens públicas e anexos presos a elas saem daqui — nota interna,
 *   custo, peça, aprovação, assinatura e rastreabilidade ficam de fora;
 * - cada movimento do contato entra na rastreabilidade do chamado com ator
 *   `CONTACT` e é auditado.
 */

/** Mensagens carregadas na tela do chamado. */
const MESSAGE_LIMIT = 200

/** Prévia do texto na notificação da equipe. */
const PREVIEW_LENGTH = 140

/** Nota do CSAT: só com o chamado resolvido/fechado. */
const RATEABLE = new Set(['RESOLVED', 'CLOSED'])

export interface SdPortalUpload {
  buffer: Buffer
  contentType: string
  fileName: string
}

export interface SdPortalFile {
  body: Buffer
  contentType: string
  fileName: string
}

function scopeOf(context: SdPortalSessionContext): SdPortalTicketScope {
  return {
    workspaceId: context.workspace.id,
    contactId: context.contact.id,
    customerIds: context.customerIds,
  }
}

function preview(body: string, attachments: number): string {
  const text = body.replace(/\s+/g, ' ').trim()
  if (!text) return `${attachments} anexo(s)`
  return text.length > PREVIEW_LENGTH
    ? `${text.slice(0, PREVIEW_LENGTH - 1)}…`
    : text
}

function displayName(fileName: string): string {
  const base = fileName.replace(/^.*[\\/]/, '').trim()
  return (base || 'arquivo').slice(0, 255)
}

/** Texto digitado pelo contato → HTML seguro (parágrafos por linha). */
export function sdPortalTextToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
  if (paragraphs.length === 0) return ''
  const html = paragraphs
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return sanitizeSdHtml(html)
}

/**
 * Resolve o chamado pelo que veio na URL (`INC-000123` ou `123`) **dentro do
 * escopo**. Id de chamado não é aceito: o portal externo navega por código.
 */
async function resolveTicket(
  context: SdPortalSessionContext,
  ref: string,
): Promise<Result<SdPortalTicketRow>> {
  const parsed = parseSdTicketCode(ref, context.prefixes)
  if (!parsed) return err(sdTicketNotFound())
  const ticket = await SdPortalRepository.findTicketByNumber(
    scopeOf(context),
    parsed.number,
  )
  if (!ticket.ok) return ticket
  if (parsed.type && parsed.type !== ticket.value.type) {
    return err(sdTicketNotFound())
  }
  return ticket
}

/** Avisa a equipe (responsável + participantes) de algo do contato. */
async function notifyTeam(
  context: SdPortalSessionContext,
  ticket: { id: string; number: number; code: string; title: string },
  title: string,
  body: string,
): Promise<void> {
  const full = await SdTicketRepository.findById(
    ticket.id,
    context.workspace.id,
  )
  if (!full.ok) return
  await SdTicketNotifier.notify({
    workspaceId: context.workspace.id,
    userIds: [
      full.value.assigneeId,
      ...full.value.participants.map((p) => p.userId),
    ],
    kind: 'SD_TICKET_MESSAGE',
    ticket: { number: ticket.number, code: ticket.code, title: ticket.title },
    title,
    body,
  })
}

export const SdPortalService = {
  /** Chamados do escopo do contato (abertos, encerrados ou todos). */
  async listTickets(
    context: SdPortalSessionContext,
    query: ListSdPortalTicketsDTO,
  ): Promise<
    Result<{
      items: SdPortalTicketSummaryDTO[]
      total: number
      page: number
      pageSize: number
    }>
  > {
    const parsed = query.q ? parseSdTicketCode(query.q, context.prefixes) : null
    const page = await SdPortalRepository.listTickets({
      scope: scopeOf(context),
      status: query.status,
      q: query.q,
      qNumber: parsed?.number,
      page: query.page,
      pageSize: query.pageSize,
    })
    if (!page.ok) return page
    return ok({
      items: page.value.items.map((ticket) =>
        toSdPortalTicketSummaryDTO(ticket, context.prefixes),
      ),
      total: page.value.total,
      page: query.page,
      pageSize: query.pageSize,
    })
  },

  /** Um chamado do escopo, com o histórico público. */
  async getTicket(
    context: SdPortalSessionContext,
    ref: string,
  ): Promise<Result<SdPortalTicketDetailDTO>> {
    const ticket = await resolveTicket(context, ref)
    if (!ticket.ok) return ticket

    const messages = await SdPortalRepository.listPublicMessages(
      ticket.value.id,
      MESSAGE_LIMIT,
    )
    if (!messages.ok) return messages

    return ok(
      toSdPortalTicketDetailDTO(ticket.value, messages.value, {
        prefixes: context.prefixes,
        contactId: context.contact.id,
      }),
    )
  },

  /**
   * Abre um chamado pelo portal: canal `PORTAL`, contato como autor e a
   * empresa principal dele já vinculada. O tipo precisa estar liberado em
   * `portalTicketTypes`; catálogo e modelo, marcados como `portalVisible`
   * (o motor confere com `portal: true`).
   */
  async createTicket(
    context: SdPortalSessionContext,
    dto: CreateSdPortalTicketDTO,
  ): Promise<Result<SdPortalTicketSummaryDTO>> {
    const { settings } = context
    if (!settings.portalTicketTypes.includes(dto.type)) {
      return err(
        sdTicketForbidden(
          'Este tipo de chamado não pode ser aberto pelo portal',
        ),
      )
    }

    const primary =
      context.customers.find((customer) => customer.isPrimary) ??
      context.customers[0] ??
      null

    const created = await SdTicketEngine.create(
      context.workspace.id,
      {
        type: dto.type,
        title: dto.title,
        ...(dto.description
          ? { description: sdPortalTextToHtml(dto.description) }
          : {}),
        ...(dto.templateId ? { templateId: dto.templateId } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.subcategoryId ? { subcategoryId: dto.subcategoryId } : {}),
        ...(dto.serviceId ? { serviceId: dto.serviceId } : {}),
        ...(dto.urgencyId ? { urgencyId: dto.urgencyId } : {}),
        ...(dto.customFields ? { customFields: dto.customFields } : {}),
        contactId: context.contact.id,
        ...(primary ? { customerId: primary.id, companyId: primary.id } : {}),
        channel: 'PORTAL',
        portal: true,
      },
      sdContactActor({ id: context.contact.id, name: context.contact.name }),
      { settings, prefixes: context.prefixes },
    )
    if (!created.ok) {
      auditMutation({
        entity: 'sd_ticket',
        action: 'create',
        actorId: null,
        outcome: 'failure',
        reason: created.error.code,
        meta: {
          workspaceId: context.workspace.id,
          contactId: context.contact.id,
          channel: 'PORTAL',
        },
      })
      return created
    }

    void fireSdAutomations('TICKET_CREATED', created.value.id, {})
    auditMutation({
      entity: 'sd_ticket',
      action: 'create',
      actorId: null,
      targetId: created.value.id,
      meta: {
        workspaceId: context.workspace.id,
        contactId: context.contact.id,
        channel: 'PORTAL',
        type: created.value.type,
      },
    })
    logger.info('servicedesk.portal.ticket_created', {
      workspaceId: context.workspace.id,
      ticketId: created.value.id,
      contactId: context.contact.id,
    })

    const row = await SdPortalRepository.findTicketByNumber(
      scopeOf(context),
      created.value.number,
    )
    if (!row.ok) return row
    return ok(toSdPortalTicketSummaryDTO(row.value, context.prefixes))
  },

  /**
   * Resposta do contato no histórico, sempre pública, com até 5 anexos. Em
   * chamado resolvido, reabre quando `reopenOnRequesterReply` está ligado.
   */
  async reply(
    context: SdPortalSessionContext,
    ref: string,
    dto: CreateSdPortalMessageDTO,
    uploads: SdPortalUpload[],
  ): Promise<Result<SdPortalMessageDTO>> {
    const ticket = await resolveTicket(context, ref)
    if (!ticket.ok) return ticket
    const t = ticket.value
    if (t.phase.category === 'CANCELED') {
      return err(sdTicketForbidden('Este chamado foi cancelado'))
    }

    const stored: {
      id: string
      kind: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'OTHER'
      fileName: string
      mimeType: string
      size: number
      storageKey: string
    }[] = []
    for (const upload of uploads) {
      const kind = sdAttachmentKind(upload.contentType)
      if (!kind) {
        return err(sdAttachmentInvalid('Tipo de arquivo não permitido'))
      }
      if (upload.buffer.byteLength === 0) {
        return err(sdAttachmentInvalid('Arquivo vazio'))
      }
      if (upload.buffer.byteLength > SD_ATTACHMENT_MAX_BYTES) {
        return err(sdAttachmentInvalid('Arquivo muito grande. Máximo 25MB'))
      }
      const id = createId()
      const fileName = displayName(upload.fileName)
      const mimeType = sdBaseMime(upload.contentType)
      const storageKey = sdAttachmentKey(
        context.workspace.id,
        t.id,
        id,
        fileName,
      )
      try {
        await ensureBucket(SD_TICKET_BUCKET)
        await putObject({
          bucket: SD_TICKET_BUCKET,
          key: storageKey,
          body: upload.buffer,
          contentType: mimeType,
        })
      } catch (error) {
        logger.error('servicedesk.portal.attachment_failed', {
          workspaceId: context.workspace.id,
          ticketId: t.id,
          message: error instanceof Error ? error.message : String(error),
        })
        return err(storageError('Falha ao armazenar o arquivo'))
      }
      stored.push({
        id,
        kind,
        fileName,
        mimeType,
        size: upload.buffer.byteLength,
        storageKey,
      })
    }

    const created = await SdPortalRepository.createContactMessage({
      workspaceId: context.workspace.id,
      ticketId: t.id,
      contactId: context.contact.id,
      body: dto.body,
      attachments: stored,
    })
    if (!created.ok) return created
    const message = created.value
    const code = toSdPortalTicketSummaryDTO(t, context.prefixes).code

    await SdTicketEngine.touchActivity(t.id, message.createdAt)
    await recordSdTicketEvent({
      workspaceId: context.workspace.id,
      ticketId: t.id,
      actorKind: 'CONTACT',
      actorUserId: null,
      action: 'message.posted',
      meta: {
        messageId: message.id,
        visibility: 'PUBLIC',
        attachments: message.attachments.length,
        channel: 'PORTAL',
        contactId: context.contact.id,
      },
    })

    // Resposta do contato em chamado resolvido reabre (se configurado).
    if (
      t.phase.category === 'RESOLVED' &&
      context.settings.reopenOnRequesterReply
    ) {
      const full = await SdTicketRepository.findById(t.id, context.workspace.id)
      if (full.ok) {
        const reopened = await SdTicketEngine.reopen(
          full.value,
          sdContactActor({
            id: context.contact.id,
            name: context.contact.name,
          }),
          { settings: context.settings, prefixes: context.prefixes },
        )
        if (!reopened.ok) {
          logger.warn('servicedesk.portal.reopen_failed', {
            workspaceId: context.workspace.id,
            ticketId: t.id,
            reason: reopened.error.code,
          })
        }
      }
    }

    await notifyTeam(
      context,
      { id: t.id, number: t.number, code, title: t.title },
      `Nova resposta do cliente em ${code}`,
      preview(message.body, message.attachments.length),
    )
    await publishSdTicketEvent(
      context.workspace.id,
      {
        type: 'ticket.message',
        ticketId: t.id,
        number: t.number,
        at: message.createdAt.toISOString(),
      },
      { requesterId: null, participantIds: [], contactUserId: null },
    )
    void fireSdAutomations('MESSAGE_RECEIVED', t.id, {})
    auditMutation({
      entity: 'sd_ticket_message',
      action: 'create',
      actorId: null,
      targetId: message.id,
      meta: {
        workspaceId: context.workspace.id,
        ticketId: t.id,
        contactId: context.contact.id,
        channel: 'PORTAL',
        attachments: message.attachments.length,
      },
    })

    return ok(
      toSdPortalMessageDTO(message, {
        contactId: context.contact.id,
        ticketNumber: t.number,
      }),
    )
  },

  /** Avaliação do atendimento (1–5 + comentário), uma única vez. */
  async rate(
    context: SdPortalSessionContext,
    ref: string,
    dto: { score: number; comment?: string },
  ): Promise<Result<{ csatScore: number; csatComment: string | null }>> {
    const ticket = await resolveTicket(context, ref)
    if (!ticket.ok) return ticket
    const t = ticket.value
    if (!RATEABLE.has(t.phase.category)) return err(sdCsatNotAvailable())
    if (t.csatScore !== null) return err(sdCsatAlreadySubmitted())

    const comment = dto.comment?.trim() || null
    const written = await SdTicketCsatRepository.submit(
      t.id,
      context.workspace.id,
      dto.score,
      comment,
    )
    if (!written.ok) return written
    if (!written.value) return err(sdCsatAlreadySubmitted())

    await recordSdTicketEvent({
      workspaceId: context.workspace.id,
      ticketId: t.id,
      actorKind: 'CONTACT',
      actorUserId: null,
      action: 'csat.submitted',
      field: 'csatScore',
      fromValue: null,
      toValue: dto.score,
      meta: { hasComment: comment !== null, channel: 'PORTAL' },
    })
    await publishSdTicketEvent(
      context.workspace.id,
      {
        type: 'ticket.updated',
        ticketId: t.id,
        number: t.number,
        at: new Date().toISOString(),
      },
      { requesterId: null, participantIds: [], contactUserId: null },
    )
    auditMutation({
      entity: 'sd_ticket_csat',
      action: 'create',
      actorId: null,
      targetId: t.id,
      meta: {
        workspaceId: context.workspace.id,
        contactId: context.contact.id,
        score: dto.score,
      },
    })

    return ok({ csatScore: dto.score, csatComment: comment })
  },

  /** Anexo de uma mensagem pública do chamado (download pelo portal). */
  async attachment(
    context: SdPortalSessionContext,
    ref: string,
    attachmentId: string,
  ): Promise<Result<SdPortalFile>> {
    const ticket = await resolveTicket(context, ref)
    if (!ticket.ok) return ticket

    const row = await SdPortalRepository.findPublicAttachment(
      attachmentId,
      ticket.value.id,
    )
    if (!row.ok) return row
    if (!row.value) return err(sdAttachmentNotFound())

    try {
      const object = await getObject({
        bucket: SD_TICKET_BUCKET,
        key: row.value.storageKey,
      })
      return ok({
        body: object,
        contentType: row.value.mimeType,
        fileName: row.value.fileName,
      })
    } catch (error) {
      logger.error('servicedesk.portal.attachment_read_failed', {
        workspaceId: context.workspace.id,
        attachmentId,
        message: error instanceof Error ? error.message : String(error),
      })
      return err(storageError('Falha ao ler o arquivo'))
    }
  },

  /** O que o formulário de abertura oferece ao contato. */
  async formOptions(
    context: SdPortalSessionContext,
  ): Promise<Result<SdPortalFormOptionsDTO>> {
    const options = await SdPortalRepository.formOptions(context.workspace.id)
    if (!options.ok) return options
    const allowed = new Set(context.settings.portalTicketTypes)
    return ok({
      ticketTypes: context.settings.portalTicketTypes,
      catalog: toSdPortalCatalogTree(options.value.categories),
      templates: options.value.templates
        .filter((template) => allowed.has(template.ticketType))
        .map(toSdPortalTemplateDTO),
      urgencies: options.value.urgencies.map((urgency) => ({
        id: urgency.id,
        name: urgency.name,
      })),
      customFields: options.value.customFields.map(toSdPortalCustomFieldDTO),
    })
  },

  /** Base de conhecimento publicada no portal (lista, ou busca com `q`). */
  async knowledge(
    context: SdPortalSessionContext,
    query: SearchSdPortalKbDTO,
  ): Promise<Result<SdPortalKbListDTO>> {
    const workspaceId = context.workspace.id
    const categories = await SdKbCatalogRepository.listCategoriesWithCounts(
      workspaceId,
      true,
    )
    if (!categories.ok) return categories

    if (query.q) {
      const found = await SdKbArticleRepository.search(workspaceId, {
        q: query.q,
        portalOnly: true,
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        limit: query.limit,
      })
      if (!found.ok) return found
      return ok({
        articles: found.value.map((row) =>
          toSdKbSearchResultDTO(row, query.q as string),
        ),
        categories: categories.value.map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.icon,
        })),
      })
    }

    const articles = await SdKbArticleRepository.listByWorkspace(workspaceId, {
      portalOnly: true,
      archived: false,
    })
    if (!articles.ok) return articles
    const filtered = query.categoryId
      ? articles.value.filter(
          (article) => article.categoryId === query.categoryId,
        )
      : articles.value
    return ok({
      articles: filtered.slice(0, query.limit).map(toSdKbArticleSummaryDTO),
      categories: categories.value.map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
      })),
    })
  },

  /** Um artigo publicado no portal. */
  async article(
    context: SdPortalSessionContext,
    articleId: string,
  ): Promise<Result<SdPortalKbArticleDTO>> {
    const article = await SdKbArticleRepository.findById(
      articleId,
      context.workspace.id,
    )
    if (!article.ok) return article
    if (
      article.value.status !== 'PUBLISHED' ||
      article.value.visibility !== 'PORTAL' ||
      article.value.archivedAt !== null
    ) {
      return err(sdKbArticleNotFound())
    }
    await SdKbArticleRepository.incrementViews(articleId)
    return ok(toSdKbArticleDTO(article.value))
  },
}
