import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type {
  IndicatorSetDTO,
  ProductivityDTO,
  WorklogListDTO,
} from '@/types/worklog'
import {
  formatBytes,
  formatDecimal,
  formatMinutes,
  formatMoney,
  formatPercent,
} from '../worklog-format'
import { WorklogsPanel } from '../worklogs-panel'

vi.setConfig({ testTimeout: 20_000 })

const WS = 'ws_1'
const ANA = { id: 'u_ana', name: 'Ana', email: 'ana@x.com', image: null }
const BRUNO = {
  id: 'u_bruno',
  name: 'Bruno',
  email: 'bruno@x.com',
  image: null,
}

function list(overrides: Partial<WorklogListDTO> = {}): WorklogListDTO {
  return {
    period: {
      from: '2026-09-09',
      to: '2026-10-08',
      timezone: 'America/Sao_Paulo',
    },
    items: [
      {
        id: 'e1',
        user: ANA,
        ticket: { id: 't1', code: 'INC-000042', title: 'Sem internet' },
        startedAt: '2026-10-06T12:00:00.000Z',
        endedAt: '2026-10-06T13:30:00.000Z',
        minutes: 90,
        billable: true,
        source: 'TIMER',
        amount: '150.00',
        description: 'Troca do roteador',
      },
      {
        id: 'e2',
        user: BRUNO,
        ticket: { id: 't2', code: 'REQ-000007', title: 'Novo acesso' },
        startedAt: '2026-10-07T12:00:00.000Z',
        endedAt: '2026-10-07T12:30:00.000Z',
        minutes: 30,
        billable: false,
        source: 'MANUAL',
        amount: null,
        description: null,
      },
    ],
    totals: {
      entries: 2,
      minutes: 120,
      billableMinutes: 90,
      nonBillableMinutes: 30,
      timerMinutes: 90,
      manualMinutes: 30,
      amount: '150.00',
    },
    page: 1,
    pageSize: 50,
    total: 2,
    canViewTeam: true,
    people: [ANA, BRUNO],
    serviceDeskEnabled: true,
    ...overrides,
  }
}

function set(overrides: Partial<IndicatorSetDTO> = {}): IndicatorSetDTO {
  return {
    serviceDesk: {
      loggedMinutes: 600,
      businessMinutes: 4800,
      utilization: 0.125,
      billableShare: 0.75,
      billedAmount: '1500.00',
      ticketsResolved: 8,
      minutesPerResolvedTicket: 75,
      avgFirstResponseMinutes: 30,
      avgResolutionMinutes: 600,
      slaCompliance: 0.875,
      reopenRate: 0.125,
      timerShare: 0.6,
      daysWithoutEntries: 1.5,
      businessDays: 10,
    },
    crm: { tasksCompleted: 5, opportunitiesWon: 2, wonAmount: '9000.00' },
    communication: { conversationsHandled: 14 },
    ...overrides,
  }
}

function productivity(
  overrides: Partial<ProductivityDTO> = {},
): ProductivityDTO {
  return {
    period: {
      from: '2026-09-09',
      to: '2026-10-08',
      timezone: 'America/Sao_Paulo',
      previousFrom: '2026-08-10',
      previousTo: '2026-09-08',
    },
    calendar: { source: 'workspace', name: 'Comercial' },
    modules: { serviceDesk: true, crm: true, communication: true },
    canViewTeam: true,
    members: [ANA, BRUNO],
    team: { current: set(), previous: set(), people: 2 },
    people: [
      { user: ANA, current: set(), previous: set() },
      { user: BRUNO, current: set({ serviceDesk: null }), previous: set() },
    ],
    trend: [
      {
        weekStart: '2026-09-28',
        loggedMinutes: 300,
        ticketsResolved: 4,
        tasksCompleted: 2,
        opportunitiesWon: 1,
        conversationsHandled: 7,
      },
    ],
    ...overrides,
  }
}

async function pick(label: string, option: string) {
  const select = screen.getByRole('combobox', { name: label })
  fireEvent.click(select)
  const item = await screen.findByRole('option', { name: option })
  fireEvent.pointerDown(item, { pointerType: 'mouse' })
  fireEvent.click(item)
  await waitFor(() => expect(select.textContent).toContain(option))
}

const listUrls = (spy: ReturnType<typeof mockFetch>) =>
  spy.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/worklogs?') || url.endsWith('/worklogs'))

