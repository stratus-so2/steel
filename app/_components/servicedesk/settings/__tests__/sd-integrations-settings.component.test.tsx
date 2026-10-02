import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type {
  SdIntegrationDTO,
  SdIntegrationsOverviewDTO,
} from '@/types/sd-integration'
import { SdIntegrationsTab } from '../integrations-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const BASE = `/api/workspaces/${WS}/servicedesk/integrations`
const CHANNELS = `${BASE}/slack/channels`

const config = {
  departments: [
    { id: 'dep-1', name: 'Suporte N1', children: [] },
    { id: 'dep-2', name: 'Infra', children: [{ id: 'dep-3', name: 'Redes' }] },
  ],
} as unknown as SdConfigBootstrapDTO

const SLACK_CONFIG: NonNullable<SdIntegrationDTO['slack']> = {
  channels: [{ departmentId: null, channelId: 'C0', channelName: 'geral' }],
  events: ['sla.breached'],
  allowTicketFromMessage: true,
  mirrorThreadReplies: true,
  ticketType: 'INCIDENT',
  departmentId: null,
}

function slack(overrides: Partial<SdIntegrationDTO> = {}): SdIntegrationDTO {
  return {
    id: 'int-slack',
    kind: 'SLACK',
    status: 'ACTIVE',
    statusError: null,
    externalId: 'T0001',
    externalName: 'Stratus',
    hasWebhookSecret: false,
    slack: SLACK_CONFIG,
    github: null,
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  }
}

function github(overrides: Partial<SdIntegrationDTO> = {}): SdIntegrationDTO {
  return {
    id: 'int-gh',
    kind: 'GITHUB',
    status: 'ACTIVE',
    statusError: null,
    externalId: 'stratus-so2/steel',
    externalName: 'stratus-so2/steel',
    hasWebhookSecret: true,
    slack: null,
    github: { suggestPhaseOnClose: true, allowIssueFromTicket: true },
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  }
}

function overview(
  overrides: Partial<SdIntegrationsOverviewDTO> = {},
): SdIntegrationsOverviewDTO {
  return {
    slackConfigured: true,
    slackEventsUrl: 'https://steel.test/api/servicedesk/integrations/slack',
    githubWebhookUrl: 'https://steel.test/api/servicedesk/integrations/github',
    slack: null,
    github: null,
    ...overrides,
  }
}

function renderTab(canEdit = true) {
  return renderWithQuery(
    <SdSettingsProvider value={{ workspaceId: WS, canEdit, config }}>
      <SdIntegrationsTab />
    </SdSettingsProvider>,
  )
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('SD_SETTINGS_TABS', () => {
  it('registra a aba Integrações antes das Notificações', () => {
    const ids = SD_SETTINGS_TABS.map((tab) => tab.id)
    expect(ids).toContain('integrations')
    expect(ids.indexOf('integrations')).toBeLessThan(
      ids.indexOf('notifications'),
    )
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'integrations')
    expect(tab?.label).toBe('Integrações')
    expect(tab?.component).toBe(SdIntegrationsTab)
    expect(tab?.personal).toBeUndefined()
  })
})

