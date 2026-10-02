import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdKbReviewDTO, SdKbReviewStateDTO } from '@/types/sd-kb-review'
import { SdKbCuration } from '../sd-kb-curation'
import { SdKbDraftSuggestions } from '../sd-kb-draft-suggestions'
import { SdKbReviewPanel } from '../sd-kb-review-panel'
import { sdKbReviewOverdue, sdKbTopReused } from '../sd-kb-utils'
import { article, summary, WS } from './sd-kb-fixtures'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/servicedesk/knowledge',
}))

const AUTHOR = 'u1'
const REVIEWER = 'u2'

const AGENTS = [
  {
    id: AUTHOR,
    name: 'Ana',
    email: 'ana@example.com',
    image: null,
    isAdmin: false,
    isAgent: true,
    departments: [],
  },
  {
    id: REVIEWER,
    name: 'Bruno',
    email: 'bruno@example.com',
    image: null,
    isAdmin: false,
    isAgent: true,
    departments: [],
  },
]

function me(userId: string, isAdmin = false) {
  return {
    userId,
    isAgent: true,
    isAdmin,
    departmentIds: ['d1'],
    leadDepartmentIds: [],
  }
}

function pending(overrides: Partial<SdKbReviewDTO> = {}): SdKbReviewDTO {
  return {
    id: 'r1',
    workspaceId: WS,
    articleId: 'a1',
    status: 'PENDING',
    comment: 'confere o passo 3',
    decidedAt: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    updatedAt: '2026-10-01T12:00:00.000Z',
    reviewerId: REVIEWER,
    reviewer: { id: REVIEWER, name: 'Bruno', image: null },
    article: {
      id: 'a1',
      title: 'VPN corporativa',
      icon: null,
      status: 'IN_REVIEW',
    },
    ...overrides,
  }
}

function state(
  overrides: Partial<SdKbReviewStateDTO> = {},
): SdKbReviewStateDTO {
  return {
    articleId: 'a1',
    status: 'DRAFT',
    reviewIntervalDays: null,
    effectiveIntervalDays: 180,
    reviewDueAt: null,
    lastReviewedAt: null,
    overdue: false,
    pending: null,
    history: [],
    ...overrides,
  }
}

function panelRoutes(reviewState: SdKbReviewStateDTO, userId = AUTHOR) {
  return [
    { match: '/servicedesk/me', data: me(userId) },
    { match: '/servicedesk/agents', data: AGENTS },
    { method: 'POST', match: '/knowledge/a1/reviews', data: reviewState },
    {
      method: 'PATCH',
      match: '/knowledge/a1/review-interval',
      data: reviewState,
    },
    { method: 'PATCH', match: '/knowledge/reviews/r1', data: reviewState },
    { method: 'DELETE', match: '/knowledge/reviews/r1', data: reviewState },
    { match: '/knowledge/a1/reviews', data: reviewState },
  ]
}

describe('utilitários do KCS no cliente', () => {
  it('reconhece a revisão vencida e ordena por reuso', () => {
    const now = new Date('2026-10-02T12:00:00.000Z').getTime()
    expect(sdKbReviewOverdue('2026-10-01T00:00:00.000Z', now)).toBe(true)
    expect(sdKbReviewOverdue('2026-11-01T00:00:00.000Z', now)).toBe(false)
    expect(sdKbReviewOverdue(null, now)).toBe(false)
    expect(sdKbReviewOverdue('não é data', now)).toBe(false)
    expect(sdKbReviewOverdue('2026-10-01T00:00:00.000Z')).toBe(true)

    const list = [
      summary({ id: 'a1', reuseCount: 2 }),
      summary({ id: 'a2', reuseCount: 0 }),
      summary({ id: 'a3', reuseCount: 7 }),
    ]
    expect(sdKbTopReused(list).map((a) => a.id)).toEqual(['a3', 'a1'])
    expect(sdKbTopReused(list, 1)).toHaveLength(1)
  })
})

