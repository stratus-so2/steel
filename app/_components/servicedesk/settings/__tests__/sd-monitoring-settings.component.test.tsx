import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdMonitorAlertDTO, SdMonitorSourceDTO } from '@/types/sd-monitor'
import {
  SD_MONITOR_KIND_LABEL,
  SdMonitoringTab,
  sdMonitorWebhookUrl,
} from '../monitoring-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const SD_URL = `/api/workspaces/${WS}/servicedesk`
const SOURCES = `${SD_URL}/monitor-sources`
const ALERTS = `${SD_URL}/monitor-alerts`

const config = {
  departments: [
    { id: 'dep-1', name: 'Suporte N1', children: [] },
    {
      id: 'dep-2',
      name: 'Infra',
      children: [{ id: 'dep-3', name: 'Redes' }],
    },
  ],
  categories: [{ id: 'cat-1', name: 'Infraestrutura' }],
  priorities: [
    { id: 'p-alta', name: 'Alta' },
    { id: 'p-baixa', name: 'Baixa' },
  ],
} as unknown as SdConfigBootstrapDTO

function source(
  overrides: Partial<SdMonitorSourceDTO> = {},
): SdMonitorSourceDTO {
  return {
    id: 'src-1',
    name: 'Zabbix matriz',
    kind: 'ZABBIX',
    active: true,
    ticketType: 'INCIDENT',
    departmentId: null,
    categoryId: null,
    customerId: null,
    severityMap: [{ from: 'Disaster', priorityId: 'p-alta' }],
    autoResolve: true,
    flappingWindowMinutes: 30,
    lastEventAt: '2026-10-01T12:00:00.000Z',
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  }
}

function alert(overrides: Partial<SdMonitorAlertDTO> = {}): SdMonitorAlertDTO {
  return {
    id: 'a1',
    sourceId: 'src-1',
    sourceName: 'Zabbix matriz',
    status: 'OPEN',
    externalId: '31415',
    severity: 'Disaster',
    host: 'SRV-01',
    subject: 'Sem resposta do agente no SRV-01',
    body: null,
    configItem: { id: 'ci-1', name: 'SRV-01' },
    ticket: { id: 't1', number: 42, title: 'Servidor fora', phase: 'Novo' },
    startedAt: '2026-10-01T12:00:00.000Z',
    resolvedAt: null,
    createdAt: '2026-10-01T12:00:00.000Z',
    ...overrides,
  }
}

function renderTab(canEdit = true) {
  return renderWithQuery(
    <SdSettingsProvider value={{ workspaceId: WS, canEdit, config }}>
      <SdMonitoringTab />
    </SdSettingsProvider>,
  )
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('SD_SETTINGS_TABS', () => {
  it('registers the monitoring tab before the WhatsApp one', () => {
    const ids = SD_SETTINGS_TABS.map((tab) => tab.id)
    expect(ids).toContain('monitoring')
    expect(ids.indexOf('monitoring')).toBeLessThan(ids.indexOf('whatsapp'))
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'monitoring')
    expect(tab?.label).toBe('Monitoramento')
    expect(tab?.component).toBe(SdMonitoringTab)
  })

  it('labels both kinds in pt-BR and builds the public url', () => {
    expect(SD_MONITOR_KIND_LABEL.ZABBIX).toBe('Zabbix')
    expect(SD_MONITOR_KIND_LABEL.WEBHOOK).toBe('Webhook genérico')
    expect(sdMonitorWebhookUrl('/api/servicedesk/monitoring/abc')).toMatch(
      /\/api\/servicedesk\/monitoring\/abc$/,
    )
  })
})

