import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { fakeGitlabToken } from '@/src/__tests__/helpers/fake-tokens'
import type {
  WorkspaceIntegrationDTO,
  WorkspaceIntegrationProviderDTO,
  WorkspaceIntegrationsOverviewDTO,
} from '@/types/workspace-integration'
import { formatIntegrationDate } from '../integration-kit'
import { IntegrationsManager } from '../integrations-manager'

const WS = 'ws-1'
const BASE = `/api/workspaces/${WS}/integrations`

function connection(
  overrides: Partial<WorkspaceIntegrationDTO> = {},
): WorkspaceIntegrationDTO {
  return {
    id: 'int-slack',
    kind: 'SLACK',
    status: 'ACTIVE',
    statusError: null,
    externalId: 'T0001',
    externalName: 'Stratus',
    baseUrl: null,
    hasWebhookSecret: false,
    lastEventAt: '2026-10-08T15:30:00.000Z',
    lastEventType: 'slack:crm.deal.won',
    lastCheckedAt: null,
    slack: {
      routes: [
        { event: 'crm.deal.won', channelId: 'C1', channelName: 'vendas' },
        {
          event: 'servicedesk.sla.breached',
          channelId: null,
          channelName: null,
        },
      ],
      waitingMinutes: 15,
    },
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
    ...overrides,
  }
}

function provider(
  kind: WorkspaceIntegrationProviderDTO['kind'],
  overrides: Partial<WorkspaceIntegrationProviderDTO> = {},
): WorkspaceIntegrationProviderDTO {
  return {
    kind,
    available: true,
    unavailableReason: null,
    webhookUrl:
      kind === 'SLACK'
        ? 'https://steel.test/api/servicedesk/integrations/slack'
        : `https://steel.test/api/integrations/${kind.toLowerCase()}/webhook`,
    connection: null,
    ...overrides,
  }
}

function overview(
  providers: WorkspaceIntegrationProviderDTO[] = [
    provider('SLACK'),
    provider('GITHUB'),
    provider('GITLAB'),
  ],
): WorkspaceIntegrationsOverviewDTO {
  return {
    providers,
    enabledModules: ['SERVICE_DESK', 'CRM', 'COMMUNICATION'],
  }
}

function render(slackResult: 'connected' | 'error' | null = null) {
  return renderWithQuery(
    <IntegrationsManager workspaceId={WS} slackResult={slackResult} />,
  )
}

function card(name: string) {
  return screen.getByLabelText(name)
}

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('formatIntegrationDate', () => {
  it('formats in the product time zone, never the browser one', () => {
    expect(formatIntegrationDate('2026-10-08T15:30:00.000Z')).toBe(
      '08/10/2026, 12:30',
    )
    expect(formatIntegrationDate(null)).toBeNull()
    expect(formatIntegrationDate('nao-data')).toBeNull()
  })
})

describe('<IntegrationsManager /> — providers', () => {
  it('shows the three providers, not connected, with their webhook URL', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    render()
    expect(await screen.findByLabelText('Slack')).toBeTruthy()
    expect(screen.getAllByText('Não conectado')).toHaveLength(3)
    const connect = screen.getByRole('link', { name: /Conectar o Slack/ })
    expect(connect.getAttribute('href')).toBe(`${BASE}/slack/connect`)
    expect(
      screen.getByDisplayValue(
        'https://steel.test/api/integrations/gitlab/webhook',
      ),
    ).toBeTruthy()
    expect(
      within(card('GitLab')).getByLabelText('Endereço do GitLab'),
    ).toBeTruthy()
    fireEvent.click(
      within(card('GitHub')).getByRole('button', {
        name: /Copiar URL do webhook/,
      }),
    )
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'https://steel.test/api/integrations/github/webhook',
    )
  })

  it('shows Slack disabled with the reason when the server lacks the app', async () => {
    mockFetch([
      {
        match: BASE,
        data: overview([
          provider('SLACK', {
            available: false,
            unavailableReason: 'O app do Slack não está configurado.',
            webhookUrl: null,
          }),
          provider('GITHUB'),
          provider('GITLAB'),
        ]),
      },
    ])
    render()
    expect(await screen.findByText('Indisponível')).toBeTruthy()
    expect(
      screen.getByText('O app do Slack não está configurado.'),
    ).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Conectar o Slack/ })).toBeNull()
  })

  it('shows an error connection with reason, last event and last test', async () => {
    mockFetch([
      { match: `${BASE}/slack/channels`, data: [] },
      {
        match: BASE,
        data: overview([
          provider('SLACK'),
          provider('GITHUB', {
            connection: connection({
              id: 'int-gh',
              kind: 'GITHUB',
              status: 'ERROR',
              statusError: 'O GitHub recusou a chamada (401)',
              externalId: 'o/r',
              externalName: 'o/r',
              hasWebhookSecret: false,
              slack: null,
              lastEventAt: null,
              lastEventType: null,
              lastCheckedAt: '2026-10-08T15:30:00.000Z',
            }),
          }),
          provider('GITLAB', {
            connection: connection({
              id: 'int-gl',
              kind: 'GITLAB',
              externalId: 'g/p',
              externalName: null,
              baseUrl: 'https://git.acme.com',
              hasWebhookSecret: true,
              slack: null,
              lastEventType: null,
            }),
          }),
        ]),
      },
    ])
    render()
    const github = await screen.findByLabelText('GitHub')
    expect(within(github).getByText('Com erro')).toBeTruthy()
    expect(within(github).getByRole('alert').textContent).toBe(
      'O GitHub recusou a chamada (401)',
    )
    expect(within(github).getByText('nenhum ainda')).toBeTruthy()
    expect(within(github).getByText('08/10/2026, 12:30')).toBeTruthy()
    expect(within(github).getByText(/Sem segredo de webhook/)).toBeTruthy()
    const gitlab = card('GitLab')
    expect(within(gitlab).getByText('Conectado')).toBeTruthy()
    expect(within(gitlab).getByText('g/p')).toBeTruthy()
    expect(within(gitlab).getByText(/em https:\/\/git.acme.com/)).toBeTruthy()
    expect(within(gitlab).getByText('nunca')).toBeTruthy()
  })

  it('announces the OAuth result and shows loading and errors', async () => {
    mockFetch([{ match: BASE, status: 403, error: 'Sem permissão' }])
    render('error')
    expect(screen.getByText('Carregando integrações…')).toBeTruthy()
    expect(await screen.findByText('Sem permissão')).toBeTruthy()
  })

  it('accepts the connected OAuth result', async () => {
    mockFetch([{ match: BASE, data: overview() }])
    render('connected')
    expect(await screen.findByLabelText('Slack')).toBeTruthy()
  })
})

