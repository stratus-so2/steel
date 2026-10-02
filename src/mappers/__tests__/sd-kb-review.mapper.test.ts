import { describe, expect, it } from 'vitest'
import { createFakeSdKbArticle } from '@/src/__tests__/factories/sd-kb.factory'
import type { SdKbReviewWithRefs } from '@/src/repositories/sd-kb-review.repository'
import {
  toSdKbReviewDTO,
  toSdKbReviewSettingsDTO,
  toSdKbReviewStateDTO,
  toSdKbStatsDTO,
} from '../sd-kb-review.mapper'

const now = new Date('2026-10-02T12:00:00.000Z')

function review(overrides?: Partial<SdKbReviewWithRefs>): SdKbReviewWithRefs {
  return {
    id: 'r1',
    workspaceId: 'ws1',
    articleId: 'a1',
    reviewerId: 'u2',
    status: 'PENDING',
    comment: null,
    decidedAt: null,
    createdAt: now,
    updatedAt: now,
    reviewer: { id: 'u2', name: 'Bruno', image: null },
    article: { id: 'a1', title: 'VPN', icon: null, status: 'IN_REVIEW' },
    ...overrides,
  }
}

describe('toSdKbReviewDTO', () => {
  it('serializa as datas e mantém revisor e artigo', () => {
    const dto = toSdKbReviewDTO(
      review({
        status: 'APPROVED',
        comment: 'ok',
        decidedAt: new Date('2026-10-03T00:00:00.000Z'),
      }),
    )
    expect(dto).toEqual({
      id: 'r1',
      workspaceId: 'ws1',
      articleId: 'a1',
      status: 'APPROVED',
      comment: 'ok',
      decidedAt: '2026-10-03T00:00:00.000Z',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      reviewerId: 'u2',
      reviewer: { id: 'u2', name: 'Bruno', image: null },
      article: { id: 'a1', title: 'VPN', icon: null, status: 'IN_REVIEW' },
    })
  })

  it('aceita revisão sem revisor nem artigo carregado', () => {
    const dto = toSdKbReviewDTO(
      review({ reviewerId: null, reviewer: null, article: null as never }),
    )
    expect(dto.reviewer).toBeNull()
    expect(dto.article).toBeNull()
    expect(dto.decidedAt).toBeNull()
  })
})

describe('toSdKbReviewStateDTO', () => {
  it('resolve a validade efetiva, o vencido e o histórico', () => {
    const article = createFakeSdKbArticle({
      id: 'a1',
      status: 'PUBLISHED',
      reviewIntervalDays: null,
      reviewDueAt: new Date('2026-10-01T00:00:00.000Z'),
      lastReviewedAt: new Date('2026-04-01T00:00:00.000Z'),
    })
    const dto = toSdKbReviewStateDTO({
      article,
      workspaceIntervalDays: 180,
      pending: null,
      history: [review({ status: 'APPROVED', decidedAt: now })],
      now,
    })
    expect(dto).toMatchObject({
      articleId: 'a1',
      status: 'PUBLISHED',
      reviewIntervalDays: null,
      effectiveIntervalDays: 180,
      reviewDueAt: '2026-10-01T00:00:00.000Z',
      lastReviewedAt: '2026-04-01T00:00:00.000Z',
      overdue: true,
      pending: null,
    })
    expect(dto.history).toHaveLength(1)
  })

  it('usa a validade do artigo, marca a pendência e não vence sem prazo', () => {
    const article = createFakeSdKbArticle({ id: 'a2', reviewIntervalDays: 30 })
    const dto = toSdKbReviewStateDTO({
      article,
      workspaceIntervalDays: 180,
      pending: review({ articleId: 'a2' }),
      history: [],
    })
    expect(dto.effectiveIntervalDays).toBe(30)
    expect(dto.overdue).toBe(false)
    expect(dto.reviewDueAt).toBeNull()
    expect(dto.pending?.id).toBe('r1')
  })
})

describe('toSdKbReviewSettingsDTO', () => {
  it('devolve a validade padrão do workspace', () => {
    expect(toSdKbReviewSettingsDTO(90)).toEqual({ defaultIntervalDays: 90 })
  })
})

describe('toSdKbStatsDTO', () => {
  it('monta os totais e os três rankings', () => {
    const reused = createFakeSdKbArticle({ id: 'a1', reuseCount: 4 })
    const overdue = createFakeSdKbArticle({ id: 'a2' })
    const never = createFakeSdKbArticle({ id: 'a3' })
    const dto = toSdKbStatsDTO({
      published: 10,
      inReview: 2,
      overdue: 1,
      neverReused: 3,
      resolvedTickets: 7,
      mostReused: [reused],
      overdueArticles: [overdue],
      neverReusedArticles: [never],
    })
    expect(dto.totals).toEqual({
      published: 10,
      inReview: 2,
      overdue: 1,
      neverReused: 3,
      resolvedTickets: 7,
    })
    expect(dto.mostReused[0]).toMatchObject({ id: 'a1', reuseCount: 4 })
    expect(dto.overdue.map((a) => a.id)).toEqual(['a2'])
    expect(dto.neverReused.map((a) => a.id)).toEqual(['a3'])
  })
})
