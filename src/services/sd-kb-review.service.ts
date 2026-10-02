import type { SdNotificationChannel } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import {
  SD_DIGEST_HOUR,
  sdNotificationEvent,
} from '@/src/config/servicedesk-notifications'
import {
  sdKbReviewClosed,
  sdKbReviewForbidden,
  validationError,
} from '@/src/errors'
import { sendSdKbReviewEmail } from '@/src/lib/mail/servicedesk/send-sd-kb-review'
import { err, ok, type Result } from '@/src/lib/result'
import {
  sdKcsEffectiveInterval,
  sdKcsReviewDueAt,
  sdKcsReviewDueBody,
} from '@/src/lib/servicedesk/kcs'
import { sdLocalHour } from '@/src/lib/servicedesk/notify'
import {
  toSdKbReviewDTO,
  toSdKbReviewSettingsDTO,
  toSdKbReviewStateDTO,
  toSdKbStatsDTO,
} from '@/src/mappers/sd-kb-review.mapper'
import { sdChannelEnabled } from '@/src/mappers/sd-notification.mapper'
import {
  SdKbArticleRepository,
  type SdKbArticleWithRefs,
} from '@/src/repositories/sd-kb-article.repository'
import { SdKbReviewRepository } from '@/src/repositories/sd-kb-review.repository'
import { SdNotificationRepository } from '@/src/repositories/sd-notification.repository'
import { SdSettingsRepository } from '@/src/repositories/sd-settings.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type {
  DecideSdKbReviewDTO,
  ListSdKbReviewsDTO,
  RequestSdKbReviewDTO,
  SdKbStatsDTO,
  SetSdKbReviewIntervalDTO,
  UpdateSdKbReviewSettingsDTO,
} from '@/src/schemas/sd-kb-review.schema'
import type {
  SdKbReviewDTO,
  SdKbReviewSettingsDTO,
  SdKbReviewStateDTO,
  SdKbStatsResultDTO,
} from '@/types/sd-kb-review'
import { NotificationService } from './notification.service'
import { SdAccess, type SdAccessContext } from './sd-access'
import { resolveSdKbEditor } from './sd-kb-access'

/**
 * KCS — revisão e validade dos artigos da base de conhecimento.
 *
 * Fluxo: o autor manda para revisão escolhendo um **agente** revisor
 * (`DRAFT → IN_REVIEW`); o revisor aprova (publica, carimba `lastReviewedAt`
 * e agenda `reviewDueAt = agora + validade`) ou pede mudanças (volta a
 * `DRAFT`, com comentário). Artigo já publicado pode ser revalidado sem
 * sair do ar: ele continua `PUBLISHED` durante a revisão.
 *
 * A validade é por artigo (`SdKbArticle.reviewIntervalDays`), com o padrão
 * do workspace (`SdSettings.kbReviewIntervalDays`). Uma vez por dia, na hora
 * local do resumo, `runDueCheck` avisa quem mantém os artigos vencidos.
 *
 * Artigo não é chamado: os eventos `kb.*` não têm público no catálogo, então
 * a entrega (in-app + e-mail, respeitando a preferência de cada um) é feita
 * aqui, como no resumo diário.
 */

const ENTITY = 'sd_kb_review'

/** Ações do log de auditoria desta fatia (união do `auditMutation`). */
type KbReviewAuditAction = 'request' | 'respond' | 'cancel' | 'update'

function audit(
  action: KbReviewAuditAction,
  actorId: string,
  targetId: string | undefined,
  result: Result<unknown>,
  meta?: Record<string, unknown>,
) {
  if (!result.ok) {
    auditMutation({
      entity: ENTITY,
      action,
      actorId,
      targetId,
      outcome: 'failure',
      reason: result.error.code,
      meta,
    })
    return
  }
  auditMutation({ entity: ENTITY, action, actorId, targetId, meta })
}

/** Artigo + validade padrão do workspace (tudo que o estado precisa). */
async function loadArticle(
  workspaceId: string,
  articleId: string,
): Promise<
  Result<{ article: SdKbArticleWithRefs; workspaceIntervalDays: number }>
