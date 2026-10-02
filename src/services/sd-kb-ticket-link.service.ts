import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { sdTicketForbidden } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toSdKbSearchResultDTO,
  toSdTicketKbLinkDTO,
} from '@/src/mappers/sd-kb-article.mapper'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbReviewRepository } from '@/src/repositories/sd-kb-review.repository'
import {
  SdKbTicketLinkRepository,
  type SdKbTicketRef,
} from '@/src/repositories/sd-kb-ticket-link.repository'
import type { SuggestSdKbArticlesDTO } from '@/src/schemas/sd-kb-article.schema'
import type {
  MarkSdKbResolvedDTO,
  SuggestSdKbForDraftDTO,
} from '@/src/schemas/sd-kb-review.schema'
import type {
  SdKbSearchResultDTO,
  SdTicketKbLinkDTO,
} from '@/types/sd-kb-article'
import { SdAccess, type SdAccessContext } from './sd-access'
import { resolveSdKbEditor, resolveSdKbReader } from './sd-kb-access'

/**
 * Vínculo chamado ↔ artigo (KCS) e sugestões de artigos para um chamado —
 * base da aba "Conhecimento" do chamado.
 */

const ENTITY = 'sd_ticket_kb_link'
const MAX_TERMS = 10

/** Termos do título seguros para `to_tsquery` (letras/dígitos, ≥ 3). */
export function sdKbTermsFromTitle(title: string): string[] {
  const words = title.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []
  return [...new Set(words)].slice(0, MAX_TERMS)
}

/** Solicitante só enxerga chamados que abriu ou em que participa. */
function canSeeTicket(ctx: SdAccessContext, ticket: SdKbTicketRef): boolean {
  if (ctx.isAgent) return true
  return (
    ticket.requesterId === ctx.userId ||
    ticket.createdById === ctx.userId ||
    ticket.participantIds.includes(ctx.userId)
  )
}

