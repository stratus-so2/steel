import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO, SdPhaseDTO } from '@/types/sd-config'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SD_COMPOSER_INPUT_ID } from '../history/sd-message-composer'
import { SdSlaIndicator } from '../sd-ticket-badges'
import { SdTicketScreen } from '../sd-ticket-screen'
import { SdTicketSidebar } from '../sd-ticket-sidebar'
import {
  SD_TICKET_TABS,
  SdTicketTabs,
  sdSplitTicketTabs,
  sdTicketTabsFor,
} from '../ticket-tabs'
import { SD_DESKTOP_QUERY } from '../use-sd-is-desktop'
import {
  AGENTS,
  agentMe,
  stubEventSource,
  TAB_URL,
  tabProps,
  ticketDTO,
  WS,
} from './sd-ticket-tab-fixtures'

const replace = vi.fn()
let search = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => '/acme/servicedesk/tickets/1',
  useSearchParams: () => search,
}))

function phase(overrides: Partial<SdPhaseDTO>): SdPhaseDTO {
  return {
    id: 'p1',
    ticketType: 'INCIDENT',
    name: 'Em andamento',
    description: null,
    color: null,
    category: 'IN_PROGRESS',
    completionPercent: 50,
    position: 1,
    isInitial: false,
    pausesSla: false,
    requiresApproval: false,
    requiredFields: [],
    wipLimit: 0,
    active: true,
    createdAt: '2026-09-21T12:00:00.000Z',
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

const CONFIG = {
  me: agentMe,
  settings: { aiEnabled: false },
  departments: [],
  categories: [],
  classifications: [],
  impacts: [],
  urgencies: [],
  priorities: [],
  severities: [],
  priorityMatrix: [],
  phases: [
    {
      ticketType: 'INCIDENT',
      phases: [
        phase({ id: 'p0', name: 'Novo', category: 'NEW', position: 0 }),
        phase({}),
      ],
      transitions: [],
    },
  ],
  customFields: [],
  templates: [],
  cannedResponses: [],
  slaPolicies: [],
} as unknown as SdConfigBootstrapDTO

function ticket(overrides: Partial<SdTicketDTO> = {}): SdTicketDTO {
  return ticketDTO({
    description: '<p>Link cai a cada 20 minutos.</p>',
    priority: { id: 'pr1', name: 'Alta', color: '#ef4444', level: 2 },
    assignee: { id: 'u-agent', name: 'Ana Agente', email: 'a@x', image: null },
    sla: {
      firstResponse: {
        dueAt: '2026-09-21T13:00:00.000Z',
        remainingMinutes: 0,
        percentUsed: 100,
        state: 'met',
      },
      resolution: {
        dueAt: '2999-01-01T00:00:00.000Z',
        remainingMinutes: 600,
        percentUsed: 10,
        state: 'ok',
      },
    },
    ...overrides,
  } as Partial<SdTicketDTO>)
}

function routes(data: SdTicketDTO = ticket()) {
  return mockFetch([
    { match: '/servicedesk/tickets/INC-000001', data },
    { match: `${TAB_URL}/messages?`, data: { items: [], nextBefore: null } },
    {
      match: `${TAB_URL}/tasks`,
      data: {
        items: [],
        progress: { done: 1, total: 3, percent: 33 },
      },
    },
    {
      match: `${TAB_URL}/approvals`,
      data: [{ id: 'ap1', status: 'PENDING' }],
    },
    {
      match: `${TAB_URL}/costs`,
      data: {
        items: [{ id: 'c1' }],
        summary: { total: '128.20', billable: '0', nonBillable: '0' },
      },
    },
    {
      match: `${TAB_URL}/time-entries`,
      data: {
        items: [],
        summary: { totalMinutes: 90 },
        running: null,
        contract: null,
      },
    },
    { match: `${TAB_URL}/kb-links`, data: [{ id: 'k1' }] },
    {
      match: `${TAB_URL}/followers`,
      data: { following: false, items: [] },
    },
    { match: /\/servicedesk\/config($|\?)/, data: CONFIG },
    { match: /\/servicedesk\/me($|\?)/, data: agentMe },
    { match: '/servicedesk/agents', data: AGENTS },
    { method: 'PATCH', match: '/servicedesk/tickets/t1', data },
    { match: /./, data: [] },
  ])
}

function setViewport(desktop: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query === SD_DESKTOP_QUERY ? desktop : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

beforeEach(() => {
  stubEventSource()
  search = new URLSearchParams()
  replace.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('sdSplitTicketTabs', () => {
  it('keeps the primary tabs and the active one in the bar', () => {
    const tabs = sdTicketTabsFor('agent', 'INCIDENT')
    const { visible, overflow } = sdSplitTicketTabs(tabs, 'parts')
    expect(visible.map((t) => t.id)).toEqual([
      'history',
      'tasks',
      'approvals',
      'parts',
      'knowledge',
    ])
    expect(overflow.map((t) => t.id)).toContain('costs')
    expect(overflow.map((t) => t.id)).not.toContain('parts')
    expect(visible.length + overflow.length).toBe(tabs.length)
  })

  it('makes the change tab primary only on change tickets', () => {
    expect(SD_TICKET_TABS.find((t) => t.id === 'change')?.primary).toBe(true)
    const { visible } = sdSplitTicketTabs(
      sdTicketTabsFor('agent', 'INCIDENT'),
      'history',
    )
    expect(visible.map((t) => t.id)).not.toContain('change')
  })
})

describe('SdTicketTabs', () => {
  it('moves the secondary tabs into the "Mais" menu', async () => {
    routes()
    const onChange = vi.fn()
    renderWithQuery(
      <SdTicketTabs
        props={tabProps('agent')}
        active='history'
        onChange={onChange}
        counts={{ children: 2 }}
      />,
    )
    const bar = screen.getByRole('tablist', { name: 'Abas do chamado' })
    expect(
      within(bar)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['Conversa', 'Tarefas', 'Aprovação', 'Conhecimento'])
    expect(
      within(bar).getByRole('tab', { name: 'Conversa' }).ariaSelected,
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Mais abas' }))
    const item = await screen.findByRole('menuitem', { name: /Itens filhos/ })
    expect(item.textContent).toContain('2')
    fireEvent.click(screen.getByRole('menuitem', { name: /Custos/ }))
    expect(onChange).toHaveBeenCalledWith('costs')
  })
})

describe('SdSlaIndicator', () => {
  it('shows the remaining time with the clock name', () => {
    renderWithQuery(
      <SdSlaIndicator
        live={{
          state: 'ok',
          remaining: 130,
          dueAt: '2026-10-07T18:00:00.000Z',
          percentUsed: 20,
        }}
        label='Resolução'
      />,
    )
    const el = screen.getByText(/Resolução · .* restantes/)
    expect(el.getAttribute('data-sla-state')).toBe('ok')
  })

  it('drops the label and flags a breach', () => {
    renderWithQuery(
      <SdSlaIndicator
        live={{
          state: 'breached',
          remaining: -15,
          dueAt: '2026-10-07T18:00:00.000Z',
          percentUsed: 110,
        }}
        label='Resolução'
        showLabel={false}
      />,
    )
    const el = screen.getByText(/Atrasado/)
    expect(el.textContent).not.toContain('Resolução')
    expect(el.getAttribute('data-sla-state')).toBe('breached')
  })
})

describe('SdTicketSidebar', () => {
  it('collapses sections and links the work summary to the tabs', async () => {
    routes()
    const onTab = vi.fn()
    renderWithQuery(
      <SdTicketSidebar
        workspaceId={WS}
        ticket={ticket()}
        config={CONFIG}
        agents={AGENTS}
        onPhaseChange={vi.fn()}
        onTab={onTab}
      />,
    )

    // "Datas" starts closed; opening it shows the dates.
    expect(screen.queryByText('Aberto em')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Datas' }))
    expect(await screen.findByText('Aberto em')).toBeTruthy()

    // "Geral" starts open; closing it hides its rows.
    expect(screen.getByText('Canal')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Geral' }))
    await waitFor(() => expect(screen.queryByText('Canal')).toBeNull())

    const tasks = await screen.findByRole('button', {
      name: /Tarefas.*1 de 3 concluídas/,
    })
    expect(
      await screen.findByRole('button', { name: /Aprovação.*1 pendente/ }),
    ).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: /Horas.*1 h 30 min/ }),
    ).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: /Custos.*128,20/ }),
    ).toBeTruthy()
    expect(
      await screen.findByRole('button', { name: /Conhecimento.*1 artigo/ }),
    ).toBeTruthy()
    fireEvent.click(tasks)
    expect(onTab).toHaveBeenCalledWith('tasks')

    expect(screen.getByLabelText('SLA').textContent).toContain('Cumprido')
  })
})

describe('SdTicketScreen', () => {
  it('shows the details column on desktop, with no "Detalhes" button', async () => {
    setViewport(true)
    routes()
    renderWithQuery(
      <SdTicketScreen workspaceId={WS} slug='acme' ticketRef='INC-000001' />,
    )
    expect(await screen.findByText('Servidor fora do ar')).toBeTruthy()
    expect(
      screen.getByRole('complementary', { name: 'Detalhes do chamado' }),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Detalhes' })).toBeNull()
    expect(screen.getByText('Prioridade alta')).toBeTruthy()
    expect(screen.getByText(/Resolução · .* restantes/)).toBeTruthy()
  })

  it('opens the details in a sheet below lg', async () => {
    setViewport(false)
    routes()
    renderWithQuery(
      <SdTicketScreen workspaceId={WS} slug='acme' ticketRef='INC-000001' />,
    )
    await screen.findByText('Servidor fora do ar')
    expect(screen.queryByTestId('sd-ticket-details')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }))
    const sheet = await screen.findByRole('dialog', { name: 'Detalhes' })
    expect(within(sheet).getByTestId('sd-ticket-details')).toBeTruthy()

    // A shortcut in the sheet closes it and opens the tab.
    fireEvent.click(
      await within(sheet).findByRole('button', { name: /Tarefas/ }),
    )
    expect(replace).toHaveBeenCalledWith(
      '/acme/servicedesk/tickets/1?tab=tasks',
      { scroll: false },
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('keeps every secondary action in the overflow menu', async () => {
    setViewport(true)
    routes()
    renderWithQuery(
      <SdTicketScreen workspaceId={WS} slug='acme' ticketRef='INC-000001' />,
    )
    await screen.findByText('Servidor fora do ar')
    fireEvent.click(
      screen.getByRole('button', { name: 'Mais ações do chamado' }),
    )
    for (const name of [
      'Escalonar',
      'Adicionar item filho',
      'Vincular item pai',
      'Copiar link',
    ]) {
      expect(await screen.findByRole('menuitem', { name })).toBeTruthy()
    }
    // Excluir is admin-only.
    expect(
      screen.queryByRole('menuitem', { name: 'Excluir chamado' }),
    ).toBeNull()
  })

  it('assigns the ticket to me from the header', async () => {
    setViewport(true)
    const spy = routes(ticket({ assignee: null }))
    renderWithQuery(
      <SdTicketScreen workspaceId={WS} slug='acme' ticketRef='INC-000001' />,
    )
    await screen.findByText('Servidor fora do ar')
    fireEvent.click(
      screen.getByRole('button', { name: /Atribuir — responsável: ninguém/ }),
    )
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Atribuir a mim' }),
    )
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/servicedesk/tickets/t1') &&
            init?.method === 'PATCH' &&
            String(init.body).includes('"assigneeId":"u-agent"'),
        ),
      ).toBe(true),
    )
  })

  it('"Responder" switches to the conversation and focuses the composer', async () => {
    setViewport(true)
    search = new URLSearchParams('tab=tasks')
    routes()
    renderWithQuery(
      <SdTicketScreen workspaceId={WS} slug='acme' ticketRef='INC-000001' />,
    )
    await screen.findByText('Servidor fora do ar')
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    expect(replace).toHaveBeenCalledWith(
      '/acme/servicedesk/tickets/1?tab=history',
      { scroll: false },
    )
  })

  it('"Responder" focuses the composer when the conversation is open', async () => {
    setViewport(true)
    routes()
    renderWithQuery(
      <SdTicketScreen workspaceId={WS} slug='acme' ticketRef='INC-000001' />,
    )
    await screen.findByLabelText('Mensagem')
    fireEvent.click(screen.getByRole('button', { name: 'Responder' }))
    await waitFor(() =>
      expect(document.activeElement?.id).toBe(SD_COMPOSER_INPUT_ID),
    )
    expect(replace).not.toHaveBeenCalled()
  })
})