describe('<SdMonitoringTab />', () => {
  it('invites the admin to create the first source', async () => {
    mockFetch([{ match: SOURCES, data: [] }])
    renderTab()
    expect(await screen.findByText(/Nenhuma origem cadastrada/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Nova origem/ })).toBeTruthy()
  })

  it('surfaces the error of the sources query', async () => {
    mockFetch([{ match: SOURCES, status: 403, error: 'Só administradores' }])
    renderTab()
    expect(await screen.findByText('Só administradores')).toBeTruthy()
  })

  it('shows the source with its severity map and hides the writes in read only', async () => {
    mockFetch([{ match: SOURCES, data: [source({ active: false })] }])
    renderTab(false)
    expect(await screen.findByText('Zabbix matriz')).toBeTruthy()
    expect(screen.getByText('Zabbix')).toBeTruthy()
    expect(screen.getByText('Inativa')).toBeTruthy()
    expect(screen.getByText('Disaster → Alta')).toBeTruthy()
    expect(screen.getByText(/janela de 30 min/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Nova origem/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Gerar token/ })).toBeNull()
  })

  it('creates a source and shows the token once with the zabbix snippet', async () => {
    const spy = mockFetch([
      { match: SOURCES, data: [] },
      {
        method: 'POST',
        match: SOURCES,
        status: 201,
        data: {
          ...source(),
          token: 'tok-123',
          webhookPath: '/api/servicedesk/monitoring/tok-123',
        },
      },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Nova origem/ }))

    fireEvent.change(screen.getByPlaceholderText('Zabbix matriz'), {
      target: { value: 'Zabbix DC' },
    })
    fireEvent.click(screen.getByRole('button', { name: /\+ Disaster/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText('URL de Zabbix matriz')).toBeTruthy()
    const body = fetchBody(spy, SOURCES)
    expect(body.name).toBe('Zabbix DC')
    expect(body.severityMap).toEqual([
      { from: 'Disaster', priorityId: 'p-alta' },
    ])
    expect(body.autoResolve).toBe(true)
    expect(body.flappingWindowMinutes).toBe(30)

    expect(
      screen.getByText(/\/api\/servicedesk\/monitoring\/tok-123/),
    ).toBeTruthy()
    expect(screen.getByText(/"eventId": "\{EVENT.ID\}"/)).toBeTruthy()

    fireEvent.click(
      screen.getByRole('button', { name: 'Copiar a URL do webhook' }),
    )
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('/api/servicedesk/monitoring/tok-123'),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Já copiei' }))
    await waitFor(() =>
      expect(screen.queryByText('URL de Zabbix matriz')).toBeNull(),
    )
  })

  it('edits a source and sends only the shown values', async () => {
    const spy = mockFetch([
      { match: SOURCES, data: [source()] },
      { method: 'PATCH', match: `${SOURCES}/src-1`, data: source() },
    ])
    renderTab()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Editar Zabbix matriz' }),
    )
    fireEvent.click(
      screen.getByRole('switch', {
        name: 'Encerrar o chamado quando o alerta normalizar',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${SOURCES}/src-1`, 'PATCH')).toMatchObject({
        name: 'Zabbix matriz',
        autoResolve: false,
        active: true,
      }),
    )
  })

  it('rotates the token and shows the new url', async () => {
    mockFetch([
      { match: SOURCES, data: [source()] },
      {
        method: 'POST',
        match: `${SOURCES}/src-1/token`,
        data: {
          ...source(),
          token: 'tok-novo',
          webhookPath: '/api/servicedesk/monitoring/tok-novo',
        },
      },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Gerar token/ }))
    expect(
      await screen.findByText(/\/api\/servicedesk\/monitoring\/tok-novo/),
    ).toBeTruthy()
  })

  it('lists the recent alerts of the source on demand', async () => {
    mockFetch([
      { match: SOURCES, data: [source()] },
      {
        match: ALERTS,
        data: [
          alert(),
          alert({
            id: 'a2',
            externalId: '27182',
            status: 'RESOLVED',
            ticket: null,
            severity: null,
            host: null,
            configItem: null,
            subject: 'Disco cheio',
          }),
        ],
      },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver alertas' }))

    expect(
      await screen.findByText('Sem resposta do agente no SRV-01'),
    ).toBeTruthy()
    expect(screen.getByText('31415')).toBeTruthy()
    expect(screen.getByText('Aberto')).toBeTruthy()
    expect(screen.getByText('Normalizado')).toBeTruthy()
    expect(screen.getByText(/#42/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ocultar alertas' }))
    await waitFor(() => expect(screen.queryByText('31415')).toBeNull())
  })

  it('says when the source never received an alert', async () => {
    mockFetch([
      { match: SOURCES, data: [source()] },
      { match: ALERTS, data: [] },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver alertas' }))
    expect(
      await screen.findByText(/Nenhum alerta recebido desta origem ainda/),
    ).toBeTruthy()
  })

  it('surfaces an error of the alerts query', async () => {
    mockFetch([
      { match: SOURCES, data: [source()] },
      { match: ALERTS, status: 403, error: 'Só agentes' },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Ver alertas' }))
    expect(await screen.findByText('Só agentes')).toBeTruthy()
  })

  it('reports an error of the create mutation', async () => {
    mockFetch([
      { match: SOURCES, data: [] },
      {
        method: 'POST',
        match: SOURCES,
        status: 409,
        error: 'Já existe uma origem com esses dados',
      },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Nova origem/ }))
    fireEvent.change(screen.getByPlaceholderText('Zabbix matriz'), {
      target: { value: 'Repetida' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByText(/URL de/)).toBeNull())
  })

  it('keeps the save button disabled without a name and with an empty severity', async () => {
    mockFetch([{ match: SOURCES, data: [] }])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: /Nova origem/ }))
    const save = screen.getByRole('button', { name: 'Salvar' })
    expect(save.hasAttribute('disabled')).toBe(true)

    fireEvent.change(screen.getByPlaceholderText('Zabbix matriz'), {
      target: { value: 'Nova' },
    })
    expect(
      screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled'),
    ).toBe(false)

    fireEvent.click(
      screen.getByRole('button', { name: /Adicionar severidade/ }),
    )
    expect(
      screen.getByRole('button', { name: 'Salvar' }).hasAttribute('disabled'),
    ).toBe(true)
  })
})
