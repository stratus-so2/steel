import { createHash } from 'node:crypto'
import { auditMutation } from '@/lib/axiom/audit'
import { crmAiNotConfigured } from '@/src/errors'
import { streamChat } from '@/src/lib/ai/client'
import {
  type AiProvider,
  isAiConfigured,
  resolveAiProvider,
} from '@/src/lib/ai/env'
import {
  buildCreateSystemPrompt,
  buildEditSystemPrompt,
  extractHtml,
  parseRenderArgs,
  RENDER_LANDING_PAGE_TOOL,
} from '@/src/lib/ai/landing-page-prompt'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmLandingPageDTO,
  toCrmLandingPageMessageDTO,
  toCrmLandingPagePublicDTO,
  toCrmLandingPageViewDTO,
} from '@/src/mappers/crm-landing-page.mapper'
import {
  CrmLandingPageMessageRepository,
  CrmLandingPageRepository,
  CrmLandingPageViewRepository,
} from '@/src/repositories/crm-landing-page.repository'
import type {
  CreateCrmLandingPageDTO,
  RecordCrmLandingPageViewDTO,
  UpdateCrmLandingPageDTO,
} from '@/src/schemas/crm-landing-page.schema'
import type {
  CrmLandingPageDTO,
  CrmLandingPageMessageDTO,
  CrmLandingPagePublicDTO,
  CrmLandingPageViewDTO,
} from '@/types/crm-landing-page'
import { assertMember } from './authz'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

/** Orçamento de saída amplo: uma landing page inteira não cabe nos 4k padrão. */
const LANDING_PAGE_MAX_TOKENS = 16_000
/** Um pouco mais de criatividade que o chat (0.3) rende layouts mais ricos. */
const LANDING_PAGE_TEMPERATURE = 0.5
const DEFAULT_DONE_MESSAGE = 'Pronto! Atualizei a página com sua solicitação.'

/** Chunk emitido pelo gerador de IA, consumido pela rota como SSE. */
export type CrmLandingPageGenerateChunk =
  | { type: 'user'; message: CrmLandingPageMessageDTO }
  | { type: 'text'; delta: string }
  | { type: 'done'; html: string; message: CrmLandingPageMessageDTO }
  | { type: 'error'; message: string }

export const CrmLandingPageService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmLandingPageDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLandingPageRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLandingPageDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLandingPageRepository.findById(pageId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmLandingPageDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmLandingPageDTO,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLandingPageRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
      html: dto.html,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_landing_page',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_landing_page',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmLandingPageDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    pageId: string,
    dto: UpdateCrmLandingPageDTO,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    // Carimba o 1º publish; despublicar não apaga o timestamp original.
    const publishedAt =
      dto.status === 'PUBLISHED' && !existing.value.publishedAt
        ? new Date()
        : undefined

    const result = await CrmLandingPageRepository.update(pageId, {
      title: dto.title,
      html: dto.html,
      status: dto.status,
      publishedAt,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_landing_page',
      action: 'update',
      actorId,
      targetId: pageId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmLandingPageDTO(result.value))
  },

  async setPublished(
    actorId: string,
    workspaceId: string,
    pageId: string,
    published: boolean,
  ): Promise<Result<CrmLandingPageDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLandingPageRepository.setPublished(
      pageId,
      published,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_landing_page',
      action: 'update',
      actorId,
      targetId: pageId,
      meta: { published },
    })

    return ok(toCrmLandingPageDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmLandingPageRepository.softDelete(pageId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_landing_page',
      action: 'delete',
      actorId,
      targetId: pageId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmLandingPageRepository.reorder(workspaceId, orderedIds)
  },

  async listViews(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<CrmLandingPageViewDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const page = await CrmLandingPageRepository.findById(pageId, workspaceId)
    if (!page.ok) return page

    const result = await CrmLandingPageViewRepository.listByLandingPage(pageId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLandingPageViewDTO))
  },

  async getPublicByShareToken(
    shareToken: string,
  ): Promise<Result<CrmLandingPagePublicDTO>> {
    const result = await CrmLandingPageRepository.findByShareToken(shareToken)
    if (!result.ok) return result

    return ok(toCrmLandingPagePublicDTO(result.value))
  },

  async recordView(
    shareToken: string,
    ip: string,
    dto: RecordCrmLandingPageViewDTO,
  ): Promise<Result<void>> {
    const page = await CrmLandingPageRepository.findByShareToken(shareToken)
    if (!page.ok) return page

    const result = await CrmLandingPageViewRepository.record({
      landingPageId: page.value.id,
      viewId: dto.viewId,
      ipHash: hashIp(ip),
      durationMs: dto.durationMs,
      ctaClicks: dto.ctaClicks,
      referrer: dto.referrer,
    })
    if (!result.ok) return result

    return ok(undefined)
  },

  async listMessages(
    actorId: string,
    workspaceId: string,
    pageId: string,
  ): Promise<Result<CrmLandingPageMessageDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const page = await CrmLandingPageRepository.findById(pageId, workspaceId)
    if (!page.ok) return page

    const result =
      await CrmLandingPageMessageRepository.listByLandingPage(pageId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLandingPageMessageDTO))
  },

  /**
   * Pré-voo da geração por IA (workspace, configuração, posse, persistência da
   * mensagem do usuário) e devolve um gerador que transmite o texto, salva o
   * HTML resultante na página e persiste a resposta do assistente ao final.
   */
  async generate(params: {
    actorId: string
    workspaceId: string
    pageId: string
    message: string
    provider?: AiProvider
  }): Promise<Result<{ run: AsyncGenerator<CrmLandingPageGenerateChunk> }>> {
    const { actorId, workspaceId, pageId, message } = params

    if (!isAiConfigured()) return err(crmAiNotConfigured())
    const provider = resolveAiProvider(params.provider)
    if (!provider) return err(crmAiNotConfigured())

    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLandingPageRepository.findById(
      pageId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const saved = await CrmLandingPageMessageRepository.append({
      landingPageId: pageId,
      role: 'USER',
      content: message,
    })
    if (!saved.ok) return saved

    return ok({
      run: runGenerate({
        actorId,
        pageId,
        page: existing.value,
        message,
        userMessage: saved.value,
        provider,
      }),
    })
  },
}

