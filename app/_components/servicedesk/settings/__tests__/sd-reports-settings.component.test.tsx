import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdReportRunDTO, SdScheduledReportDTO } from '@/types/sd-report'

vi.mock('next/navigation', () => ({
  useParams: () => ({ 'workspace-slug': 'acme' }),
}))

import { SdReportsTab } from '../reports-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const SD_URL = `/api/workspaces/${WS}/servicedesk`
const REPORTS = `${SD_URL}/reports`
const RUNS = `${REPORTS}/runs`

const config = {
  departments: [{ id: 'dep-1', name: 'Infra', children: [] }],
} as unknown as SdConfigBootstrapDTO

function report(
  overrides: Partial<SdScheduledReportDTO> = {},
): SdScheduledReportDTO {
  return {
    id: 'rep-1',
    workspaceId: WS,
    name: 'SLA mensal',
    kind: 'SLA',
    customerIds: ['cus-1'],
    customers: [{ id: 'cus-1', name: 'ACME' }],
    departmentIds: [],
    departments: [],
    ticketTypes: [],
    period: 'LAST_MONTH',
    formats: ['PDF', 'CSV'],
    dayOfMonth: 1,
    atTime: '07:00',
    timezone: 'America/Sao_Paulo',
    recipients: ['gestor@example.com'],
    includeAccountOwners: false,
    active: true,
    lastRunAt: null,
    nextRunAt: '2026-11-01T10:00:00.000Z',
    runCount: 1,
    createdById: 'u-1',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

function run(overrides: Partial<SdReportRunDTO> = {}): SdReportRunDTO {
  return {
    id: 'run-1',
    workspaceId: WS,
    reportId: 'rep-1',
    reportName: 'SLA mensal',
    kind: 'SLA',
    status: 'SENT',
    periodStart: '2026-09-01T03:00:00.000Z',
    periodEnd: '2026-10-01T03:00:00.000Z',
    summary: {
      periodStart: '2026-09-01T03:00:00.000Z',
      periodEnd: '2026-10-01T03:00:00.000Z',
      volume: { opened: 12, resolved: 10, closed: 8, openAtEnd: 4 },
      firstResponse: {
        measured: 10,
        met: 9,
        breached: 1,
        compliance: 90,
        averageMinutes: 25,
      },
      resolution: {
        measured: 10,
        met: 9,
        breached: 1,
        compliance: 90,
        averageMinutes: 312,
      },
      violations: [],
      violationCount: 1,
      csat: { answered: 3, average: 4.7, distribution: [] },
      byDepartment: [],
      byCustomer: [],
      byPriority: [],
    },
    formats: ['PDF', 'CSV'],
    recipients: ['gestor@example.com'],
    sentAt: '2026-10-01T10:05:00.000Z',
    error: null,
    requestedById: null,
    requestedBy: null,
    createdAt: '2026-10-01T10:05:00.000Z',
    ...overrides,
  }
}

function renderTab(canEdit = true) {
  return renderWithQuery(
    <SdSettingsProvider value={{ workspaceId: WS, canEdit, config }}>
      <SdReportsTab />
    </SdSettingsProvider>,
  )
}

describe('SD_SETTINGS_TABS', () => {
  it('registers the reports tab', () => {
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'reports')

    expect(tab?.label).toBe('Relatórios')
    expect(tab?.component).toBe(SdReportsTab)
  })
})

describe('<SdReportsTab />', () => {
  it('invites the admin to schedule the first report', async () => {
    mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [] },
    ])
    renderTab()

    expect(await screen.findByText(/Nenhum relatório agendado/)).toBeTruthy()
    expect(
      await screen.findByText(/Nenhum relatório gerado ainda/),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /Novo relatório/ })).toBeTruthy()
  })

  it('surfaces the errors of both queries', async () => {
    mockFetch([
      { match: RUNS, status: 403, error: 'Sem histórico' },
      { match: REPORTS, status: 403, error: 'Só agentes' },
    ])
    renderTab()

    expect(await screen.findByText('Só agentes')).toBeTruthy()
    expect(await screen.findByText('Sem histórico')).toBeTruthy()
  })

  it('shows the schedule, the scope and the next send in the report timezone', async () => {
    mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [report()] },
    ])
    renderTab(false)

    expect(await screen.findByText('SLA mensal')).toBeTruthy()
    expect(screen.getByText('ACME')).toBeTruthy()
    expect(screen.getByText('Dia 1 às 07:00 (America/Sao_Paulo)')).toBeTruthy()
    // 10:00Z = 07:00 em São Paulo: o fuso do relatório, não o do navegador.
    expect(screen.getByText('01/11/2026 07:00')).toBeTruthy()
    // Modo leitura esconde as escritas.
    expect(screen.queryByRole('button', { name: /Novo relatório/ })).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Editar SLA mensal/ }),
    ).toBeNull()
  })

  it('explains a paused schedule and a scope without labels', async () => {
    mockFetch([
      { match: RUNS, data: [] },
      {
        match: REPORTS,
        data: [
          report({ active: false, nextRunAt: null }),
          report({
            id: 'rep-2',
            name: 'SLA geral',
            customers: [],
            customerIds: [],
            departments: [{ id: 'dep-1', name: 'Infra' }],
            ticketTypes: ['INCIDENT'],
            recipients: [],
            includeAccountOwners: true,
          }),
        ],
      },
    ])
    renderTab()

    expect(await screen.findByText('Pausado')).toBeTruthy()
    expect(
      screen.getByText('Todos os clientes · Infra · INCIDENT'),
    ).toBeTruthy()
    expect(
      screen.getByText(/Sem destinatário fixo \+ responsáveis das contas/),
    ).toBeTruthy()
  })

  it('counts the customers when the labels are missing', async () => {
    mockFetch([
      { match: RUNS, data: [] },
      {
        match: REPORTS,
        data: [report({ customers: [], customerIds: ['a', 'b'] })],
      },
    ])
    renderTab()

    expect(await screen.findByText('2 cliente(s)')).toBeTruthy()
  })

  it('pauses a schedule from the switch', async () => {
    const spy = mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [report()] },
      { method: 'PATCH', match: `${REPORTS}/rep-1`, data: report() },
    ])
    renderTab()

    fireEvent.click(await screen.findByRole('switch', { name: 'Pausar' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${REPORTS}/rep-1`, 'PATCH')).toEqual({
        active: false,
      }),
    )
  })

  it('generates the report of a schedule now', async () => {
    const spy = mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [report()] },
      { method: 'POST', match: RUNS, status: 201, data: run() },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Gerar agora SLA mensal' }),
    )

    await waitFor(() =>
      expect(fetchBody(spy, RUNS, 'POST')).toEqual({ reportId: 'rep-1' }),
    )
  })

  it('creates a schedule with the recipients and the preview', async () => {
    const spy = mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [] },
      { method: 'POST', match: REPORTS, status: 201, data: report() },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: /Novo relatório/ }),
    )
    fireEvent.change(
      screen.getByPlaceholderText('SLA mensal — clientes premium'),
      { target: { value: 'SLA de setembro' } },
    )
    fireEvent.change(
      screen.getByPlaceholderText('gestor@empresa.com, ops@empresa.com'),
      { target: { value: 'Gestor@Example.com, ops@example.com, lixo' } },
    )

    // Pré-visualização do próximo envio, no fuso escolhido.
    expect(
      screen.getByText(/Dia 1 às 07:00 \(America\/Sao_Paulo\)/),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(fetchBody(spy, REPORTS, 'POST')).toBeTruthy())
    expect(fetchBody(spy, REPORTS, 'POST')).toMatchObject({
      name: 'SLA de setembro',
      kind: 'SLA',
      period: 'LAST_MONTH',
      formats: ['PDF', 'CSV'],
      dayOfMonth: 1,
      atTime: '07:00',
      timezone: 'America/Sao_Paulo',
      recipients: ['gestor@example.com', 'ops@example.com'],
      includeAccountOwners: false,
      active: true,
    })
  })

  it('refuses to save without a name or without a format', async () => {
    mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: /Novo relatório/ }),
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveProperty(
      'disabled',
      true,
    )

    fireEvent.change(
      screen.getByPlaceholderText('SLA mensal — clientes premium'),
      { target: { value: 'SLA' } },
    )
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveProperty(
      'disabled',
      false,
    )

    fireEvent.click(screen.getByRole('button', { name: 'PDF' }))
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }))
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('edits a schedule without resending kind and active', async () => {
    const spy = mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [report()] },
      { method: 'PATCH', match: `${REPORTS}/rep-1`, data: report() },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar SLA mensal' }),
    )
    fireEvent.change(
      screen.getByPlaceholderText('SLA mensal — clientes premium'),
      { target: { value: 'SLA premium' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${REPORTS}/rep-1`, 'PATCH')).toBeTruthy(),
    )
    const body = fetchBody(spy, `${REPORTS}/rep-1`, 'PATCH') as Record<
      string,
      unknown
    >
    expect(body.name).toBe('SLA premium')
    expect(body.kind).toBeUndefined()
    expect(body.active).toBeUndefined()
  })

  it('drops a customer from the scope', async () => {
    mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [report()] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar SLA mensal' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Remover ACME' }))

    expect(screen.getByText('Vazio = todos os clientes.')).toBeTruthy()
  })

  it('shows the history with the summary and the download links', async () => {
    mockFetch([
      { match: RUNS, data: [run()] },
      { match: REPORTS, data: [report()] },
    ])
    renderTab()

    expect(await screen.findByText('01/09/2026 a 30/09/2026')).toBeTruthy()
    expect(screen.getByText(/12 aberto\(s\)/)).toBeTruthy()
    expect(screen.getByText(/MTTR 5 h 12 min/)).toBeTruthy()
    expect(screen.getByText('Enviado')).toBeTruthy()
    // Envio formatado no fuso do relatório (10:05Z → 07:05).
    expect(screen.getByText('01/10/2026 07:05')).toBeTruthy()
    const pdf = screen.getByRole('link', { name: 'Baixar PDF' })
    expect(pdf.getAttribute('href')).toBe(`${RUNS}/run-1/download?format=PDF`)
    expect(
      screen.getByRole('link', { name: 'Baixar CSV' }).getAttribute('href'),
    ).toBe(`${RUNS}/run-1/download?format=CSV`)
  })

  it('shows a failed on-demand run with no file', async () => {
    mockFetch([
      {
        match: RUNS,
        data: [
          run({
            id: 'run-2',
            status: 'FAILED',
            reportId: null,
            reportName: null,
            summary: null,
            error: 'MinIO fora do ar',
            formats: [],
            recipients: [],
            sentAt: null,
          }),
        ],
      },
      { match: REPORTS, data: [report()] },
    ])
    renderTab()

    expect(await screen.findByText('Falhou')).toBeTruthy()
    expect(screen.getByText('Sob demanda')).toBeTruthy()
    expect(screen.getByText('MinIO fora do ar')).toBeTruthy()
    expect(screen.getByText('Ninguém (só os arquivos)')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Baixar/ })).toBeNull()
  })

  it('generates an on-demand report from the dialog', async () => {
    const spy = mockFetch([
      { match: RUNS, data: [] },
      { match: REPORTS, data: [report()] },
      { method: 'POST', match: RUNS, status: 201, data: run() },
    ])
    renderTab()

    fireEvent.click(await screen.findByRole('button', { name: /Gerar agora/ }))
    fireEvent.change(
      screen.getByPlaceholderText('gestor@empresa.com, ops@empresa.com'),
      { target: { value: 'ops@example.com' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Gerar' }))

    await waitFor(() =>
      expect(fetchBody(spy, RUNS, 'POST')).toEqual({
        period: 'LAST_MONTH',
        customerIds: [],
        formats: ['PDF', 'CSV'],
        recipients: ['ops@example.com'],
      }),
    )
  })
})
