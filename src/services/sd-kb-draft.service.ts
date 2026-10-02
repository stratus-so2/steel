import type { Prisma, SdSettings, SdTicketType } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import {
  clipSdText,
  formatSdTicketContext,
  redactSdPii,
  type SdAiAuthorRole,
} from '@/src/lib/servicedesk/ai-prompts'
import { sdHtmlToText } from '@/src/lib/servicedesk/html'
import {
  buildSdKcsDraftSystem,
  sdKcsContent,
  sdKcsSkeleton,
  sdKcsTitleFromTicket,
} from '@/src/lib/servicedesk/kcs'
import { extractSdKbPlainText } from '@/src/lib/servicedesk/sd-kb-text'
import {
  formatSdTicketCode,
  resolveSdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import { toSdKbArticleDTO } from '@/src/mappers/sd-kb-article.mapper'
import { SdAiRepository } from '@/src/repositories/sd-ai.repository'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbTicketLinkRepository } from '@/src/repositories/sd-kb-ticket-link.repository'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { parseSdAiJson } from '@/src/schemas/sd-ai.schema'
import type { DraftSdKbArticleFromTicketDTO } from '@/src/schemas/sd-kb-review.schema'
import {
  SD_KCS_DRAFT_JSON_SCHEMA,
  SdKcsDraftOutputSchema,
} from '@/src/schemas/sd-kb-review.schema'
import type { SdKbDraftFromTicketDTO } from '@/types/sd-kb-review'
import { AiUsageService } from './ai-usage.service'
import { resolveSdKbEditor } from './sd-kb-access'

/**
 * KCS — "criar artigo a partir deste chamado". O agente sai do chamado com um
 * **rascunho** já vinculado a ele (`sourceTicketId`), no formato KCS
 * (Problema / Ambiente / Causa / Solução / Validação).
 *
 * Com IA habilitada no workspace (`SdSettings.aiEnabled`), o texto das cinco
 * seções vem do provedor do workspace, pela porta padrão
 * (`AiUsageService.prepare` → cota mensal, ADR 0007) e com o mesmo recorte
 * de LGPD do resto do módulo: só o texto do chamado, com e-mail/telefone/
 * documento mascarados (ADR 0006) e instrução explícita para não copiar dado
 * pessoal para o artigo. Sem IA (desligada, sem cota, provedor fora), o
 * rascunho vem com o esqueleto das seções — nunca falha por causa da IA.
 *
 * O autor sempre edita e manda para revisão antes de publicar.
 */

const ENTITY = 'sd_kb_article'

const TYPE_LABEL: Record<SdTicketType, string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

const AUTHOR_ROLE: Record<string, SdAiAuthorRole> = {
  AGENT: 'agente',
  REQUESTER: 'solicitante',
  CONTACT: 'contato',
  AI: 'ia',
  SYSTEM: 'sistema',
}

/** Teto do rascunho da IA (seções curtas; o artigo cresce na edição). */
const DRAFT_MAX_TOKENS = 1500

type AiOutcome = {
  content: Prisma.InputJsonValue
  title: string | null
  tags: string[]
  aiUsed: boolean
  skipped: string | null
}

/** Texto do chamado para o prompt: histórico **público**, sem PII direta. */
async function ticketPrompt(
  ticket: SdTicketWithRelations,
  settings: SdSettings,
): Promise<Result<string>> {
  const messages = await SdAiRepository.listTicketMessages(ticket.id, {
    publicOnly: true,
  })
  if (!messages.ok) return messages
  const catalog = [ticket.category, ticket.subcategory, ticket.service]
    .filter((node): node is { id: string; name: string } => Boolean(node))
    .map((node) => node.name)
    .join(' > ')
  return ok(
    formatSdTicketContext({
      code: formatSdTicketCode(
        ticket.type,
        ticket.number,
        resolveSdTicketPrefixes(settings.ticketPrefixes),
      ),
      type: TYPE_LABEL[ticket.type],
      title: ticket.title,
      description: sdHtmlToText(ticket.description ?? ''),
      phase: ticket.phase.name,
      priority: ticket.priority?.name ?? null,
      category: catalog || null,
      department: ticket.department?.name ?? null,
      solution: ticket.solution,
      messages: messages.value.map((message) => ({
        role: AUTHOR_ROLE[message.authorKind] ?? 'sistema',
        internal: false,
        body: sdHtmlToText(message.body),
        at: message.createdAt.toISOString(),
      })),
    }),
  )
}

