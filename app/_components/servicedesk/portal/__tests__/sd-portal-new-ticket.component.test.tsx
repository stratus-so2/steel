import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SdPortalNewTicket } from '../sd-portal-new-ticket'
import {
  sdPortalCategoryOptions,
  sdPortalChildOptions,
  sdPortalDefaultUrgency,
  sdPortalTemplates,
  sdPortalTypes,
  sdPortalUrgencyOptions,
} from '../sd-portal-options'
import {
  PORTAL_CONFIG,
  portalTicket,
  SLUG,
  stubPortalEventSource,
  WS,
} from './sd-portal-fixtures'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => `/${SLUG}/servicedesk/portal/new`,
}))

const CATEGORIES = PORTAL_CONFIG.categories as never
const TEMPLATES = PORTAL_CONFIG.templates as never
const URGENCIES = PORTAL_CONFIG.urgencies as never

beforeEach(() => {
  stubPortalEventSource()
})

function renderForm(
  routes: Parameters<typeof mockFetch>[0] = [],
  types: SdTicketTypeDTO[] = ['INCIDENT', 'SERVICE_REQUEST'],
) {
  const spy = mockFetch([
    ...routes,
    { match: '/servicedesk/config', data: PORTAL_CONFIG },
    { match: '/servicedesk/agents', data: [] },
    { match: '/servicedesk/knowledge/search', data: [] },
  ])
  renderWithQuery(
    <SdPortalNewTicket
      workspaceId={WS}
      slug={SLUG}
      portalTicketTypes={types}
    />,
  )
  return spy
}

describe('portal options', () => {
  it('keeps the canonical order of the allowed types', () => {
    expect(sdPortalTypes(['PROBLEM', 'INCIDENT'])).toEqual([
      'INCIDENT',
      'PROBLEM',
    ])
    expect(sdPortalTypes([])).toEqual([])
  })

  it('hides catalog nodes that are not visible in the portal', () => {
    expect(sdPortalCategoryOptions(CATEGORIES, 'INCIDENT')).toEqual([
      { value: 'cat-1', label: 'Acesso e senhas' },
    ])
    expect(sdPortalChildOptions(CATEGORIES, 'cat-1', 'INCIDENT')).toEqual([
      { value: 'sub-1', label: 'E-mail' },
    ])
    expect(sdPortalChildOptions(CATEGORIES, 'ghost', 'INCIDENT')).toEqual([])
  })

  it('offers only portal templates of the chosen type', () => {
    expect(
      sdPortalTemplates(TEMPLATES, 'SERVICE_REQUEST').map((t) => t.id),
    ).toEqual(['tpl-1'])
    expect(sdPortalTemplates(TEMPLATES, 'INCIDENT')).toEqual([])
  })

  it('sorts urgencies by level and finds the default one', () => {
    expect(sdPortalUrgencyOptions(URGENCIES).map((u) => u.value)).toEqual([
      'urg-low',
      'urg-high',
    ])
    expect(sdPortalDefaultUrgency(URGENCIES)).toBe('urg-low')
    expect(sdPortalDefaultUrgency([])).toBeNull()
  })
})

describe('<SdPortalNewTicket />', () => {
  it('offers only the ticket types released for the portal', async () => {
    renderForm([], ['SERVICE_REQUEST'])

    expect(
      await screen.findByRole('button', { name: /Requisição/ }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Incidente/ })).toBeNull()
  })

  it('explains that no type is released when the list is empty', async () => {
    renderForm([], [])
    expect(
      await screen.findByText('Nenhum tipo de chamado liberado no portal'),
    ).toBeTruthy()
  })

  it('shows only portal-visible custom fields', async () => {
    renderForm()
    expect(await screen.findByLabelText(/Número do patrimônio/)).toBeTruthy()
    expect(screen.queryByLabelText(/Centro de custo/)).toBeNull()
  })

  it('requires a summary before sending', async () => {
    const spy = renderForm()
    // O botão só habilita depois do bootstrap de configuração chegar.
    await screen.findByLabelText(/Número do patrimônio/)
    fireEvent.click(screen.getByRole('button', { name: /Enviar chamado/ }))

    expect(
      await screen.findByText('Conte em poucas palavras o que você precisa'),
    ).toBeTruthy()
    expect(
      spy.mock.calls.some(
        ([url, init]) =>
          init?.method === 'POST' && String(url).endsWith('/tickets'),
      ),
    ).toBe(false)
  })

  it('suggests knowledge base articles while the summary is typed', async () => {
    renderForm([
      {
        match: '/servicedesk/knowledge/search',
        data: [
          {
            id: 'a1',
            title: 'Como redefinir sua senha',
            excerpt: 'Acesse…',
            rank: 1,
          },
        ],
      },
    ])

    fireEvent.change(await screen.findByLabelText(/Resumo/), {
      target: { value: 'senha' },
    })

    expect(await screen.findByText('Talvez isto já resolva')).toBeTruthy()
    const article = screen.getByRole('link', {
      name: 'Como redefinir sua senha',
    })
    expect(article.getAttribute('href')).toBe(
      `/${SLUG}/servicedesk/knowledge/a1`,
    )
  })

  it('opens the ticket and navigates to the portal view', async () => {
    const spy = renderForm([
      {
        method: 'POST',
        match: '/servicedesk/tickets',
        status: 201,
        data: portalTicket({ id: 'new', number: 42, code: 'INC-000042' }),
      },
    ])

    fireEvent.change(await screen.findByLabelText(/Resumo/), {
      target: { value: 'Não consigo entrar no e-mail' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Enviar chamado/ }))

    await waitFor(() => {
      const body = fetchBody(spy, '/servicedesk/tickets', 'POST')
      expect(body).toMatchObject({
        type: 'INCIDENT',
        title: 'Não consigo entrar no e-mail',
        urgencyId: 'urg-low',
      })
    })
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/${SLUG}/servicedesk/portal/tickets/42`,
      ),
    )
  })
})