> {
  const article = await SdKbArticleRepository.findById(articleId, workspaceId)
  if (!article.ok) return article
  const settings = await SdTicketContextRepository.ensureSettings(workspaceId)
  if (!settings.ok) return settings
  return ok({
    article: article.value,
    workspaceIntervalDays: settings.value.kbReviewIntervalDays,
  })
}

/** Só o autor do artigo (ou um admin do módulo) governa a revisão. */
function ownsArticle(
  ctx: SdAccessContext,
  article: SdKbArticleWithRefs,
): boolean {
  return ctx.isAdmin || article.createdById === ctx.userId
}

async function state(
  articleId: string,
  workspaceIntervalDays: number,
  article: SdKbArticleWithRefs,
): Promise<Result<SdKbReviewStateDTO>> {
  const [pending, history] = await Promise.all([
    SdKbReviewRepository.findPendingByArticle(articleId),
    SdKbReviewRepository.listByArticle(articleId),
  ])
  if (!pending.ok) return pending
  if (!history.ok) return history
  return ok(
    toSdKbReviewStateDTO({
      article,
      workspaceIntervalDays,
      pending: pending.value,
      history: history.value,
    }),
  )
}

/* ------------------------------- avisos ---------------------------------- */

interface KbNotifyInput {
  workspaceId: string
  /** Chave do catálogo (`kb.review_requested`, `kb.review_decided`…). */
  event: string
  userIds: (string | null | undefined)[]
  actorId?: string | null
  title: string
  body: string
  articleTitle: string
  /** Caminho interno (sem domínio). */
  href: string
  action?: string
  meta?: Record<string, unknown>
}

interface KbNotifyOutcome {
  inApp: number
  email: number
}

/**
 * Entrega um evento da base a usuários escolhidos, respeitando canal e
 * preferência (sem linha salva vale o padrão do catálogo). Nunca lança:
 * falha de canal vira log.
 */
async function notifyKbEvent(
  input: KbNotifyInput,
): Promise<Result<KbNotifyOutcome>> {
  const spec = sdNotificationEvent(input.event)
  if (!spec) return ok({ inApp: 0, email: 0 })

  const excluded = input.actorId ?? ''
  const candidates = Array.from(
    new Set(
      input.userIds.filter(
        (id): id is string =>
          typeof id === 'string' && id !== '' && id !== excluded,
      ),
    ),
  )
  if (candidates.length === 0) return ok({ inApp: 0, email: 0 })

  const agents = await SdNotificationRepository.filterAgentIds(
    input.workspaceId,
    candidates,
  )
  if (!agents.ok) return agents
  // Admin do módulo sem departamento não aparece em `filterAgentIds`; para o
  // aviso da base vale quem foi escolhido, então o filtro só tira quem saiu.
  const userIds = agents.value.length > 0 ? agents.value : candidates
  const [workspace, recipients, prefs] = await Promise.all([
    SdTicketContextRepository.findWorkspace(input.workspaceId),
    SdNotificationRepository.findRecipients(input.workspaceId, userIds),
    SdNotificationRepository.listPreferencesForEvent(
      input.workspaceId,
      userIds,
      spec.key,
    ),
  ])
  if (!workspace.ok) return workspace
  if (!recipients.ok) return recipients
  if (!prefs.ok) return prefs
  if (!workspace.value) return ok({ inApp: 0, email: 0 })

  const perUser = new Map<string, Map<string, boolean>>()
  for (const row of prefs.value) {
    const current = perUser.get(row.userId) ?? new Map<string, boolean>()
    current.set(`${row.event}|${row.channel}`, row.enabled)
    perUser.set(row.userId, current)
  }
  const wants = (userId: string, channel: SdNotificationChannel): boolean =>
    sdChannelEnabled(spec, channel, perUser.get(userId) ?? new Map())

  const inAppIds = recipients.value
    .filter((user) => wants(user.id, 'IN_APP'))
    .map((user) => user.id)
  const emailTargets = recipients.value.filter((user) =>
    wants(user.id, 'EMAIL'),
  )

  let inApp = 0
  if (inAppIds.length > 0) {
    const created = await NotificationService.notifyUsers({
      workspaceId: input.workspaceId,
      userIds: inAppIds,
      kind: spec.kind,
      title: input.title,
      body: input.body,
      href: input.href,
    })
    if (created.ok) inApp = created.value
    else {
      logger.warn('servicedesk.kb.notify_in_app_failed', {
        workspaceId: input.workspaceId,
        event: spec.key,
        reason: created.error.code,
      })
    }
  }

  let email = 0
  if (emailTargets.length > 0) {
    const results = await Promise.allSettled(
      emailTargets.map((target) =>
        sendSdKbReviewEmail({
          email: target.email,
          username: target.name,
          workspaceName: workspace.value?.name ?? '',
          headline: input.title,
          articleTitle: input.articleTitle,
          message: input.body,
          redirectUrl: `${NEXT_PUBLIC_URL}${input.href}`,
          action: input.action,
        }),
      ),
    )
    email = results.filter((r) => r.status === 'fulfilled').length
    if (email < results.length) {
      logger.warn('servicedesk.kb.notify_email_failed', {
        workspaceId: input.workspaceId,
        event: spec.key,
        failed: results.length - email,
      })
    }
  }

  logger.info('servicedesk.kb.notified', {
    workspaceId: input.workspaceId,
    event: spec.key,
    recipients: recipients.value.length,
    inApp,
    email,
    ...input.meta,
  })
  return ok({ inApp, email })
}