describe('<SdIntegrationsTab /> — Slack', () => {
  it('explica a degradação quando o app não está configurado no servidor', async () => {
    mockFetch([
      {
        match: BASE,
        data: overview({ slackConfigured: false, slackEventsUrl: null }),
      },
    ])
    renderTab()
    expect(
      await screen.findByText(/não está configurado neste servidor/),
    ).toBeTruthy()
    expect(screen.getByText('SLACK_CLIENT_ID')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Conectar o Slack/ })).toBeNull()
  })

  it('oferece conectar com a Request URL a cadastrar no app', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    renderTab()
    const link = await screen.findByRole('link', { name: /Conectar o Slack/ })
    expect(link.getAttribute('href')).toBe(`${BASE}/slack/connect`)
    expect(
      screen.getByDisplayValue(
        'https://steel.test/api/servicedesk/integrations/slack',
      ),
    ).toBeTruthy()
  })

  it('esconde o botão de conectar no modo leitura', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    renderTab(false)
    expect(
      await screen.findByText(/Nenhum workspace do Slack conectado/),
    ).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Conectar o Slack/ })).toBeNull()
  })

  it('mostra o time conectado, o erro da integração e o canal por time', async () => {
    mockFetch([
      {
        match: CHANNELS,
        data: [
          { id: 'C0', name: 'geral', isPrivate: false },
          { id: 'C1', name: 'redes', isPrivate: true },
        ],
      },
      {
        match: BASE,
        data: overview({
          slack: slack({
            status: 'ERROR',
            statusError: 'canal não encontrado',
          }),
        }),
      },
    ])
    renderTab()
    expect(await screen.findByText('Stratus')).toBeTruthy()
    expect(screen.getByText('Com erro')).toBeTruthy()
    expect(screen.getByText('canal não encontrado')).toBeTruthy()
    expect(await screen.findByText(/Canal padrão/)).toBeTruthy()
    expect(screen.getByText('Suporte N1')).toBeTruthy()
    // Sub-departamento aparece com o caminho completo.
    expect(screen.getByText('Infra › Redes')).toBeTruthy()
  })

  it('avisa quando o bot não enxerga nenhum canal', async () => {
    mockFetch([
      { match: CHANNELS, data: [] },
      { match: BASE, data: overview({ slack: slack() }) },
    ])
    renderTab()
    expect(await screen.findByText(/não enxerga nenhum canal/)).toBeTruthy()
  })

  it('mostra o erro da listagem de canais', async () => {
    mockFetch([
      { match: CHANNELS, status: 502, error: 'O Slack não respondeu' },
      { match: BASE, data: overview({ slack: slack() }) },
    ])
    renderTab()
    expect(await screen.findByText('O Slack não respondeu')).toBeTruthy()
  })

  it('mostra o canal já escolhido e um seletor por time (mais o padrão)', async () => {
    mockFetch([
      {
        match: CHANNELS,
        data: [
          { id: 'C0', name: 'geral', isPrivate: false },
          { id: 'C1', name: 'redes', isPrivate: false },
        ],
      },
      {
        match: BASE,
        data: overview({
          slack: slack({
            slack: {
              ...SLACK_CONFIG,
              channels: [
                { departmentId: null, channelId: 'C0', channelName: 'geral' },
                {
                  departmentId: 'dep-1',
                  channelId: 'C1',
                  channelName: 'redes',
                },
              ],
            },
          }),
        }),
      },
    ])
    renderTab()
    await screen.findByText('Stratus')
    // Espera a lista de canais chegar (os gatilhos só aparecem depois dela).
    expect(await screen.findByText('#geral')).toBeTruthy()
    expect(screen.getByText('#redes')).toBeTruthy()
    // Canal padrão + um seletor por departamento (3, com o sub-departamento)
    // + tipo do chamado + time que recebe.
    const selects = screen.getAllByRole('combobox')
    expect(selects.length).toBeGreaterThanOrEqual(4)
    // Time sem canal cai no padrão — e a tela diz isso.
    expect(screen.getAllByText('Usar o canal padrão').length).toBeGreaterThan(0)
  })

  it('liga um evento do catálogo pelo rótulo em pt-BR', async () => {
    const spy = mockFetch([
      { match: CHANNELS, data: [] },
      { match: BASE, data: overview({ slack: slack() }) },
      { method: 'PATCH', match: `${BASE}/slack`, data: slack() },
    ])
    renderTab()
    const toggle = await screen.findByRole('switch', {
      name: 'Chamado atribuído a você',
    })
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/slack`, 'PATCH')).toEqual({
        events: ['sla.breached', 'ticket.assigned'],
      })
    })
  })

  it('desliga o espelhamento da thread', async () => {
    const spy = mockFetch([
      { match: CHANNELS, data: [] },
      { match: BASE, data: overview({ slack: slack() }) },
      { method: 'PATCH', match: `${BASE}/slack`, data: slack() },
    ])
    renderTab()
    const toggle = await screen.findByRole('switch', {
      name: /Respostas da thread entram no histórico/,
    })
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/slack`, 'PATCH')).toEqual({
        mirrorThreadReplies: false,
      })
    })
  })

  it('desconecta o Slack depois da confirmação', async () => {
    const spy = mockFetch([
      { match: CHANNELS, data: [] },
      { match: BASE, data: overview({ slack: slack() }) },
      { method: 'DELETE', match: `${BASE}/slack`, data: null },
    ])
    renderTab()
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Desconectar' }))
    await waitFor(() => {
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).includes(`${BASE}/slack`) && init?.method === 'DELETE',
        ),
      ).toBe(true)
    })
  })
})

