import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import { SdPortalHome } from '../sd-portal-home'
import { sdPortalColumns } from '../sd-portal-views'
import {
  API,
  portalTicket,
  SLUG,
  stubPortalEventSource,
  WS,
} from './sd-portal-fixtures'

/**
 * The portal gained the same three views the agent boards have — kanban, list
 * and table. The list stays the default: a requester with three tickets is
 * better served by it than by a grid.
 */

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => `/${SLUG}/servicedesk/portal`,
  useSearchParams: () => new URLSearchParams(),
  refresh: vi.fn(),
}))

function renderHome(tickets = [portalTicket()]) {
  stubPortalEventSource()
  const fetchSpy = mockFetch([
    { match: '/servicedesk/knowledge/categories', data: [] },
    { match: '/servicedesk/knowledge', data: [] },
    {
      match: `${API}/tickets?`,
      data: { items: tickets, total: tickets.length, page: 1, pageSize: 100 },
    },
  ])
  return {
    fetchSpy,
    ...renderWithQuery(
      <SdPortalHome
        workspaceId={WS}
        slug={SLUG}
        userName='Rui Solicitante'
        aiPreServiceEnabled={false}
      />,
    ),
  }
}

describe('sdPortalColumns()', () => {
  it('builds one column per ITIL category without needing the config', () => {
    // This is what makes a portal kanban possible: `phase.category` travels on
    // the ticket DTO, so the columns exist even on a workspace whose flows
    // were never configured.
    const columns = sdPortalColumns([
      portalTicket({ id: 'a' }),
      portalTicket({
        id: 'b',
        phase: {
          ...portalTicket().phase,
          category: 'RESOLVED',
        },
      }),
    ])

    expect(columns.map((c) => c.label)).toEqual([
      'Novo',
      'Em andamento',
      'Aguardando',
      'Resolvido',
      'Fechado',
    ])
    expect(columns.find((c) => c.category === 'RESOLVED')?.items).toHaveLength(
      1,
    )
  })

  it('folds a canceled ticket into the closed column', () => {
    const columns = sdPortalColumns([
      portalTicket({
        phase: { ...portalTicket().phase, category: 'CANCELED' },
      }),
    ])

    expect(columns.find((c) => c.category === 'CLOSED')?.items).toHaveLength(1)
    expect(columns.some((c) => c.category === 'CANCELED')).toBe(false)
  })
})

describe('<SdPortalHome /> views', () => {
  it('offers the three views and starts on the list', async () => {
    renderHome()

    await screen.findByText('Servidor fora do ar')
    for (const label of ['Lista', 'Kanban', 'Tabela']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(
      screen
        .getByRole('button', { name: 'Lista' })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('switches to the kanban, with a column per category', async () => {
    renderHome()
    await screen.findByText('Servidor fora do ar')

    fireEvent.click(screen.getByRole('button', { name: 'Kanban' }))

    expect(screen.getByRole('region', { name: 'Novo' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Resolvido' })).toBeTruthy()
    // Empty columns say so instead of looking broken.
    expect(screen.getAllByText('Nenhum chamado').length).toBeGreaterThan(0)
  })

  it('switches to the table, with requester-safe columns only', async () => {
    renderHome()
    await screen.findByText('Servidor fora do ar')

    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))

    expect(screen.getByRole('columnheader', { name: /Número/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Andamento/ })).toBeTruthy()
    // No SLA, no assignee, no department on a requester screen.
    expect(screen.queryByRole('columnheader', { name: /SLA/ })).toBeNull()
    expect(
      screen.queryByRole('columnheader', { name: /Responsável/ }),
    ).toBeNull()
  })

  it('opens the portal view of a ticket from a table row', async () => {
    renderHome()
    await screen.findByText('Servidor fora do ar')
    fireEvent.click(screen.getByRole('button', { name: 'Tabela' }))

    fireEvent.click(screen.getByText('INC-000001'))

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/${SLUG}/servicedesk/portal/tickets/1`,
      ),
    )
  })

  it('asks for every ticket of the requester, not just the first twenty', async () => {
    const { fetchSpy } = renderHome()

    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) =>
        String(c[0]).includes('/tickets?'),
      )
      expect(String(call?.[0])).toContain('pageSize=100')
    })
  })
})
