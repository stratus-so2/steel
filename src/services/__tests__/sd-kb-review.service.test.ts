import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { databaseError, sdKbArticleNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { SdKbReviewWithRefs } from '@/src/repositories/sd-kb-review.repository'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-kb-article.repository')
vi.mock('@/src/repositories/sd-kb-review.repository')
vi.mock('@/src/repositories/sd-notification.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/sd-settings.repository')
vi.mock('@/src/services/notification.service')
vi.mock('@/src/lib/mail/servicedesk/send-sd-kb-review')
vi.mock('@/lib/axiom/audit')
vi.mock('@/src/config/servicedesk-notifications', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/src/config/servicedesk-notifications')
    >()
  return { ...actual, sdNotificationEvent: vi.fn(actual.sdNotificationEvent) }
})

import { auditMutation } from '@/lib/axiom/audit'
import { sdNotificationEvent } from '@/src/config/servicedesk-notifications'
import { sendSdKbReviewEmail } from '@/src/lib/mail/servicedesk/send-sd-kb-review'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import { SdKbReviewRepository } from '@/src/repositories/sd-kb-review.repository'
import { SdNotificationRepository } from '@/src/repositories/sd-notification.repository'
import { SdSettingsRepository } from '@/src/repositories/sd-settings.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { NotificationService } from '@/src/services/notification.service'
import { SdKbReviewService } from '../sd-kb-review.service'

const articles = vi.mocked(SdKbArticleRepository)
const reviews = vi.mocked(SdKbReviewRepository)
const notifications = vi.mocked(SdNotificationRepository)
const context = vi.mocked(SdTicketContextRepository)
const settingsRepo = vi.mocked(SdSettingsRepository)
const notify = vi.mocked(NotificationService)
const mail = vi.mocked(sendSdKbReviewEmail)
const audit = vi.mocked(auditMutation)
const catalog = vi.mocked(sdNotificationEvent)

const WS = 'ws1'
const AUTHOR = 'u1'
const REVIEWER = 'u2'
const NOW = new Date('2026-10-02T12:00:00.000Z')

const article = createFakeSdKbArticle({
  id: 'a1',
  workspaceId: WS,
  title: 'Como redefinir a senha da VPN',
  createdById: AUTHOR,
  updatedById: AUTHOR,
})

function review(overrides?: Partial<SdKbReviewWithRefs>): SdKbReviewWithRefs {
  return {
    id: 'r1',
    workspaceId: WS,
    articleId: 'a1',
    reviewerId: REVIEWER,
    status: 'PENDING',
    comment: null,
    decidedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    reviewer: { id: REVIEWER, name: 'Bruno', image: null },
    article: {
      id: 'a1',
      title: article.title,
      icon: null,
      status: 'IN_REVIEW',
    },
    ...overrides,
  }
}

beforeEach(() => {
  actAs('agent')
  articles.findById.mockResolvedValue(ok(article))
  context.ensureSettings.mockResolvedValue(
    ok(createFakeSdSettings({ workspaceId: WS, kbReviewIntervalDays: 180 })),
  )
  context.findWorkspace.mockResolvedValue(
    ok({ id: WS, name: 'Stratus', slug: 'stratus' }),
  )
  context.listEnabledWorkspaceIds.mockResolvedValue(ok([WS]))
  context.findDefaultCalendar.mockResolvedValue(
    ok({ timezone: 'America/Sao_Paulo' } as never),
  )
  reviews.findPendingByArticle.mockResolvedValue(ok(null))
  reviews.listByArticle.mockResolvedValue(ok([]))
  reviews.create.mockResolvedValue(ok(review()))
  reviews.markInReview.mockResolvedValue(
    ok({ ...article, status: 'IN_REVIEW' }),
  )
  reviews.markDraft.mockResolvedValue(ok({ ...article, status: 'DRAFT' }))
  reviews.publishReviewed.mockResolvedValue(
    ok({ ...article, status: 'PUBLISHED' }),
  )
  reviews.setReviewInterval.mockResolvedValue(ok(article))
  reviews.delete.mockResolvedValue(ok(undefined))
  reviews.findById.mockResolvedValue(ok(review()))
  notifications.filterAgentIds.mockImplementation(async (_ws, ids) => ok(ids))
  notifications.findRecipients.mockImplementation(async (_ws, ids) =>
    ok(
      ids.map((id) => ({
        id,
        name: id === AUTHOR ? 'Ana' : 'Bruno',
        email: `${id}@example.com`,
      })) as never,
    ),
  )
  notifications.listPreferencesForEvent.mockResolvedValue(ok([]))
  notify.notifyUsers.mockResolvedValue(ok(1))
  mail.mockResolvedValue(undefined as never)
})