function articleHref(slug: string, articleId: string): string {
  return `/${slug}/servicedesk/knowledge/${articleId}`
}

export interface SdKbReviewDueResult {
  /** Workspaces com o módulo habilitado. */
  workspaces: number
  /** Workspaces na hora local do aviso. */
  due: number
  /** Artigos vencidos encontrados. */
  articles: number
  /** Mantenedores avisados. */
  notified: number
  inApp: number
  email: number
  errors: number
}

/* ------------------------------- serviço --------------------------------- */

export const SdKbReviewService = {
  /** Estado da revisão do artigo: validade, prazo, pendência e histórico. */
  async getState(
    actorId: string,
    workspaceId: string,
    articleId: string,
  ): Promise<Result<SdKbReviewStateDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const loaded = await loadArticle(workspaceId, articleId)
    if (!loaded.ok) return loaded
    return state(
      articleId,
      loaded.value.workspaceIntervalDays,
      loaded.value.article,
    )
  },

  /** Fila de revisões do workspace (ou só as minhas, com `mine`). */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdKbReviewsDTO,
  ): Promise<Result<SdKbReviewDTO[]>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const result = await SdKbReviewRepository.listByWorkspace(workspaceId, {
      status: filters.status,
      reviewerId: filters.mine ? actorId : undefined,
      limit: filters.limit,
    })
    if (!result.ok) return result
    return ok(result.value.map(toSdKbReviewDTO))
  },

  /**
   * Manda o artigo para revisão. Rascunho vai para `IN_REVIEW`; publicado
   * continua no ar durante a revalidação.
   */
  async request(
    actorId: string,
    workspaceId: string,
    articleId: string,
    dto: RequestSdKbReviewDTO,
  ): Promise<Result<SdKbReviewStateDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const loaded = await loadArticle(workspaceId, articleId)
    if (!loaded.ok) return loaded
    const { article, workspaceIntervalDays } = loaded.value

    if (!ownsArticle(ctx.value, article)) {
      return err(
        sdKbReviewForbidden(
          'Só o autor do artigo (ou um admin) pode pedir revisão',
        ),
      )
    }
    if (article.archivedAt) {
      return err(validationError('Restaure o artigo antes de pedir revisão'))
    }
    if (!article.title.trim()) {
      return err(
        validationError('Dê um título ao artigo antes de pedir revisão'),
      )
    }
    if (dto.reviewerId === actorId) {
      return err(sdKbReviewForbidden('Escolha outro agente para revisar'))
    }

    const pending = await SdKbReviewRepository.findPendingByArticle(articleId)
    if (!pending.ok) return pending
    if (pending.value) {
      return err(sdKbReviewClosed('Este artigo já está em revisão'))
    }

    const reviewers = await SdNotificationRepository.filterAgentIds(
      workspaceId,
      [dto.reviewerId],
    )
    if (!reviewers.ok) return reviewers
    if (reviewers.value.length === 0) {
      return err(sdKbReviewForbidden('O revisor precisa ser um agente'))
    }

    const review = await SdKbReviewRepository.create({
      workspaceId,
      articleId,
      reviewerId: dto.reviewerId,
      comment: dto.comment ?? null,
    })
    audit('request', actorId, articleId, review, {
      reviewerId: dto.reviewerId,
    })
    if (!review.ok) return review

    let current = article
    if (article.status === 'DRAFT') {
      const moved = await SdKbReviewRepository.markInReview(articleId, actorId)
      if (!moved.ok) return moved
      current = moved.value
    }

    const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
    if (workspace.ok && workspace.value) {
      await notifyKbEvent({
        workspaceId,
        event: 'kb.review_requested',
        userIds: [dto.reviewerId],
        actorId,
        title: 'Revisão de artigo pedida a você',
        body: dto.comment?.trim()
          ? dto.comment.trim()
          : 'Revise o artigo e aprove ou peça mudanças.',
        articleTitle: current.title || 'Artigo sem título',
        href: articleHref(workspace.value.slug, articleId),
        action: 'Revisar artigo',
        meta: { articleId, reviewId: review.value.id },
      })
    }

    logger.info('servicedesk.kb.review_requested', {
      workspaceId,
      articleId,
      reviewId: review.value.id,
    })
    return state(articleId, workspaceIntervalDays, current)
  },

  /**
   * Decisão do revisor. Aprovar publica e reinicia a validade; pedir
   * mudanças devolve o rascunho ao autor com o comentário.
   */
  async decide(
    actorId: string,
    workspaceId: string,
    reviewId: string,
    dto: DecideSdKbReviewDTO,
    now: Date = new Date(),
  ): Promise<Result<SdKbReviewStateDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const review = await SdKbReviewRepository.findById(reviewId, workspaceId)
    if (!review.ok) return review
    if (review.value.status !== 'PENDING') return err(sdKbReviewClosed())
    if (!ctx.value.isAdmin && review.value.reviewerId !== actorId) {
      return err(sdKbReviewForbidden())
    }

    const loaded = await loadArticle(workspaceId, review.value.articleId)
    if (!loaded.ok) return loaded
    const { article, workspaceIntervalDays } = loaded.value
    if (article.archivedAt) {
      return err(validationError('O artigo foi arquivado'))
    }

    const approved = dto.decision === 'APPROVE'
    const decided = await SdKbReviewRepository.decide(reviewId, {
      status: approved ? 'APPROVED' : 'CHANGES_REQUESTED',
      comment: dto.comment?.trim() ? dto.comment.trim() : null,
      decidedAt: now,
    })
    audit('respond', actorId, article.id, decided, {
      reviewId,
      decision: dto.decision,
    })
    if (!decided.ok) return decided

    let current = article
    if (approved) {
      const intervalDays =
        dto.reviewIntervalDays === undefined
          ? sdKcsEffectiveInterval(
              article.reviewIntervalDays,
              workspaceIntervalDays,
            )
          : dto.reviewIntervalDays
      const published = await SdKbReviewRepository.publishReviewed(article.id, {
        updatedById: actorId,
        reviewedAt: now,
        reviewDueAt: sdKcsReviewDueAt(now, intervalDays),
        reviewIntervalDays: intervalDays,
      })
      if (!published.ok) return published
      current = published.value
    } else if (article.status === 'IN_REVIEW') {
      // Publicado em revalidação continua publicado; rascunho volta ao autor.
      const draft = await SdKbReviewRepository.markDraft(article.id, actorId)
      if (!draft.ok) return draft
      current = draft.value
    }

    const workspace = await SdTicketContextRepository.findWorkspace(workspaceId)
    if (workspace.ok && workspace.value) {
      await notifyKbEvent({
        workspaceId,
        event: 'kb.review_decided',
        userIds: [article.createdById, article.updatedById],
        actorId,
        title: approved
          ? 'Artigo aprovado e publicado'
          : 'Revisão pediu mudanças no artigo',
        body:
          decided.value.comment ??
          (approved
            ? 'O revisor aprovou o artigo; ele já está publicado.'
            : 'O revisor pediu mudanças no artigo.'),
        articleTitle: current.title || 'Artigo sem título',
        href: articleHref(workspace.value.slug, article.id),
        meta: { articleId: article.id, reviewId },
      })
    }

    logger.info('servicedesk.kb.review_decided', {
      workspaceId,
      articleId: article.id,
      reviewId,
      decision: dto.decision,
    })
    return state(article.id, workspaceIntervalDays, current)
  },

  /** O autor (ou um admin) desiste da revisão: o artigo volta ao rascunho. */
  async cancel(
    actorId: string,
    workspaceId: string,
    reviewId: string,
  ): Promise<Result<SdKbReviewStateDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const review = await SdKbReviewRepository.findById(reviewId, workspaceId)
    if (!review.ok) return review
    if (review.value.status !== 'PENDING') return err(sdKbReviewClosed())

    const loaded = await loadArticle(workspaceId, review.value.articleId)
    if (!loaded.ok) return loaded
    const { article, workspaceIntervalDays } = loaded.value
    if (!ownsArticle(ctx.value, article)) {
      return err(
        sdKbReviewForbidden(
          'Só o autor do artigo (ou um admin) pode cancelar a revisão',
        ),
      )
    }

    const removed = await SdKbReviewRepository.delete(reviewId)
    audit('cancel', actorId, article.id, removed, { reviewId })
    if (!removed.ok) return removed

    let current = article
    if (article.status === 'IN_REVIEW') {
      const draft = await SdKbReviewRepository.markDraft(article.id, actorId)
      if (!draft.ok) return draft
      current = draft.value
    }
    return state(article.id, workspaceIntervalDays, current)
  },

  /** Validade da revisão deste artigo (`null` = sem validade). */
  async setInterval(
    actorId: string,
    workspaceId: string,
    articleId: string,
    dto: SetSdKbReviewIntervalDTO,
    now: Date = new Date(),
  ): Promise<Result<SdKbReviewStateDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const loaded = await loadArticle(workspaceId, articleId)
    if (!loaded.ok) return loaded
    const { article, workspaceIntervalDays } = loaded.value

    // Recalcula o prazo a partir da última revisão (ou da publicação); sem
    // nenhuma das duas, conta de agora.
    const from = article.lastReviewedAt ?? article.publishedAt ?? now
    const result = await SdKbReviewRepository.setReviewInterval(articleId, {
      reviewIntervalDays: dto.reviewIntervalDays,
      reviewDueAt:
        article.status === 'PUBLISHED'
          ? sdKcsReviewDueAt(from, dto.reviewIntervalDays)
          : null,
      updatedById: actorId,
    })
    audit('update', actorId, articleId, result, {
      reviewIntervalDays: dto.reviewIntervalDays,
    })
    if (!result.ok) return result

    return state(articleId, workspaceIntervalDays, result.value)
  },

  /* ----------------------------- configuração ---------------------------- */

  async getSettings(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdKbReviewSettingsDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const settings = await SdTicketContextRepository.ensureSettings(workspaceId)
    if (!settings.ok) return settings
    return ok(toSdKbReviewSettingsDTO(settings.value.kbReviewIntervalDays))
  },

  async updateSettings(
    actorId: string,
    workspaceId: string,
    dto: UpdateSdKbReviewSettingsDTO,
  ): Promise<Result<SdKbReviewSettingsDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const result = await SdSettingsRepository.update(workspaceId, {
      kbReviewIntervalDays: dto.defaultIntervalDays,
      updatedById: actorId,
    })
    audit('update', actorId, workspaceId, result, {
      defaultIntervalDays: dto.defaultIntervalDays,
    })
    if (!result.ok) return result
    return ok(toSdKbReviewSettingsDTO(result.value.kbReviewIntervalDays))
  },

  /* ------------------------------- curadoria ----------------------------- */

  /** Painel KCS: o que mais resolve, o que venceu e o que nunca reusou. */
  async stats(
    actorId: string,
    workspaceId: string,
    dto: SdKbStatsDTO,
    now: Date = new Date(),
  ): Promise<Result<SdKbStatsResultDTO>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const rows = await SdKbReviewRepository.stats(workspaceId, now, dto.limit)
    if (!rows.ok) return rows
    return ok(toSdKbStatsDTO(rows.value))
  },

  /**
   * Checagem diária da validade (um tique por hora; cada workspace só é
   * processado na hora local do resumo, como o `SdDigestService`). Avisa cada
   * mantenedor **uma vez por dia**, com o total dos artigos vencidos dele.
   *
   * Nunca lança: erro de workspace é contado e logado.
   */
  async runDueCheck(now: Date = new Date()): Promise<SdKbReviewDueResult> {
    const result: SdKbReviewDueResult = {
      workspaces: 0,
      due: 0,
      articles: 0,
      notified: 0,
      inApp: 0,
      email: 0,
      errors: 0,
    }
    const workspaces = await SdTicketContextRepository.listEnabledWorkspaceIds()
    if (!workspaces.ok) {
      result.errors += 1
      logger.error('servicedesk.kb.review_due.workspaces_failed', {
        reason: workspaces.error.code,
      })
      return result
    }
    result.workspaces = workspaces.value.length

    for (const workspaceId of workspaces.value) {
      const calendar =
        await SdTicketContextRepository.findDefaultCalendar(workspaceId)
      const timeZone = calendar.ok
        ? (calendar.value?.timezone ?? 'America/Sao_Paulo')
        : 'America/Sao_Paulo'
      if (sdLocalHour(now, timeZone) !== SD_DIGEST_HOUR) continue
      result.due += 1

      const [overdue, workspace] = await Promise.all([
        SdKbReviewRepository.listOverdue(workspaceId, now),
        SdTicketContextRepository.findWorkspace(workspaceId),
      ])
      if (!overdue.ok || !workspace.ok || !workspace.value) {
        result.errors += 1
        logger.warn('servicedesk.kb.review_due.workspace_failed', {
          workspaceId,
        })
        continue
      }
      if (overdue.value.length === 0) continue
      result.articles += overdue.value.length

      // Um aviso por mantenedor (autor e último editor do artigo).
      const byUser = new Map<string, { count: number; title: string }>()
      for (const article of overdue.value) {
        for (const userId of new Set(
          [article.createdById, article.updatedById].filter(
            (id): id is string => Boolean(id),
          ),
        )) {
          const current = byUser.get(userId)
          if (current) current.count += 1
          else byUser.set(userId, { count: 1, title: article.title })
        }
      }

      const href = `/${workspace.value.slug}/servicedesk/knowledge?curation=overdue`
      for (const [userId, info] of byUser) {
        const sent = await notifyKbEvent({
          workspaceId,
          event: 'kb.review_due',
          userIds: [userId],
          title: 'Artigo com revisão vencida',
          body: sdKcsReviewDueBody(info.count),
          articleTitle:
            info.count === 1
              ? info.title
              : `${info.count} artigos para revisar`,
          href,
          action: 'Ver artigos',
          meta: { overdue: info.count },
        })
        if (!sent.ok) {
          result.errors += 1
          continue
        }
        if (sent.value.inApp > 0 || sent.value.email > 0) result.notified += 1
        result.inApp += sent.value.inApp
        result.email += sent.value.email
      }
    }

    logger.info('servicedesk.kb.review_due.tick', { ...result })
    return result
  },
}