/** Uma chamada ao provedor; falha vira esqueleto, nunca erro da ação. */
async function aiDraft(input: {
  workspaceId: string
  actorId: string
  settings: SdSettings
  context: string
}): Promise<AiOutcome> {
  const fallback = (skipped: string): AiOutcome => ({
    content: sdKcsSkeleton() as unknown as Prisma.InputJsonValue,
    title: null,
    tags: [],
    aiUsed: false,
    skipped,
  })

  if (!input.settings.aiEnabled) return fallback('ai_disabled')
  const call = await AiUsageService.prepare(
    input.workspaceId,
    'SERVICEDESK_COPILOT',
    input.actorId,
  )
  if (!call.ok) return fallback(call.error.code)

  try {
    const response = await call.value.provider.chat({
      model: call.value.model.model,
      system: buildSdKcsDraftSystem({ ticket: input.context }),
      messages: [
        {
          role: 'user',
          content:
            'Escreva o rascunho do artigo KCS deste chamado, em JSON, sem dados pessoais.',
        },
      ],
      jsonSchema: { name: 'kcs_draft', schema: SD_KCS_DRAFT_JSON_SCHEMA },
      maxTokens: DRAFT_MAX_TOKENS,
    })
    await AiUsageService.record(call.value, {
      workspaceId: input.workspaceId,
      userId: input.actorId,
      usage: response.usage,
    })
    const parsed = parseSdAiJson(SdKcsDraftOutputSchema, response.text)
    if (!parsed) return fallback('ai_invalid_output')
    return {
      content: sdKcsContent({
        problem: parsed.problem,
        environment: parsed.environment,
        cause: parsed.cause,
        solution: parsed.solution,
        validation: parsed.validation,
      }) as unknown as Prisma.InputJsonValue,
      title: parsed.title.trim() ? parsed.title.trim() : null,
      tags: parsed.tags,
      aiUsed: true,
      skipped: null,
    }
  } catch (error) {
    logger.error('servicedesk.kb.draft_provider_failed', {
      workspaceId: input.workspaceId,
      provider: call.value.model.provider,
      model: call.value.model.model,
      message: error instanceof Error ? error.message : String(error),
    })
    return fallback('ai_provider_unavailable')
  }
}

export const SdKbDraftService = {
  /**
   * Cria o rascunho do artigo a partir do chamado e já o vincula a ele.
   * O título e a categoria vêm do chamado; o conteúdo, da IA ou do esqueleto.
   */
  async fromTicket(
    actorId: string,
    workspaceId: string,
    dto: DraftSdKbArticleFromTicketDTO,
  ): Promise<Result<SdKbDraftFromTicketDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'CREATE')
    if (!ctx.ok) return ctx

    const ticket = await SdTicketRepository.findById(dto.ticketId, workspaceId)
    if (!ticket.ok) return ticket

    const settings = await SdTicketContextRepository.ensureSettings(workspaceId)
    if (!settings.ok) return settings

    const context = await ticketPrompt(ticket.value, settings.value)
    if (!context.ok) return context

    const draft = dto.useAi
      ? await aiDraft({
          workspaceId,
          actorId,
          settings: settings.value,
          context: redactSdPii(clipSdText(context.value, 16_000)),
        })
      : {
          content: sdKcsSkeleton() as unknown as Prisma.InputJsonValue,
          title: null,
          tags: [],
          aiUsed: false,
          skipped: 'ai_not_requested',
        }

    const created = await SdKbArticleRepository.create({
      workspaceId,
      parentId: dto.parentId ?? null,
      title: draft.title ?? sdKcsTitleFromTicket(ticket.value.title),
      categoryId:
        dto.categoryId ??
        ticket.value.serviceId ??
        ticket.value.subcategoryId ??
        ticket.value.categoryId ??
        undefined,
      tags: draft.tags.length > 0 ? draft.tags : undefined,
      createdById: actorId,
      sourceTicketId: ticket.value.id,
    })
    auditMutation({
      entity: ENTITY,
      action: 'create',
      actorId,
      targetId: created.ok ? created.value.id : undefined,
      outcome: created.ok ? undefined : 'failure',
      reason: created.ok ? undefined : created.error.code,
      meta: { from: 'ticket', ticketId: ticket.value.id, ai: draft.aiUsed },
    })
    if (!created.ok) return created

    const content = await SdKbArticleRepository.update(created.value.id, {
      content: draft.content,
      plainText: extractSdKbPlainText(draft.content),
      updatedById: actorId,
    })
    if (!content.ok) return content

    // O vínculo nasce com o artigo: a aba "Conhecimento" do chamado já mostra.
    const link = await SdKbTicketLinkRepository.link({
      ticketId: ticket.value.id,
      articleId: created.value.id,
      linkedById: actorId,
    })
    if (!link.ok) {
      logger.warn('servicedesk.kb.draft_link_failed', {
        workspaceId,
        articleId: created.value.id,
        ticketId: ticket.value.id,
        reason: link.error.code,
      })
    }

    logger.info('servicedesk.kb.draft_from_ticket', {
      workspaceId,
      ticketId: ticket.value.id,
      articleId: created.value.id,
      ai: draft.aiUsed,
      skipped: draft.skipped,
    })
    return ok({
      article: toSdKbArticleDTO(content.value),
      aiUsed: draft.aiUsed,
      aiSkippedReason: draft.skipped,
    })
  },
}