describe('SdKbReviewService.getState', () => {
  it('devolve validade efetiva, prazo e histórico', async () => {
    reviews.listByArticle.mockResolvedValue(
      ok([review({ status: 'APPROVED' })]),
    )
    const state = expectOk(await SdKbReviewService.getState(AUTHOR, WS, 'a1'))
    expect(state).toMatchObject({
      articleId: 'a1',
      effectiveIntervalDays: 180,
      overdue: false,
      pending: null,
    })
    expect(state.history).toHaveLength(1)
  })

  it('recusa solicitante e não-membro', async () => {
    actAs('requester')
    expectErr(
      await SdKbReviewService.getState(AUTHOR, WS, 'a1'),
      'SD_NOT_AGENT',
    )
    actAs('non-member')
    expectErr(await SdKbReviewService.getState(AUTHOR, WS, 'a1'), 'FORBIDDEN')
  })

  it('propaga artigo inexistente', async () => {
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbReviewService.getState(AUTHOR, WS, 'a1'),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
  })

  it('propaga erro ao ler a configuração do módulo', async () => {
    context.ensureSettings.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.getState(AUTHOR, WS, 'a1'),
      'DATABASE_ERROR',
    )
  })

  it('propaga erro ao ler a pendência e o histórico', async () => {
    reviews.findPendingByArticle.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.getState(AUTHOR, WS, 'a1'),
      'DATABASE_ERROR',
    )
    reviews.findPendingByArticle.mockResolvedValue(ok(null))
    reviews.listByArticle.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.getState(AUTHOR, WS, 'a1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewService.list', () => {
  it('lista a fila e filtra pelas minhas revisões', async () => {
    reviews.listByWorkspace.mockResolvedValue(ok([review()]))
    const all = expectOk(
      await SdKbReviewService.list(REVIEWER, WS, { mine: false, limit: 20 }),
    )
    expect(all).toHaveLength(1)
    expect(reviews.listByWorkspace).toHaveBeenCalledWith(WS, {
      status: undefined,
      reviewerId: undefined,
      limit: 20,
    })

    await SdKbReviewService.list(REVIEWER, WS, {
      mine: true,
      status: 'PENDING',
      limit: 5,
    })
    expect(reviews.listByWorkspace).toHaveBeenLastCalledWith(WS, {
      status: 'PENDING',
      reviewerId: REVIEWER,
      limit: 5,
    })
  })

  it('recusa solicitante e propaga erro do banco', async () => {
    actAs('requester')
    expectErr(
      await SdKbReviewService.list(REVIEWER, WS, { mine: false, limit: 20 }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    reviews.listByWorkspace.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.list(REVIEWER, WS, { mine: false, limit: 20 }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewService.request', () => {
  it('cria a revisão, move o rascunho e avisa o revisor', async () => {
    const state = expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
        comment: 'confere o passo 3',
      }),
    )
    expect(state.status).toBe('IN_REVIEW')
    expect(reviews.markInReview).toHaveBeenCalledWith('a1', AUTHOR)
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [REVIEWER], kind: 'SD_KB_REVIEW' }),
    )
    expect(mail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'u2@example.com',
        message: 'confere o passo 3',
      }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_kb_review', action: 'request' }),
    )
  })

  it('mantém o artigo publicado durante a revalidação', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'PUBLISHED' }))
    const state = expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(state.status).toBe('PUBLISHED')
    expect(reviews.markInReview).not.toHaveBeenCalled()
  })

  it('só o autor ou um admin pede revisão', async () => {
    expectErr(
      await SdKbReviewService.request('outro', WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'SD_KB_REVIEW_FORBIDDEN',
    )
    actAs('admin')
    expectOk(
      await SdKbReviewService.request('outro', WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
  })

  it('barra artigo arquivado, sem título e autorrevisão', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, archivedAt: NOW }))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'VALIDATION_ERROR',
    )
    articles.findById.mockResolvedValue(ok({ ...article, title: '  ' }))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'VALIDATION_ERROR',
    )
    articles.findById.mockResolvedValue(ok(article))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', { reviewerId: AUTHOR }),
      'SD_KB_REVIEW_FORBIDDEN',
    )
  })

  it('recusa quando já existe revisão pendente', async () => {
    reviews.findPendingByArticle.mockResolvedValue(ok(review()))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'SD_KB_REVIEW_CLOSED',
    )
  })

  it('exige que o revisor seja agente', async () => {
    notifications.filterAgentIds.mockResolvedValue(ok([]))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'SD_KB_REVIEW_FORBIDDEN',
    )
  })

  it('propaga erros do banco (pendência, agentes, criação, status)', async () => {
    reviews.findPendingByArticle.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'DATABASE_ERROR',
    )
    reviews.findPendingByArticle.mockResolvedValue(ok(null))
    notifications.filterAgentIds.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'DATABASE_ERROR',
    )
    notifications.filterAgentIds.mockImplementation(async (_ws, ids) => ok(ids))
    reviews.create.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'DATABASE_ERROR',
    )
    reviews.create.mockResolvedValue(ok(review()))
    reviews.markInReview.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'DATABASE_ERROR',
    )
  })

  it('segue mesmo quando o aviso não encontra a workspace', async () => {
    context.findWorkspace.mockResolvedValue(ok(null))
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(notify.notifyUsers).not.toHaveBeenCalled()
  })
})