/**
 * Loop de geração: chama o modelo forçando a tool `render_landing_page`, que
 * devolve o documento final num campo estruturado (html) + um resumo. Salva o
 * HTML na página e persiste o resumo como mensagem do assistente. Cai para o
 * parsing de texto livre caso o modelo não use a tool.
 */
async function* runGenerate(ctx: {
  actorId: string
  pageId: string
  page: { html: string }
  message: string
  userMessage: Parameters<typeof toCrmLandingPageMessageDTO>[0]
  provider: AiProvider
}): AsyncGenerator<CrmLandingPageGenerateChunk> {
  const { pageId, page, message, userMessage, provider } = ctx

  yield { type: 'user', message: toCrmLandingPageMessageDTO(userMessage) }

  const system = page.html.trim()
    ? buildEditSystemPrompt(page.html)
    : buildCreateSystemPrompt()

  let html = ''
  let summary = ''
  let rawContent = ''
  for await (const ev of streamChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: message },
    ],
    [RENDER_LANDING_PAGE_TOOL],
    'required',
    {
      maxTokens: LANDING_PAGE_MAX_TOKENS,
      temperature: LANDING_PAGE_TEMPERATURE,
    },
    provider,
  )) {
    if (ev.type === 'text') {
      rawContent += ev.delta
    } else if (ev.type === 'error') {
      yield { type: 'error', message: ev.message }
      return
    } else if (ev.type === 'finish') {
      const call = ev.toolCalls.find(
        (t) => t.name === RENDER_LANDING_PAGE_TOOL.function.name,
      )
      if (call) {
        const parsed = parseRenderArgs(call.args)
        html = parsed.html
        summary = parsed.summary
      }
    }
  }

  if (!html) html = extractHtml(rawContent)
  if (!html) {
    yield { type: 'error', message: 'A IA não retornou um documento válido.' }
    return
  }

  await CrmLandingPageRepository.update(pageId, { html })

  const content = summary || DEFAULT_DONE_MESSAGE
  const saved = await CrmLandingPageMessageRepository.append({
    landingPageId: pageId,
    role: 'ASSISTANT',
    content,
  })

  const dto: CrmLandingPageMessageDTO = saved.ok
    ? toCrmLandingPageMessageDTO(saved.value)
    : {
        id: '',
        role: 'assistant',
        content,
        createdAt: new Date().toISOString(),
      }

  yield { type: 'done', html, message: dto }
}