describe('WorklogsPanel — entries', () => {
  it('shows entries, totals and the CSV link for an admin', async () => {
    mockFetch([{ match: `/api/workspaces/${WS}/worklogs`, data: list() }])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)

    expect(await screen.findByText('INC-000042')).toBeTruthy()
    expect(screen.getByText('Sem internet')).toBeTruthy()
    expect(
      screen.getByText(/Ana · 06\/10\/2026 09:00 · Troca do roteador/),
    ).toBeTruthy()
    expect(screen.getByText('1 h 30 min')).toBeTruthy()
    expect(screen.getByText('Não faturável')).toBeTruthy()
    expect(screen.getByText('2 h')).toBeTruthy()
    expect(screen.getByText('75% do total')).toBeTruthy()
    expect(screen.getByText(/09\/09\/2026 a 08\/10\/2026/)).toBeTruthy()
    expect(screen.getByText('1–2 de 2')).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Pessoa' })).toBeTruthy()
    const csv = screen.getByText('Baixar CSV').closest('a')
    expect(csv?.getAttribute('href')).toBe(
      `/api/workspaces/${WS}/worklogs/export?period=last_30_days`,
    )
  })

  it('refetches with the filters and pages', async () => {
    const spy = mockFetch([
      {
        match: `/api/workspaces/${WS}/worklogs`,
        handler: (url) =>
          url.includes('page=2')
            ? list({ page: 2, total: 52, pageSize: 50 })
            : list({ total: 52 }),
      },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')

    await pick('Faturável', 'Só faturáveis')
    await waitFor(() => expect(listUrls(spy).at(-1)).toContain('billable=true'))
    await pick('Origem', 'Manual')
    await waitFor(() => expect(listUrls(spy).at(-1)).toContain('source=MANUAL'))
    await pick('Pessoa', 'Bruno')
    await waitFor(() =>
      expect(listUrls(spy).at(-1)).toContain('userId=u_bruno'),
    )
    await pick('Pessoa', 'Todas as pessoas')
    await waitFor(() => expect(listUrls(spy).at(-1)).not.toContain('userId'))

    const ticket = screen.getByLabelText('Chamado')
    fireEvent.change(ticket, { target: { value: ' INC-42 ' } })
    fireEvent.submit(ticket.closest('form') as HTMLFormElement)
    await waitFor(() => expect(listUrls(spy).at(-1)).toContain('ticket=INC-42'))
    fireEvent.change(ticket, { target: { value: '' } })
    fireEvent.blur(ticket)
    await waitFor(() => expect(listUrls(spy).at(-1)).not.toContain('ticket='))

    fireEvent.click(screen.getByRole('button', { name: 'Próxima' }))
    await waitFor(() => expect(listUrls(spy).at(-1)).toContain('page=2'))
    expect(await screen.findByText('51–52 de 52')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    await waitFor(() => expect(listUrls(spy).at(-1)).toContain('page=1'))

    await pick('Faturável', 'Faturável ou não')
    await waitFor(() => expect(listUrls(spy).at(-1)).not.toContain('billable'))
  })

  it('waits for both days of a custom period', async () => {
    const spy = mockFetch([
      { match: `/api/workspaces/${WS}/worklogs`, data: list() },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')
    await pick('Período', 'Personalizado')
    const before = listUrls(spy).length
    fireEvent.change(screen.getByLabelText('De'), {
      target: { value: '2026-10-01' },
    })
    expect(listUrls(spy)).toHaveLength(before)
    fireEvent.change(screen.getByLabelText('Até'), {
      target: { value: '2026-10-05' },
    })
    await waitFor(() =>
      expect(listUrls(spy).at(-1)).toContain('from=2026-10-01&to=2026-10-05'),
    )
  })

  it('hides the people filter from a member and explains empty results', async () => {
    mockFetch([
      {
        match: `/api/workspaces/${WS}/worklogs`,
        data: list({ items: [], total: 0, canViewTeam: false, people: null }),
      },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    expect(
      await screen.findByText('Nenhum apontamento com esses filtros.'),
    ).toBeTruthy()
    expect(screen.queryByRole('combobox', { name: 'Pessoa' })).toBeNull()
  })

  it('explains when the ServiceDesk is off, and shows errors', async () => {
    mockFetch([
      {
        match: `/api/workspaces/${WS}/worklogs`,
        data: list({ serviceDeskEnabled: false, items: [] }),
      },
    ])
    const { unmount } = renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    expect(
      await screen.findByText(/O ServiceDesk não está habilitado/),
    ).toBeTruthy()
    unmount()

    mockFetch([
      {
        match: `/api/workspaces/${WS}/worklogs`,
        status: 500,
        error: 'Falha no banco',
      },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    expect(screen.getByTestId('worklog-loading')).toBeTruthy()
    expect(await screen.findByText('Falha no banco')).toBeTruthy()
  })
})

async function openProductivity() {
  fireEvent.click(screen.getByRole('tab', { name: 'Produtividade' }))
}

describe('WorklogsPanel — productivity', () => {
  it('shows separate team indicators, the trend and people alphabetically', async () => {
    const spy = mockFetch([
      {
        match: '/worklogs/productivity',
        handler: (url) =>
          url.includes('userId=u_bruno')
            ? productivity({
                team: null,
                people: [{ user: BRUNO, current: set(), previous: set() }],
              })
            : productivity(),
      },
      { match: `/api/workspaces/${WS}/worklogs`, data: list() },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')
    await openProductivity()

    expect(
      await screen.findByText('Equipe (2 pessoas)', { exact: false }),
    ).toBeTruthy()
    for (const title of [
      'Esforço',
      'Faturamento',
      'Volume',
      'Eficiência',
      'Qualidade',
      'Confiabilidade dos dados',
    ]) {
      expect(screen.getByRole('heading', { name: title })).toBeTruthy()
    }
    expect(screen.getAllByText('10 h').length).toBeGreaterThan(0)
    expect(screen.getAllByText('87,5%').length).toBeGreaterThan(0)
    expect(screen.getAllByText('2 · R$ 9.000,00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('1,5 de 10').length).toBeGreaterThan(0)
    expect(screen.getByText(/sem nota geral e sem ranking/)).toBeTruthy()
    expect(
      screen.getByText(/Dono e administradores veem a equipe/),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Semana a semana' }),
    ).toBeTruthy()
    expect(screen.getByText('28/09')).toBeTruthy()

    const rows = screen.getAllByRole('row')
    const names = rows
      .map((row) => row.querySelector('button')?.textContent)
      .filter(Boolean)
    expect(names).toEqual(['Ana', 'Bruno'])
    const csv = screen.getAllByText('Baixar CSV')[0].closest('a')
    expect(csv?.getAttribute('href')).toBe(
      `/api/workspaces/${WS}/worklogs/productivity/export?period=last_30_days`,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Bruno' }))
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([input]) =>
          String(input).includes(
            'productivity?period=last_30_days&userId=u_bruno',
          ),
        ),
      ).toBe(true),
    )
    expect(await screen.findByText(/^Bruno ·/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Por pessoa' })).toBeNull()
  })

  it('shows a member only their own numbers and only enabled modules', async () => {
    mockFetch([
      {
        match: '/worklogs/productivity',
        data: productivity({
          canViewTeam: false,
          members: null,
          team: null,
          modules: { serviceDesk: false, crm: true, communication: false },
          people: [
            {
              user: ANA,
              current: set({ serviceDesk: null, communication: null }),
              previous: set({
                serviceDesk: null,
                communication: null,
                crm: null,
              }),
            },
          ],
          trend: [
            {
              weekStart: '2026-09-28',
              loggedMinutes: null,
              ticketsResolved: null,
              tasksCompleted: 1,
              opportunitiesWon: 0,
              conversationsHandled: null,
            },
          ],
        }),
      },
      { match: `/api/workspaces/${WS}/worklogs`, data: list() },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')
    await openProductivity()

    expect(await screen.findByRole('heading', { name: 'Volume' })).toBeTruthy()
    expect(screen.getByText(/Você vê só os seus números/)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Esforço' })).toBeNull()
    expect(screen.queryByText('Conversas atendidas')).toBeNull()
    expect(screen.getAllByText('Período anterior: —').length).toBeGreaterThan(0)
    expect(screen.queryByRole('combobox', { name: 'Pessoa' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Por pessoa' })).toBeNull()
  })

  it('handles no modules, no people and errors', async () => {
    mockFetch([
      {
        match: '/worklogs/productivity',
        data: productivity({
          modules: { serviceDesk: false, crm: false, communication: false },
          team: null,
          people: [],
          trend: [],
        }),
      },
      { match: `/api/workspaces/${WS}/worklogs`, data: list() },
    ])
    const { unmount } = renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')
    await openProductivity()
    expect(await screen.findByText(/comparado com/)).toBeTruthy()
    expect(
      screen.queryByRole('heading', { name: 'Semana a semana' }),
    ).toBeNull()
    unmount()

    mockFetch([
      {
        match: '/worklogs/productivity',
        data: productivity({
          team: {
            current: set({ serviceDesk: null, crm: null, communication: null }),
            previous: set(),
            people: 0,
          },
        }),
      },
      { match: `/api/workspaces/${WS}/worklogs`, data: list() },
    ])
    const second = renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')
    await openProductivity()
    expect(
      await screen.findByText(/Nenhum módulo com indicadores/),
    ).toBeTruthy()
    second.unmount()

    mockFetch([
      { match: '/worklogs/productivity', status: 500, error: 'Indisponível' },
      { match: `/api/workspaces/${WS}/worklogs`, data: list() },
    ])
    renderWithQuery(<WorklogsPanel workspaceId={WS} />)
    await screen.findByText('INC-000042')
    await openProductivity()
    expect(screen.getByTestId('productivity-loading')).toBeTruthy()
    expect(await screen.findByText('Indisponível')).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Apontamentos' }))
    expect(await screen.findByText('INC-000042')).toBeTruthy()
  })
})

describe('worklog formatting', () => {
  it('formats durations, money, sizes and ratios', () => {
    expect(formatMinutes(null)).toBe('—')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(125)).toBe('2 h 5 min')
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney('1234.5')).toMatch(/R\$\s1\.234,50/)
    expect(formatPercent(null)).toBe('—')
    expect(formatDecimal(null)).toBe('—')
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 ** 3)).toBe('5 GB')
    expect(formatBytes(5 * 1024 ** 4)).toBe('5.120 GB')
  })
})