describe('<SdKbReviewPanel />', () => {
  it('o autor escolhe o revisor e pede revisão', async () => {
    const spy = mockFetch(panelRoutes(state({ status: 'IN_REVIEW' })))
    renderWithQuery(
      <SdKbReviewPanel workspaceId={WS} article={article({ reuseCount: 3 })} />,
    )

    await waitFor(() => screen.getByText('Revisão (KCS)'))
    expect(screen.getByText('3 chamados')).toBeTruthy()
    expect(screen.getByText('nunca revisado')).toBeTruthy()
    expect(screen.getByText('sem validade')).toBeTruthy()

    fireEvent.click(screen.getByRole('combobox', { name: 'Revisor' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Bruno' }))
    fireEvent.change(screen.getByLabelText('Recado para o revisor'), {
      target: { value: '  olha o passo 3  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Pedir revisão/ }))

    await waitFor(() =>
      expect(fetchBody(spy, '/knowledge/a1/reviews', 'POST')).toEqual({
        reviewerId: REVIEWER,
        comment: 'olha o passo 3',
      }),
    )
  })

  it('o revisor aprova ou pede mudanças (com comentário obrigatório)', async () => {
    const spy = mockFetch(
      panelRoutes(state({ status: 'IN_REVIEW', pending: pending() }), REVIEWER),
    )
    renderWithQuery(<SdKbReviewPanel workspaceId={WS} article={article()} />)

    await waitFor(() => screen.getByText('Em revisão com Bruno'))
    expect(screen.getByText('confere o passo 3')).toBeTruthy()

    const changes = screen.getByRole('button', { name: /Pedir mudanças/ })
    expect(changes.hasAttribute('disabled')).toBe(true)
    fireEvent.change(screen.getByLabelText('Comentário da revisão'), {
      target: { value: 'falta validar' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Pedir mudanças/ }))
    await waitFor(() =>
      expect(fetchBody(spy, '/knowledge/reviews/r1', 'PATCH')).toEqual({
        decision: 'REQUEST_CHANGES',
        comment: 'falta validar',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Aprovar e publicar/ }))
    await waitFor(() =>
      expect(spy.mock.calls.filter(([, init]) => init?.method === 'PATCH')),
    )
  })

  it('mostra a revisão vencida, o histórico e salva a validade', async () => {
    const spy = mockFetch(
      panelRoutes(
        state({
          status: 'PUBLISHED',
          reviewIntervalDays: 30,
          effectiveIntervalDays: 30,
          reviewDueAt: '2026-01-01T00:00:00.000Z',
          lastReviewedAt: '2025-12-02T00:00:00.000Z',
          overdue: true,
          history: [
            pending({
              status: 'APPROVED',
              decidedAt: '2025-12-02T00:00:00.000Z',
            }),
            pending({
              id: 'r2',
              status: 'CHANGES_REQUESTED',
              comment: 'ajuste',
            }),
          ],
        }),
      ),
    )
    renderWithQuery(<SdKbReviewPanel workspaceId={WS} article={article()} />)

    await waitFor(() => screen.getByText('Revisão vencida'))
    // Data formatada no fuso do registro, nunca no do navegador.
    expect(screen.getByText('31/12/2025')).toBeTruthy()
    expect(screen.getByText(/Aprovado · Bruno/)).toBeTruthy()
    expect(screen.getByText('ajuste')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Validade da revisão'), {
      target: { value: '45' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fetchBody(spy, '/knowledge/a1/review-interval', 'PATCH')).toEqual({
        reviewIntervalDays: 45,
      }),
    )
  })

  it('quem não é autor nem revisor só lê', async () => {
    mockFetch(panelRoutes(state(), 'outro'))
    renderWithQuery(<SdKbReviewPanel workspaceId={WS} article={article()} />)
    await waitFor(() =>
      screen.getByText(
        'Só o autor do artigo (ou um admin) pode pedir revisão.',
      ),
    )
  })

  it('o autor cancela a revisão pendente', async () => {
    const spy = mockFetch(
      panelRoutes(state({ status: 'IN_REVIEW', pending: pending() })),
    )
    renderWithQuery(<SdKbReviewPanel workspaceId={WS} article={article()} />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Cancelar revisão' }),
    )
    await waitFor(() =>
      expect(spy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
        true,
      ),
    )
  })
})

describe('<SdKbCuration />', () => {
  it('mostra totais, revisões minhas e os três rankings', async () => {
    mockFetch([
      {
        match: '/knowledge/reviews',
        data: [
          pending({
            article: {
              id: 'a9',
              title: 'Wi-Fi',
              icon: null,
              status: 'IN_REVIEW',
            },
          }),
        ],
      },
      {
        match: '/knowledge/stats',
        data: {
          totals: {
            published: 12,
            inReview: 2,
            overdue: 1,
            neverReused: 3,
            resolvedTickets: 42,
          },
          mostReused: [summary({ id: 'a1', title: 'VPN', reuseCount: 9 })],
          overdue: [
            summary({
              id: 'a2',
              title: 'Impressora',
              reviewDueAt: '2026-01-01T00:00:00.000Z',
            }),
          ],
          neverReused: [summary({ id: 'a3', title: 'Wi-Fi convidados' })],
        },
      },
    ])
    renderWithQuery(<SdKbCuration workspaceId={WS} workspaceSlug='acme' />)

    await waitFor(() => screen.getByText('Curadoria (KCS)'))
    expect(screen.getByText(/42 chamados resolvidos/)).toBeTruthy()
    expect(screen.getByText('Esperando sua revisão')).toBeTruthy()
    expect(screen.getByText('Wi-Fi')).toBeTruthy()
    expect(screen.getByText('9 chamados')).toBeTruthy()
    expect(screen.getAllByText('Revisão vencida').length).toBeGreaterThan(0)
    expect(screen.getByText('Wi-Fi convidados')).toBeTruthy()
  })

  it('base vazia não quebra os rankings', async () => {
    mockFetch([
      { match: '/knowledge/reviews', data: [] },
      {
        match: '/knowledge/stats',
        data: {
          totals: {
            published: 0,
            inReview: 0,
            overdue: 0,
            neverReused: 0,
            resolvedTickets: 1,
          },
          mostReused: [],
          overdue: [],
          neverReused: [],
        },
      },
    ])
    renderWithQuery(<SdKbCuration workspaceId={WS} workspaceSlug='acme' />)
    await waitFor(() => screen.getByText(/1 chamado resolvido/))
    expect(screen.getByText('Nada vencido. A base está em dia.')).toBeTruthy()
    expect(screen.queryByText('Esperando sua revisão')).toBeNull()
  })
})

describe('<SdKbDraftSuggestions />', () => {
  it('sugere artigos pelo que já foi digitado', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: '/knowledge/suggest/draft',
        data: [
          {
            ...summary({ id: 'a1', title: 'VPN corporativa', reuseCount: 2 }),
            excerpt: '…reinicie o cliente…',
            rank: 0.8,
          },
        ],
      },
    ])
    renderWithQuery(
      <SdKbDraftSuggestions
        workspaceId={WS}
        workspaceSlug='acme'
        title='VPN não conecta'
        description='erro 809'
        categoryIds={['c1']}
      />,
    )
    await waitFor(() => screen.getByText('Talvez a base já resolva'))
    expect(screen.getByText('…reinicie o cliente…')).toBeTruthy()
    expect(screen.getByText('Já resolveu 2 chamados')).toBeTruthy()
    expect(fetchBody(spy, '/knowledge/suggest/draft', 'POST')).toEqual({
      title: 'VPN não conecta',
      description: 'erro 809',
      categoryIds: ['c1'],
    })
  })

  it('não busca com título curto nem mostra bloco vazio', async () => {
    const spy = mockFetch([
      { method: 'POST', match: '/knowledge/suggest/draft', data: [] },
    ])
    const { rerender } = renderWithQuery(
      <SdKbDraftSuggestions workspaceId={WS} title='vp' />,
    )
    expect(screen.queryByText('Talvez a base já resolva')).toBeNull()
    expect(spy).not.toHaveBeenCalled()

    rerender(<SdKbDraftSuggestions workspaceId={WS} title='vpn cai' />)
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(screen.queryByText('Talvez a base já resolva')).toBeNull()
  })
})
