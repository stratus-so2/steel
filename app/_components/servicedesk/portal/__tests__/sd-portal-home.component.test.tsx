import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdPortalHome } from '../sd-portal-home'
import {
  API,
  portalTicket,
  RESOLVED_PHASE,
  SLUG,
  stubPortalEventSource,
  WS,
} from './sd-portal-fixtures'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => `/${SLUG}/servicedesk/portal`,
}))

beforeEach(() => {
  stubPortalEventSource()
})

function renderHome(
  tickets: SdTicketDTO[],
  props: Partial<Parameters<typeof SdPortalHome>[0]> = {},
) {
  const spy = mockFetch([
    { match: '/servicedesk/knowledge/categories', data: [] },
    { match: '/servicedesk/knowledge', data: [] },
    {
      match: `${API}/tickets?`,
      data: {
        items: tickets,
        total: tickets.length,
        page: 1,
        pageSize: 20,
        nextCursor: null,
      },
    },
  ])
  renderWithQuery(
    <SdPortalHome
      workspaceId={WS}
      slug={SLUG}
      userName='Rui Solicitante da Silva'
      aiPreServiceEnabled={false}
      {...props}
    />,
  )
  return spy
}

describe('<SdPortalHome />', () => {
  it('greets by first name and offers the big CTA', async () => {
    renderHome([])

    expect(
      await screen.findByRole('heading', { name: 'Olá, Rui!' }),
    ).toBeTruthy()
    const cta = screen.getByRole('link', { name: /Abrir chamado/ })
    expect(cta.getAttribute('href')).toBe(`/${SLUG}/servicedesk/portal/new`)
  })

  it('shows the empty state when the requester has no tickets', async () => {
    renderHome([])
    expect(
      await screen.findByText('Você ainda não abriu nenhum chamado'),
    ).toBeTruthy()
  })

  it('lists open tickets with the phase progress and links to the portal view', async () => {
    renderHome([portalTicket({ id: 't1', number: 12, code: 'INC-000012' })])

    const link = await screen.findByRole('link', {
      name: 'Servidor fora do ar',
    })
    expect(link.getAttribute('href')).toBe(
      `/${SLUG}/servicedesk/portal/tickets/12`,
    )
    expect(screen.getByText('INC-000012')).toBeTruthy()
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '50',
    )
  })

  it('separates finished tickets and celebrates an empty queue', async () => {
    renderHome([
      portalTicket({
        id: 't2',
        number: 9,
        code: 'REQ-000009',
        title: 'Troca de mouse',
        phase: RESOLVED_PHASE,
        completionPercent: 100,
      }),
    ])

    expect(await screen.findByText('Chamados encerrados (1)')).toBeTruthy()
    expect(
      screen.getByText('Nenhum chamado em aberto. Tudo resolvido!'),
    ).toBeTruthy()
  })

  it('surfaces the list error', async () => {
    mockFetch([
      { match: '/servicedesk/knowledge/categories', data: [] },
      { match: '/servicedesk/knowledge', data: [] },
      { match: `${API}/tickets?`, status: 500, error: 'Erro ao buscar' },
    ])
    renderWithQuery(
      <SdPortalHome
        workspaceId={WS}
        slug={SLUG}
        userName=''
        aiPreServiceEnabled
      />,
    )

    expect(await screen.findByRole('heading', { name: 'Olá!' })).toBeTruthy()
    expect(await screen.findByText('Erro ao buscar')).toBeTruthy()
  })
})