describe('SdKbReviewService.decide', () => {
  it('aprova: publica, carimba a revisão e avisa o autor', async () => {
    reviews.decide.mockResolvedValue(
      ok(review({ status: 'APPROVED', decidedAt: NOW })),
    )
    const state = expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
    )
    expect(state.status).toBe('PUBLISHED')
    expect(reviews.publishReviewed).toHaveBeenCalledWith('a1', {
      updatedById: REVIEWER,
      reviewedAt: NOW,
      reviewDueAt: new Date('2027-03-31T12:00:00.000Z'),
      reviewIntervalDays: 180,
    })
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [AUTHOR] }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'respond',
        meta: expect.objectContaining({ decision: 'APPROVE' }),
      }),
    )
  })

  it('aprova com validade explícita, inclusive sem validade (null)', async () => {
    reviews.decide.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE', reviewIntervalDays: 30 },
        NOW,
      ),
    )
    expect(reviews.publishReviewed).toHaveBeenLastCalledWith(
      'a1',
      expect.objectContaining({
        reviewIntervalDays: 30,
        reviewDueAt: new Date('2026-11-01T12:00:00.000Z'),
      }),
    )
    expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE', reviewIntervalDays: null },
        NOW,
      ),
    )
    expect(reviews.publishReviewed).toHaveBeenLastCalledWith(
      'a1',
      expect.objectContaining({ reviewIntervalDays: null, reviewDueAt: null }),
    )
  })

  it('usa a validade do próprio artigo quando ele tem uma', async () => {
    articles.findById.mockResolvedValue(
      ok({ ...article, reviewIntervalDays: 10 }),
    )
    reviews.decide.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
    )
    expect(reviews.publishReviewed).toHaveBeenLastCalledWith(
      'a1',
      expect.objectContaining({ reviewIntervalDays: 10 }),
    )
  })

  it('pede mudanças: volta ao rascunho com o comentário', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'IN_REVIEW' }))
    reviews.decide.mockResolvedValue(
      ok(review({ status: 'CHANGES_REQUESTED', comment: 'falta validar' })),
    )
    const state = expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'REQUEST_CHANGES', comment: ' falta validar ' },
        NOW,
      ),
    )
    expect(state.status).toBe('DRAFT')
    expect(reviews.decide).toHaveBeenCalledWith('r1', {
      status: 'CHANGES_REQUESTED',
      comment: 'falta validar',
      decidedAt: NOW,
    })
    expect(reviews.publishReviewed).not.toHaveBeenCalled()
  })

  it('pede mudanças num artigo publicado sem tirá-lo do ar', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'PUBLISHED' }))
    reviews.decide.mockResolvedValue(
      ok(review({ status: 'CHANGES_REQUESTED', comment: 'desatualizado' })),
    )
    const state = expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'REQUEST_CHANGES', comment: 'desatualizado' },
        NOW,
      ),
    )
    expect(state.status).toBe('PUBLISHED')
    expect(reviews.markDraft).not.toHaveBeenCalled()
  })

  it('só o revisor escolhido (ou um admin) decide', async () => {
    expectErr(
      await SdKbReviewService.decide(
        'outro',
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'SD_KB_REVIEW_FORBIDDEN',
    )
    actAs('admin')
    reviews.decide.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    expectOk(
      await SdKbReviewService.decide(
        'outro',
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
    )
  })

  it('recusa revisão já decidida, inexistente ou de artigo arquivado', async () => {
    reviews.findById.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'SD_KB_REVIEW_CLOSED',
    )
    reviews.findById.mockResolvedValue(ok(review()))
    articles.findById.mockResolvedValue(ok({ ...article, archivedAt: NOW }))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'VALIDATION_ERROR',
    )
  })

  it('propaga erros do banco (busca, decisão, publicação, rascunho)', async () => {
    reviews.findById.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'DATABASE_ERROR',
    )
    reviews.findById.mockResolvedValue(ok(review()))
    reviews.decide.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'DATABASE_ERROR',
    )
    reviews.decide.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    reviews.publishReviewed.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'DATABASE_ERROR',
    )
    articles.findById.mockResolvedValue(ok({ ...article, status: 'IN_REVIEW' }))
    reviews.decide.mockResolvedValue(ok(review({ comment: 'muda' })))
    reviews.markDraft.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'REQUEST_CHANGES', comment: 'muda' },
        NOW,
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewService.cancel', () => {
  it('apaga a pendência e devolve o rascunho ao autor', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'IN_REVIEW' }))
    const state = expectOk(await SdKbReviewService.cancel(AUTHOR, WS, 'r1'))
    expect(state.status).toBe('DRAFT')
    expect(reviews.delete).toHaveBeenCalledWith('r1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cancel' }),
    )
  })

  it('recusa quem não é autor nem admin, e revisão já decidida', async () => {
    expectErr(
      await SdKbReviewService.cancel('outro', WS, 'r1'),
      'SD_KB_REVIEW_FORBIDDEN',
    )
    reviews.findById.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    expectErr(
      await SdKbReviewService.cancel(AUTHOR, WS, 'r1'),
      'SD_KB_REVIEW_CLOSED',
    )
  })

  it('propaga erro do banco ao apagar e ao voltar o status', async () => {
    reviews.delete.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.cancel(AUTHOR, WS, 'r1'),
      'DATABASE_ERROR',
    )
    reviews.delete.mockResolvedValue(ok(undefined))
    articles.findById.mockResolvedValue(ok({ ...article, status: 'IN_REVIEW' }))
    reviews.markDraft.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.cancel(AUTHOR, WS, 'r1'),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewService.setInterval', () => {
  it('recalcula o prazo do publicado a partir da última revisão', async () => {
    articles.findById.mockResolvedValue(
      ok({
        ...article,
        status: 'PUBLISHED',
        lastReviewedAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
    )
    expectOk(
      await SdKbReviewService.setInterval(
        AUTHOR,
        WS,
        'a1',
        { reviewIntervalDays: 10 },
        NOW,
      ),
    )
    expect(reviews.setReviewInterval).toHaveBeenCalledWith('a1', {
      reviewIntervalDays: 10,
      reviewDueAt: new Date('2026-09-11T00:00:00.000Z'),
      updatedById: AUTHOR,
    })
  })

  it('rascunho fica sem prazo até ser publicado', async () => {
    expectOk(
      await SdKbReviewService.setInterval(
        AUTHOR,
        WS,
        'a1',
        { reviewIntervalDays: 10 },
        NOW,
      ),
    )
    expect(reviews.setReviewInterval).toHaveBeenCalledWith('a1', {
      reviewIntervalDays: 10,
      reviewDueAt: null,
      updatedById: AUTHOR,
    })
  })

  it('conta de agora quando o artigo nunca foi revisado nem publicado', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'PUBLISHED' }))
    expectOk(
      await SdKbReviewService.setInterval(
        AUTHOR,
        WS,
        'a1',
        { reviewIntervalDays: 1 },
        NOW,
      ),
    )
    expect(reviews.setReviewInterval).toHaveBeenCalledWith('a1', {
      reviewIntervalDays: 1,
      reviewDueAt: new Date('2026-10-03T12:00:00.000Z'),
      updatedById: AUTHOR,
    })
  })

  it('recusa solicitante e propaga erro do banco', async () => {
    actAs('requester')
    expectErr(
      await SdKbReviewService.setInterval(AUTHOR, WS, 'a1', {
        reviewIntervalDays: 10,
      }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    reviews.setReviewInterval.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.setInterval(AUTHOR, WS, 'a1', {
        reviewIntervalDays: 10,
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewService — configuração e curadoria', () => {
  it('lê e grava a validade padrão (gravar é de admin)', async () => {
    const read = expectOk(await SdKbReviewService.getSettings(AUTHOR, WS))
    expect(read).toEqual({ defaultIntervalDays: 180 })

    expectErr(
      await SdKbReviewService.updateSettings(AUTHOR, WS, {
        defaultIntervalDays: 90,
      }),
      'FORBIDDEN',
    )

    actAs('admin')
    settingsRepo.update.mockResolvedValue(
      ok(createFakeSdSettings({ kbReviewIntervalDays: 90 })),
    )
    const saved = expectOk(
      await SdKbReviewService.updateSettings(AUTHOR, WS, {
        defaultIntervalDays: 90,
      }),
    )
    expect(saved).toEqual({ defaultIntervalDays: 90 })
    expect(settingsRepo.update).toHaveBeenCalledWith(WS, {
      kbReviewIntervalDays: 90,
      updatedById: AUTHOR,
    })
  })

  it('propaga erros de leitura e de gravação da configuração', async () => {
    context.ensureSettings.mockResolvedValue(err(databaseError('x')))
    expectErr(await SdKbReviewService.getSettings(AUTHOR, WS), 'DATABASE_ERROR')
    actAs('admin')
    settingsRepo.update.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.updateSettings(AUTHOR, WS, {
        defaultIntervalDays: 90,
      }),
      'DATABASE_ERROR',
    )
  })

  it('resume a base para a curadoria', async () => {
    reviews.stats.mockResolvedValue(
      ok({
        published: 3,
        inReview: 1,
        overdue: 1,
        neverReused: 1,
        resolvedTickets: 6,
        mostReused: [createFakeSdKbArticle({ id: 'a1', reuseCount: 5 })],
        overdueArticles: [],
        neverReusedArticles: [],
      }),
    )
    const stats = expectOk(
      await SdKbReviewService.stats(AUTHOR, WS, { limit: 5 }, NOW),
    )
    expect(stats.totals.resolvedTickets).toBe(6)
    expect(reviews.stats).toHaveBeenCalledWith(WS, NOW, 5)
  })

  it('curadoria recusa solicitante e propaga erro do banco', async () => {
    actAs('requester')
    expectErr(
      await SdKbReviewService.stats(AUTHOR, WS, { limit: 5 }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    reviews.stats.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.stats(AUTHOR, WS, { limit: 5 }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdKbReviewService.runDueCheck', () => {
  /** 8h em São Paulo (UTC-3) = 11h UTC. */
  const AT_DIGEST_HOUR = new Date('2026-10-02T11:00:00.000Z')

  beforeEach(() => {
    reviews.listOverdue.mockResolvedValue(
      ok([
        {
          id: 'a1',
          workspaceId: WS,
          title: 'VPN',
          reviewDueAt: new Date('2026-09-01T00:00:00.000Z'),
          createdById: AUTHOR,
          updatedById: AUTHOR,
        },
      ]),
    )
  })

  it('avisa o mantenedor uma vez, com o total dos artigos vencidos', async () => {
    reviews.listOverdue.mockResolvedValue(
      ok([
        {
          id: 'a1',
          workspaceId: WS,
          title: 'VPN',
          reviewDueAt: new Date('2026-09-01T00:00:00.000Z'),
          createdById: AUTHOR,
          updatedById: AUTHOR,
        },
        {
          id: 'a2',
          workspaceId: WS,
          title: 'Impressora',
          reviewDueAt: new Date('2026-09-02T00:00:00.000Z'),
          createdById: AUTHOR,
          updatedById: null,
        },
      ]),
    )
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result).toMatchObject({
      workspaces: 1,
      due: 1,
      articles: 2,
      notified: 1,
      errors: 0,
    })
    expect(notify.notifyUsers).toHaveBeenCalledTimes(1)
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: [AUTHOR],
        body: '2 artigos que você mantém estão com a revisão vencida.',
        href: '/stratus/servicedesk/knowledge?curation=overdue',
      }),
    )
  })

  it('não faz nada fora da hora local combinada', async () => {
    const result = await SdKbReviewService.runDueCheck(
      new Date('2026-10-02T23:00:00.000Z'),
    )
    expect(result).toMatchObject({ workspaces: 1, due: 0, articles: 0 })
    expect(reviews.listOverdue).not.toHaveBeenCalled()
  })

  it('usa o fuso do calendário padrão do workspace', async () => {
    context.findDefaultCalendar.mockResolvedValue(
      ok({ timezone: 'Europe/Lisbon' } as never),
    )
    const result = await SdKbReviewService.runDueCheck(
      new Date('2026-10-02T07:00:00.000Z'),
    )
    expect(result.due).toBe(1)
  })

  it('sem workspace habilitado, nada acontece', async () => {
    context.listEnabledWorkspaceIds.mockResolvedValue(ok([]))
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result).toMatchObject({ workspaces: 0, due: 0, notified: 0 })
  })

  it('conta erro quando não dá para listar os workspaces', async () => {
    context.listEnabledWorkspaceIds.mockResolvedValue(err(databaseError('x')))
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result.errors).toBe(1)
  })

  it('conta erro do workspace e segue', async () => {
    reviews.listOverdue.mockResolvedValue(err(databaseError('x')))
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result).toMatchObject({ due: 1, articles: 0, errors: 1 })

    reviews.listOverdue.mockResolvedValue(ok([]))
    const empty = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(empty).toMatchObject({ articles: 0, notified: 0, errors: 0 })
  })

  it('conta erro quando a entrega do aviso falha', async () => {
    notifications.filterAgentIds.mockResolvedValue(err(databaseError('x')))
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result).toMatchObject({ articles: 1, notified: 0, errors: 1 })
  })

  it('calendário indisponível cai no fuso padrão', async () => {
    context.findDefaultCalendar.mockResolvedValue(err(databaseError('x')))
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result.due).toBe(1)
  })
})

