import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { sdCompareSortable, sdLocalTable } from '../../table/sd-local-table'
import { ticketDTO } from '../../ticket/__tests__/sd-ticket-tab-fixtures'
import { SdRiskQueue } from '../sd-risk-overview'

/**
 * The risk queue had no test at all — the module's most unprotected bespoke
 * layout. Now that it is the standard table, these cases pin down what the
 * screen gained: columns, search, sorting and the band filter.
 */

const WS = 'ws-1'
const SLUG = 'acme'
const URL = '/servicedesk/risk/tickets'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => `/${SLUG}/servicedesk/risk`,
  useSearchParams: () => new URLSearchParams(),
}))

function riskTicket(overrides: Partial<SdTicketDTO> = {}): SdTicketDTO {
  return ticketDTO({
    risk: {
      level: 'HIGH',
      score: 74,
      factors: [
        {
          key: 'sla_consumed',
          label: 'Prazo já consumido',
          weight: 30,
          detail: '82% do prazo consumido',
        },
      ],
      breachEtaAt: null,
      computedAt: '2026-10-02T12:00:00.000Z',
    },
    ...overrides,
  })
}

describe('sdCompareSortable()', () => {
  it('orders numbers, then text in pt-BR', () => {
    expect(sdCompareSortable(1, 2)).toBeLessThan(0)
    expect(sdCompareSortable('b', 'a')).toBeGreaterThan(0)
    expect(sdCompareSortable('a', 'a')).toBe(0)
  })

  it('always pushes the empty value last, in both directions', () => {
    expect(sdCompareSortable(null, 5)).toBeGreaterThan(0)
    expect(sdCompareSortable(5, undefined)).toBeLessThan(0)
    expect(sdCompareSortable(null, undefined)).toBeGreaterThan(0)
  })
})

describe('sdLocalTable()', () => {
  const rows = [
    { id: 'a', name: 'Zebra', score: 1 },
    { id: 'b', name: 'Alpha', score: 9 },
    { id: 'c', name: 'Meio', score: 5 },
  ]
  const base = {
    searchText: (row: (typeof rows)[number]) => row.name,
    sortValue: (row: (typeof rows)[number]) => row.score,
    sort: 'score',
    order: 'desc' as const,
    page: 1,
    pageSize: 2,
  }

  it('searches, sorts and slices the page', () => {
    const result = sdLocalTable(rows, base)
    expect(result.total).toBe(3)
    expect(result.rows.map((r) => r.id)).toEqual(['b', 'c'])
    expect(
      sdLocalTable(rows, { ...base, page: 2 }).rows.map((r) => r.id),
    ).toEqual(['a'])
  })

  it('filters by the search before paginating', () => {
    const result = sdLocalTable(rows, { ...base, q: 'al' })
    expect(result.total).toBe(1)
    expect(result.rows.map((r) => r.id)).toEqual(['b'])
  })

  it('clamps a page the shortened list no longer has', () => {
    // Filtering while on page 2 must not leave the table empty.
    const result = sdLocalTable(rows, { ...base, q: 'al', page: 2 })
    expect(result.page).toBe(1)
    expect(result.rows).toHaveLength(1)
  })

  it('keeps the ascending order a reversed sort asks for', () => {
    expect(
      sdLocalTable(rows, { ...base, order: 'asc' }).rows.map((r) => r.id),
    ).toEqual(['a', 'c'])
  })
})

describe('<SdRiskQueue />', () => {
  it('lists the tickets with the risk badge in the standard table', async () => {
    mockFetch([{ match: URL, data: [riskTicket()] }])
    renderWithQuery(<SdRiskQueue workspaceId={WS} slug={SLUG} />)

    expect(await screen.findByText('Risco alto · 74')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Risco/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Código/ })).toBeTruthy()
    // The standard table toolbar, not the three pills it used to have.
    expect(screen.getByLabelText('Buscar')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Colunas/ })).toBeTruthy()
  })

  it('asks the API for the risk band chosen in the filter popover', async () => {
    const fetchSpy = mockFetch([{ match: URL, data: [] }])
    renderWithQuery(<SdRiskQueue workspaceId={WS} slug={SLUG} />)

    await waitFor(() =>
      expect(String(fetchSpy.mock.calls[0]?.[0])).toContain('level=HIGH'),
    )
    expect(await screen.findByText('Nenhum chamado em risco alto')).toBeTruthy()
    expect(screen.getByText(/recalculada a cada 10 minutos/)).toBeTruthy()
  })

  it('searches by code, title or assignee over the loaded prediction', async () => {
    mockFetch([
      {
        match: URL,
        data: [
          riskTicket(),
          riskTicket({ id: 't2', number: 2, code: 'INC-000002', title: 'VPN' }),
        ],
      },
    ])
    renderWithQuery(<SdRiskQueue workspaceId={WS} slug={SLUG} />)

    await screen.findByText('VPN')
    fireEvent.change(screen.getByLabelText('Buscar'), {
      target: { value: 'INC-000002' },
    })

    // The search is debounced: what leaves the table is what proves it.
    await waitFor(() => expect(screen.queryByText('INC-000001')).toBeNull())
    expect(screen.getByText('INC-000002')).toBeTruthy()
    expect(screen.getByText('VPN')).toBeTruthy()
  })

  it('links the board with the band currently on screen', async () => {
    mockFetch([{ match: URL, data: [] }])
    renderWithQuery(<SdRiskQueue workspaceId={WS} slug={SLUG} />)

    await waitFor(() =>
      expect(
        screen
          .getByRole('link', { name: /Ver no quadro/ })
          .getAttribute('href'),
      ).toBe(`/${SLUG}/servicedesk/tickets?riskLevel=HIGH&mode=list`),
    )
  })
})
