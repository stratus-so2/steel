import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspacePermissionsProvider } from '@/app/_components/workspace/workspace-permissions'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { WorkspaceAiSettingsDTO } from '@/types/ai-settings'
import { AiSettingsSection } from '../ai-settings-section'

vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const URL = '/api/workspaces/ws_1/ai-settings'

function settings(
  overrides?: Partial<WorkspaceAiSettingsDTO>,
): WorkspaceAiSettingsDTO {
  return {
    workspaceId: 'ws_1',
    providers: [
      { id: 'openai', label: 'OpenAI', available: true },
      { id: 'anthropic', label: 'Anthropic (Claude)', available: false },
    ],
    models: [
      {
        key: 'openai:gpt-4o-mini',
        provider: 'openai',
        model: 'gpt-4o-mini',
        label: 'GPT-4o mini',
        available: true,
        enabled: true,
      },
      {
        key: 'anthropic:claude-sonnet-5',
        provider: 'anthropic',
        model: 'claude-sonnet-5',
        label: 'Claude Sonnet 5',
        available: false,
        enabled: false,
      },
    ],
    enabledModels: ['openai:gpt-4o-mini'],
    crmAssistantModel: 'openai:gpt-4o-mini',
    whatsappReplyModel: 'openai:gpt-4o-mini',
    whatsappSentimentModel: 'openai:gpt-4o-mini',
    monthlyQuotaUsd: 50,
    usdPer1kTokens: 4,
    usage: {
      periodStart: '2026-09-01T00:00:00.000Z',
      inputTokens: 1500,
      outputTokens: 500,
      usedUsd: 8,
      remainingUsd: 42,
      exceeded: false,
    },
    userPreference: null,
    canManage: true,
    ...overrides,
  }
}

function renderAs(isPrivileged: boolean) {
  return renderWithQuery(
    <WorkspacePermissionsProvider value={{ isPrivileged, permissions: {} }}>
      <AiSettingsSection workspaceId='ws_1' />
    </WorkspacePermissionsProvider>,
  )
}

describe('<AiSettingsSection />', () => {
  it('shows consumption vs. quota', async () => {
    mockFetch([{ match: URL, data: settings() }])
    renderAs(true)

    expect(await screen.findByText('Consumo do mês')).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '16',
    )
    expect(screen.getByText(/Restante:/).textContent).toContain('42')
  })

  it('hides admin-only controls from a regular member', async () => {
    mockFetch([{ match: URL, data: settings({ canManage: false }) }])
    renderAs(false)

    expect(await screen.findByText('Meu modelo')).toBeTruthy()
    expect(screen.queryByText('Provedores e modelos habilitados')).toBeNull()
    expect(screen.queryByLabelText('Cota (US$)')).toBeNull()
    expect(screen.getByText(/Apenas o dono e os administradores/)).toBeTruthy()
  })

  it('marks a provider without a platform key as unavailable', async () => {
    mockFetch([{ match: URL, data: settings() }])
    renderAs(true)

    expect(await screen.findByText('Indisponível')).toBeTruthy()
    const sonnet = screen.getByRole('checkbox', { name: /Claude Sonnet 5/ })
    expect(sonnet.getAttribute('aria-disabled')).toBe('true')
  })

  it('lets an admin save a new quota', async () => {
    const fetchSpy = mockFetch([
      {
        method: 'PATCH',
        match: URL,
        data: settings({ monthlyQuotaUsd: 120 }),
      },
      { match: URL, data: settings() },
    ])
    renderAs(true)

    const quota = (await screen.findByLabelText(
      'Cota (US$)',
    )) as HTMLInputElement
    fireEvent.change(quota, { target: { value: '120' } })
    fireEvent.click(
      screen.getByRole('button', { name: 'Salvar ajustes de IA' }),
    )

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Ajustes de IA salvos'),
    )
    expect(fetchBody(fetchSpy, URL, 'PATCH')).toEqual({
      enabledModels: ['openai:gpt-4o-mini'],
      crmAssistantModel: 'openai:gpt-4o-mini',
      whatsappReplyModel: 'openai:gpt-4o-mini',
      whatsappSentimentModel: 'openai:gpt-4o-mini',
      monthlyQuotaUsd: 120,
    })
  })

  it('warns when the quota is exhausted', async () => {
    mockFetch([
      {
        match: URL,
        data: settings({
          usage: {
            periodStart: '2026-09-01T00:00:00.000Z',
            inputTokens: 10000,
            outputTokens: 2500,
            usedUsd: 50,
            remainingUsd: 0,
            exceeded: true,
          },
        }),
      },
    ])
    renderAs(true)

    expect(await screen.findByText(/A cota mensal foi atingida/)).toBeTruthy()
  })
})