describe('<SdIntegrationsTab /> — GitHub', () => {
  it('mostra a URL do webhook e o formulário de conexão', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    renderTab()
    expect(
      await screen.findByDisplayValue(
        'https://steel.test/api/servicedesk/integrations/github',
      ),
    ).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Conectar o repositório/ }),
    ).toBeTruthy()
  })

  it('conecta o repositório com token e segredo', async () => {
    const spy = mockFetch([
      { match: BASE, data: overview() },
      { method: 'POST', match: `${BASE}/github`, data: github() },
    ])
    renderTab()
    fireEvent.change(await screen.findByLabelText('Repositório'), {
      target: { value: 'stratus-so2/steel' },
    })
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: 'github_pat_11ABCDEFG0123456789' },
    })
    fireEvent.change(screen.getByLabelText('Segredo do webhook'), {
      target: { value: 'segredo-de-teste' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /Conectar o repositório/ }),
    )
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/github`, 'POST')).toEqual({
        repo: 'stratus-so2/steel',
        token: 'github_pat_11ABCDEFG0123456789',
        webhookSecret: 'segredo-de-teste',
        suggestPhaseOnClose: true,
        allowIssueFromTicket: true,
      })
    })
  })

  it('só habilita conectar com repositório e token preenchidos', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    renderTab()
    const button = await screen.findByRole('button', {
      name: /Conectar o repositório/,
    })
    expect(button).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Repositório'), {
      target: { value: 'owner/repo' },
    })
    expect(button).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByLabelText('Token'), {
      target: { value: 'github_pat_11ABCDEFG0123456789' },
    })
    expect(button).toHaveProperty('disabled', false)
  })

  it('mostra o repositório conectado e que o webhook está assinado', async () => {
    mockFetch([{ match: BASE, data: overview({ github: github() }) }])
    renderTab()
    expect(await screen.findByText('stratus-so2/steel')).toBeTruthy()
    expect(screen.getByText('Webhook assinado')).toBeTruthy()
  })

  it('alerta quando falta o segredo do webhook', async () => {
    mockFetch([
      {
        match: BASE,
        data: overview({ github: github({ hasWebhookSecret: false }) }),
      },
    ])
    renderTab()
    expect(await screen.findByText('Sem segredo de webhook')).toBeTruthy()
    expect(screen.getByText(/o webhook é recusado/)).toBeTruthy()
  })

  it('desliga a sugestão de fase', async () => {
    const spy = mockFetch([
      { match: BASE, data: overview({ github: github() }) },
      { method: 'PATCH', match: `${BASE}/github`, data: github() },
    ])
    renderTab()
    fireEvent.click(
      await screen.findByRole('switch', {
        name: /Fechar a issue sugere avançar a fase/,
      }),
    )
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/github`, 'PATCH')).toEqual({
        suggestPhaseOnClose: false,
      })
    })
  })

  it('troca o token e o segredo sem nunca exibi-los', async () => {
    const spy = mockFetch([
      { match: BASE, data: overview({ github: github() }) },
      { method: 'PATCH', match: `${BASE}/github`, data: github() },
    ])
    renderTab()
    const token = await screen.findByLabelText('Trocar o token')
    expect(token.getAttribute('type')).toBe('password')
    fireEvent.change(token, {
      target: { value: 'github_pat_11ABCDEFG0123456789' },
    })
    const [save] = screen.getAllByRole('button', { name: 'Salvar' })
    fireEvent.click(save)
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/github`, 'PATCH')).toEqual({
        token: 'github_pat_11ABCDEFG0123456789',
      })
    })

    const secret = screen.getByLabelText('Trocar o segredo do webhook')
    expect(secret.getAttribute('type')).toBe('password')
  })
})

describe('<SdIntegrationsTab /> — estados da aba', () => {
  it('mostra o aviso de que os tokens não voltam', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    renderTab()
    expect(await screen.findByText(/nunca voltam por aqui/)).toBeTruthy()
  })

  it('mostra o erro da consulta', async () => {
    mockFetch([{ match: BASE, status: 403, error: 'Só administradores' }])
    renderTab()
    expect(await screen.findByText('Só administradores')).toBeTruthy()
  })
})