describe('<IntegrationsManager /> — GitHub and GitLab', () => {
  it('connects GitHub with repository, token and secret', async () => {
    const spy = mockFetch([
      { match: BASE, data: overview() },
      {
        method: 'POST',
        match: `${BASE}/github`,
        data: connection({ kind: 'GITHUB' }),
      },
    ])
    render()
    const github = await screen.findByLabelText('GitHub')
    const submit = within(github).getByRole('button', {
      name: /Conectar o GitHub/,
    })
    expect(submit).toHaveProperty('disabled', true)
    fireEvent.change(within(github).getByLabelText('Repositório'), {
      target: { value: ' o/r ' },
    })
    fireEvent.change(within(github).getByLabelText('Token de acesso'), {
      target: { value: 'github_pat_11ABCDEFG0123456789' },
    })
    fireEvent.change(within(github).getByLabelText('Segredo do webhook'), {
      target: { value: 'segredo-de-webhook-1' },
    })
    expect(
      (within(github).getByLabelText('Token de acesso') as HTMLInputElement)
        .type,
    ).toBe('password')
    fireEvent.click(submit)
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/github`, 'POST')).toEqual({
        repo: 'o/r',
        token: 'github_pat_11ABCDEFG0123456789',
        webhookSecret: 'segredo-de-webhook-1',
      })
    })
  })

  it('connects a self-managed GitLab project (secret optional)', async () => {
    const spy = mockFetch([
      { match: BASE, data: overview() },
      {
        method: 'POST',
        match: `${BASE}/gitlab`,
        status: 502,
        error: 'O GitLab não respondeu',
      },
    ])
    render()
    const gitlab = await screen.findByLabelText('GitLab')
    fireEvent.change(within(gitlab).getByLabelText('Endereço do GitLab'), {
      target: { value: 'https://git.acme.com' },
    })
    fireEvent.change(within(gitlab).getByLabelText('Projeto'), {
      target: { value: 'g/p' },
    })
    fireEvent.change(within(gitlab).getByLabelText('Token de acesso'), {
      target: { value: fakeGitlabToken('0123456789abcdefghij') },
    })
    fireEvent.click(
      within(gitlab).getByRole('button', { name: /Conectar o GitLab/ }),
    )
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/gitlab`, 'POST')).toEqual({
        baseUrl: 'https://git.acme.com',
        project: 'g/p',
        token: fakeGitlabToken('0123456789abcdefghij'),
        webhookSecret: null,
      })
    })
  })

  it('rotates token and secret, tests and disconnects a connection', async () => {
    const gl = connection({
      id: 'int-gl',
      kind: 'GITLAB',
      externalId: 'g/p',
      externalName: 'g/p',
      baseUrl: 'https://gitlab.com',
      hasWebhookSecret: true,
      slack: null,
    })
    const spy = mockFetch([
      {
        match: BASE,
        data: overview([
          provider('SLACK'),
          provider('GITHUB'),
          provider('GITLAB', { connection: gl }),
        ]),
      },
      { method: 'PATCH', match: `${BASE}/gitlab`, data: gl },
      {
        method: 'POST',
        match: `${BASE}/gitlab/test`,
        data: { ok: false, message: 'Token expirado', integration: gl },
      },
      { method: 'DELETE', match: `${BASE}/gitlab`, data: null },
    ])
    render()
    const gitlab = await screen.findByLabelText('GitLab')
    fireEvent.change(within(gitlab).getByLabelText('Trocar o token'), {
      target: { value: fakeGitlabToken('novo-0123456789abcd') },
    })
    const [saveToken, saveSecret] = within(gitlab).getAllByRole('button', {
      name: 'Salvar',
    })
    fireEvent.click(saveToken)
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/gitlab`, 'PATCH')).toEqual({
        token: fakeGitlabToken('novo-0123456789abcd'),
      })
    })
    fireEvent.change(
      within(gitlab).getByLabelText('Trocar o segredo do webhook'),
      { target: { value: 'segredo-novo-123456' } },
    )
    fireEvent.click(saveSecret)
    await waitFor(() => {
      expect(
        spy.mock.calls.filter(([, init]) => init?.method === 'PATCH'),
      ).toHaveLength(2)
    })

    fireEvent.click(
      within(gitlab).getByRole('button', { name: /Testar conexão/ }),
    )
    await waitFor(() => {
      expect(
        spy.mock.calls.some(([url]) => String(url).endsWith('/gitlab/test')),
      ).toBe(true)
    })

    fireEvent.click(within(gitlab).getByRole('button', { name: 'Desconectar' }))
    const dialog = await screen.findByRole('alertdialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desconectar' }))
    await waitFor(() => {
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith(`${BASE}/gitlab`) && init?.method === 'DELETE',
        ),
      ).toBe(true)
    })
  })
})

describe('<IntegrationsManager /> — Slack rules', () => {
  function connected(extra: Partial<WorkspaceIntegrationDTO> = {}) {
    return overview([
      provider('SLACK', { connection: connection(extra) }),
      provider('GITHUB'),
      provider('GITLAB'),
    ])
  }

  it('lists the rules per enabled module, with Steel Agents always offered', async () => {
    mockFetch([
      {
        match: `${BASE}/slack/channels`,
        data: [{ id: 'C1', name: 'vendas', isPrivate: false }],
      },
      { match: BASE, data: connected() },
    ])
    render()
    const crm = await screen.findByRole('region', { name: 'Regras de CRM' })
    expect(within(crm).getByText('Negócio ganho')).toBeTruthy()
    expect(await within(crm).findByText('#vendas')).toBeTruthy()
    const sd = screen.getByRole('region', { name: 'Regras de ServiceDesk' })
    expect(within(sd).getByText('canal do time')).toBeTruthy()
    expect(
      screen.getByRole('region', { name: 'Regras de Steel Agents' }),
    ).toBeTruthy()
    expect(
      within(
        screen.getByRole('region', { name: 'Regras de Comunicação' }),
      ).getByText(/Nenhuma regra/),
    ).toBeTruthy()
  })

  it('removes a rule and saves the waiting threshold', async () => {
    const spy = mockFetch([
      { match: `${BASE}/slack/channels`, data: [] },
      { match: BASE, data: connected() },
      { method: 'PATCH', match: `${BASE}/slack`, data: connection() },
    ])
    render()
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Remover regra Negócio ganho',
      }),
    )
    await waitFor(() => {
      expect(fetchBody(spy, `${BASE}/slack`, 'PATCH')).toEqual({
        routes: [
          {
            event: 'servicedesk.sla.breached',
            channelId: null,
            channelName: null,
          },
        ],
      })
    })

    const minutes = screen.getByLabelText(
      /Considerar "aguardando há muito tempo"/,
    )
    const comm = screen.getByRole('region', { name: 'Regras de Comunicação' })
    const save = within(comm).getByRole('button', { name: 'Salvar' })
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(minutes, { target: { value: '2' } })
    expect(save).toHaveProperty('disabled', true)
    fireEvent.change(minutes, { target: { value: '30' } })
    fireEvent.click(save)
    await waitFor(() => {
      expect(
        spy.mock.calls.some(
          ([, init]) =>
            init?.method === 'PATCH' &&
            String(init.body) === JSON.stringify({ waitingMinutes: 30 }),
        ),
      ).toBe(true)
    })
  })

  it('shows the channel listing error and falls back to the stored names', async () => {
    mockFetch([
      {
        match: `${BASE}/slack/channels`,
        status: 502,
        error: 'O Slack não respondeu',
      },
      {
        match: BASE,
        data: connected({
          slack: {
            routes: [
              { event: 'crm.lead.created', channelId: 'C7', channelName: null },
              {
                event: 'crm.deal.lost',
                channelId: 'C8',
                channelName: 'perdas',
              },
            ],
            waitingMinutes: 15,
          },
        }),
      },
    ])
    render()
    expect(await screen.findByText('O Slack não respondeu')).toBeTruthy()
    expect(screen.getByText('C7')).toBeTruthy()
    expect(screen.getByText('#perdas')).toBeTruthy()
  })
})