export const SdKbTicketLinkService = {
  /** Artigos vinculados (solicitante: só os publicados no portal). */
  async listForTicket(
    actorId: string,
    workspaceId: string,
    ticketId: string,
  ): Promise<Result<SdTicketKbLinkDTO[]>> {
    const ctx = await resolveSdKbReader(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const ticket = await SdKbTicketLinkRepository.findTicket(
      ticketId,
      workspaceId,
    )
    if (!ticket.ok) return ticket
    if (!canSeeTicket(ctx.value, ticket.value)) return err(sdTicketForbidden())

    const result = await SdKbTicketLinkRepository.listByTicket(ticketId, {
      portalOnly: !ctx.value.isAgent,
    })
    if (!result.ok) return result
    return ok(result.value.map(toSdTicketKbLinkDTO))
  },

  async link(
    actorId: string,
    workspaceId: string,
    ticketId: string,
    articleId: string,
  ): Promise<Result<SdTicketKbLinkDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'EDIT',
    })
    if (!ctx.ok) return ctx

    const ticket = await SdKbTicketLinkRepository.findTicket(
      ticketId,
      workspaceId,
    )
    if (!ticket.ok) return ticket
    const article = await SdKbArticleRepository.findById(articleId, workspaceId)
    if (!article.ok) return article

    const result = await SdKbTicketLinkRepository.link({
      ticketId,
      articleId,
      linkedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: ENTITY,
      action: 'create',
      actorId,
      targetId: ticketId,
      meta: { articleId },
    })
    return ok(toSdTicketKbLinkDTO(result.value))
  },

  async unlink(
    actorId: string,
    workspaceId: string,
    ticketId: string,
    articleId: string,
  ): Promise<Result<void>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'EDIT',
    })
    if (!ctx.ok) return ctx

    const ticket = await SdKbTicketLinkRepository.findTicket(
      ticketId,
      workspaceId,
    )
    if (!ticket.ok) return ticket

    const result = await SdKbTicketLinkRepository.unlink(ticketId, articleId)
    if (!result.ok) return result

    auditMutation({
      entity: ENTITY,
      action: 'delete',
      actorId,
      targetId: ticketId,
      meta: { articleId },
    })
    return ok(undefined)
  },

  /**
   * KCS: marca (ou desmarca) o artigo como o que resolveu o chamado — é o que
   * conta no reuso. Marcar um artigo ainda não vinculado vincula na hora (um
   * clique só na sugestão); marcar duas vezes conta uma.
   */
  async markResolved(
    actorId: string,
    workspaceId: string,
    articleId: string,
    dto: MarkSdKbResolvedDTO,
  ): Promise<Result<SdTicketKbLinkDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'EDIT',
    })
    if (!ctx.ok) return ctx

    const ticket = await SdKbTicketLinkRepository.findTicket(
      dto.ticketId,
      workspaceId,
    )
    if (!ticket.ok) return ticket
    const article = await SdKbArticleRepository.findById(articleId, workspaceId)
    if (!article.ok) return article

    if (dto.resolved) {
      const linked = await SdKbTicketLinkRepository.link({
        ticketId: dto.ticketId,
        articleId,
        linkedById: actorId,
      })
      if (!linked.ok) return linked
    }

    const marked = await SdKbReviewRepository.markResolved(
      dto.ticketId,
      articleId,
      dto.resolved,
    )
    auditMutation({
      entity: ENTITY,
      action: dto.resolved ? 'resolve' : 'unresolve',
      actorId,
      targetId: dto.ticketId,
      outcome: marked.ok ? undefined : 'failure',
      reason: marked.ok ? undefined : marked.error.code,
      meta: { articleId, changed: marked.ok ? marked.value.changed : false },
    })
    if (!marked.ok) return marked

    logger.info('servicedesk.kb.resolver_marked', {
      workspaceId,
      ticketId: dto.ticketId,
      articleId,
      resolved: dto.resolved,
      changed: marked.value.changed,
    })
    return ok(toSdTicketKbLinkDTO(marked.value.link))
  },

  /**
   * Sugestões para um chamado que ainda não existe (tela de abertura e
   * portal): os termos vêm do que já foi digitado. Solicitante só recebe
   * artigos publicados no portal.
   */
  async suggestForDraft(
    actorId: string,
    workspaceId: string,
    dto: SuggestSdKbForDraftDTO,
  ): Promise<Result<SdKbSearchResultDTO[]>> {
    const ctx = await resolveSdKbReader(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const terms = sdKbTermsFromTitle(`${dto.title} ${dto.description}`)
    const result = await SdKbArticleRepository.suggest(workspaceId, {
      terms,
      categoryIds: dto.categoryIds,
      limit: dto.limit,
      portalOnly: !ctx.value.isAgent,
    })
    if (!result.ok) return result
    const query = terms.join(' ')
    return ok(result.value.map((row) => toSdKbSearchResultDTO(row, query)))
  },

  /**
   * Sugestões por categoria/subcategoria/serviço e pelos termos do título do
   * chamado (só publicados). Agentes veem internos também.
   */
  async suggest(
    actorId: string,
    workspaceId: string,
    dto: SuggestSdKbArticlesDTO,
  ): Promise<Result<SdKbSearchResultDTO[]>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const ticket = await SdKbTicketLinkRepository.findTicket(
      dto.ticketId,
      workspaceId,
    )
    if (!ticket.ok) return ticket

    const terms = sdKbTermsFromTitle(ticket.value.title)
    const categoryIds = [
      ticket.value.categoryId,
      ticket.value.subcategoryId,
      ticket.value.serviceId,
    ].filter((id): id is string => !!id)

    const result = await SdKbArticleRepository.suggest(workspaceId, {
      terms,
      categoryIds,
      limit: dto.limit,
      portalOnly: false,
    })
    if (!result.ok) return result
    const query = terms.join(' ')
    return ok(result.value.map((row) => toSdKbSearchResultDTO(row, query)))
  },
}