describe('entrega dos avisos da base', () => {
  it('respeita a preferência do usuário por canal', async () => {
    notifications.listPreferencesForEvent.mockResolvedValue(
      ok([
        {
          userId: REVIEWER,
          event: 'kb.review_requested',
          channel: 'EMAIL',
          enabled: false,
        },
      ] as never),
    )
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(notify.notifyUsers).toHaveBeenCalledTimes(1)
    expect(mail).not.toHaveBeenCalled()
  })

  it('não avisa o próprio ator', async () => {
    actAs('admin')
    reviews.decide.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    // O admin que decide é o autor do artigo: ninguém a notificar.
    expectOk(
      await SdKbReviewService.decide(
        AUTHOR,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
    )
    expect(notify.notifyUsers).not.toHaveBeenCalled()
  })

  it('loga falha de canal sem derrubar a ação', async () => {
    notify.notifyUsers.mockResolvedValue(err(databaseError('x')))
    mail.mockRejectedValue(new Error('smtp'))
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
  })

  it('propaga erro ao montar os destinatários do aviso', async () => {
    notifications.findRecipients.mockResolvedValue(err(databaseError('x')))
    // O aviso falha, mas a revisão já foi criada: a ação não quebra.
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    notifications.listPreferencesForEvent.mockResolvedValue(
      err(databaseError('x')),
    )
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
  })
})

describe('cobertura das bordas do KCS', () => {
  it('request recusa solicitante e propaga artigo inexistente', async () => {
    actAs('requester')
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
  })

  it('decide recusa solicitante e propaga artigo inexistente', async () => {
    actAs('requester')
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
  })

  it('cancel recusa solicitante, revisão e artigo inexistentes', async () => {
    actAs('requester')
    expectErr(await SdKbReviewService.cancel(AUTHOR, WS, 'r1'), 'SD_NOT_AGENT')
    actAs('agent')
    reviews.findById.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await SdKbReviewService.cancel(AUTHOR, WS, 'r1'),
      'DATABASE_ERROR',
    )
    reviews.findById.mockResolvedValue(ok(review()))
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbReviewService.cancel(AUTHOR, WS, 'r1'),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
  })

  it('cancelar a revalidação não tira o artigo publicado do ar', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'PUBLISHED' }))
    const state = expectOk(await SdKbReviewService.cancel(AUTHOR, WS, 'r1'))
    expect(state.status).toBe('PUBLISHED')
    expect(reviews.markDraft).not.toHaveBeenCalled()
  })

  it('setInterval propaga artigo inexistente', async () => {
    articles.findById.mockResolvedValue(err(sdKbArticleNotFound()))
    expectErr(
      await SdKbReviewService.setInterval(AUTHOR, WS, 'a1', {
        reviewIntervalDays: 10,
      }),
      'SD_KB_ARTICLE_NOT_FOUND',
    )
  })

  it('getSettings recusa solicitante', async () => {
    actAs('requester')
    expectErr(await SdKbReviewService.getSettings(AUTHOR, WS), 'SD_NOT_AGENT')
  })

  it('artigo sem título aparece no aviso como vazio, sem quebrar', async () => {
    articles.findById.mockResolvedValue(
      ok({ ...article, title: '', status: 'IN_REVIEW' }),
    )
    reviews.markDraft.mockResolvedValue(ok({ ...article, title: '' }))
    reviews.decide.mockResolvedValue(ok(review({ comment: 'muda' })))
    expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'REQUEST_CHANGES', comment: 'muda' },
        NOW,
      ),
    )
    expect(mail).toHaveBeenCalledWith(
      expect.objectContaining({ articleTitle: '' }),
    )
  })

  it('pedido de mudanças sem comentário gravado usa a frase padrão', async () => {
    articles.findById.mockResolvedValue(ok({ ...article, status: 'IN_REVIEW' }))
    reviews.decide.mockResolvedValue(
      ok(review({ status: 'CHANGES_REQUESTED', comment: null })),
    )
    expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'REQUEST_CHANGES', comment: 'muda' },
        NOW,
      ),
    )
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        body: 'O revisor pediu mudanças no artigo.',
      }),
    )
  })

  it('evento fora do catálogo não avisa ninguém', async () => {
    catalog.mockReturnValueOnce(undefined)
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(notify.notifyUsers).not.toHaveBeenCalled()
    expect(mail).not.toHaveBeenCalled()
  })

  it('aviso sem workspace encontrada não entrega nada', async () => {
    context.findWorkspace.mockResolvedValue(ok(null))
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(notify.notifyUsers).not.toHaveBeenCalled()
  })

  it('aviso propaga falha ao resolver a workspace e os destinatários', async () => {
    context.findWorkspace.mockResolvedValue(err(databaseError('x')))
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    context.findWorkspace.mockResolvedValue(
      ok({ id: WS, name: 'Stratus', slug: 'stratus' }),
    )
    notifications.listPreferencesForEvent.mockResolvedValue(
      err(databaseError('x')),
    )
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(notify.notifyUsers).not.toHaveBeenCalled()
  })

  it('só e-mail quando o usuário desligou o in-app', async () => {
    notifications.listPreferencesForEvent.mockResolvedValue(
      ok([
        {
          userId: REVIEWER,
          event: 'kb.review_requested',
          channel: 'IN_APP',
          enabled: false,
        },
      ] as never),
    )
    expectOk(
      await SdKbReviewService.request(AUTHOR, WS, 'a1', {
        reviewerId: REVIEWER,
      }),
    )
    expect(notify.notifyUsers).not.toHaveBeenCalled()
    expect(mail).toHaveBeenCalledTimes(1)
  })

  it('mantém o escolhido quando ele não é agente de departamento (admin)', async () => {
    reviews.findById.mockResolvedValue(ok(review()))
    reviews.decide.mockResolvedValue(ok(review({ status: 'APPROVED' })))
    notifications.filterAgentIds.mockResolvedValue(ok([]))
    expectOk(
      await SdKbReviewService.decide(
        REVIEWER,
        WS,
        'r1',
        { decision: 'APPROVE' },
        NOW,
      ),
    )
    expect(notify.notifyUsers).toHaveBeenCalledWith(
      expect.objectContaining({ userIds: [AUTHOR] }),
    )
  })

  it('tique diário: workspace sem calendário e aviso que não entrega', async () => {
    const AT_DIGEST_HOUR = new Date('2026-10-02T11:00:00.000Z')
    context.findDefaultCalendar.mockResolvedValue(ok(null))
    reviews.listOverdue.mockResolvedValue(
      ok([
        {
          id: 'a1',
          workspaceId: WS,
          title: 'VPN',
          reviewDueAt: new Date('2026-09-01T00:00:00.000Z'),
          createdById: AUTHOR,
          updatedById: null,
        },
      ]),
    )
    notifications.listPreferencesForEvent.mockResolvedValue(
      ok([
        {
          userId: AUTHOR,
          event: 'kb.review_due',
          channel: 'IN_APP',
          enabled: false,
        },
        {
          userId: AUTHOR,
          event: 'kb.review_due',
          channel: 'EMAIL',
          enabled: false,
        },
      ] as never),
    )
    const result = await SdKbReviewService.runDueCheck(AT_DIGEST_HOUR)
    expect(result).toMatchObject({
      due: 1,
      articles: 1,
      notified: 0,
      errors: 0,
    })
  })
})
