import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdNotificationPreferencesDTO } from '@/types/sd-notification'
import {
  SdNotificationsMatrix,
  SdNotificationsTab,
  sdCellChecked,
  sdCellKey,
  sdVisibleChannels,
} from '../notifications-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const URL = `/api/workspaces/${WS}/servicedesk/notification-preferences`

function prefs(
  overrides: Partial<SdNotificationPreferencesDTO> = {},
): SdNotificationPreferencesDTO {
  return {
    isAgent: true,
    whatsappAvailable: false,
    groups: [
      {
        label: 'Conversas',
        events: [
          {
            event: 'ticket.message',
            label: 'Nova mensagem no chamado',
            description: 'Resposta pública no histórico.',
            audience: ['assignee', 'followers'],
            agentOnly: false,
            channels: ['IN_APP', 'EMAIL', 'WHATSAPP'],
            defaultChannels: ['IN_APP', 'EMAIL'],
            enabledChannels: ['IN_APP', 'EMAIL'],
            customized: false,
          },
          {
            event: 'ticket.internal_note',
            label: 'Nota interna',
            description: 'Nunca vai ao cliente.',
            audience: ['assignee'],
            agentOnly: true,
            channels: ['IN_APP'],
            defaultChannels: ['IN_APP'],
            enabledChannels: ['IN_APP'],
            customized: false,
          },
        ],
      },
    ],
    ...overrides,
  }
}

function renderTab() {
  return renderWithQuery(
    <SdSettingsProvider
      value={{ workspaceId: WS, canEdit: false, config: undefined }}
    >
      <SdNotificationsTab />
    </SdSettingsProvider>,
  )
}

describe('SD_SETTINGS_TABS', () => {
  it('registra a aba Notificações antes da de IA', () => {
    const ids = SD_SETTINGS_TABS.map((tab) => tab.id)
    expect(ids).toContain('notifications')
    expect(ids.indexOf('notifications')).toBeLessThan(ids.indexOf('ai'))
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'notifications')
    expect(tab?.label).toBe('Notificações')
    expect(tab?.component).toBe(SdNotificationsTab)
    // Preferência do usuário: sem aviso de "modo leitura" para não-admins.
    expect(tab?.personal).toBe(true)
    expect(
      SD_SETTINGS_TABS.filter((item) => item.personal).map((item) => item.id),
    ).toEqual(['notifications'])
  })
})

describe('sdCellKey / sdCellChecked / sdVisibleChannels', () => {
  const row = prefs().groups[0].events[0]

  it('monta a chave da célula', () => {
    expect(sdCellKey('ticket.message', 'EMAIL')).toBe('ticket.message|EMAIL')
  })

  it('o rascunho local vence o estado do servidor', () => {
    const empty = new Map<string, boolean>()
    expect(sdCellChecked(row, 'EMAIL', empty)).toBe(true)
    expect(sdCellChecked(row, 'WHATSAPP', empty)).toBe(false)

    const draft = new Map([
      ['ticket.message|EMAIL', false],
      ['ticket.message|WHATSAPP', true],
    ])
    expect(sdCellChecked(row, 'EMAIL', draft)).toBe(false)
    expect(sdCellChecked(row, 'WHATSAPP', draft)).toBe(true)
  })

  it('esconde o WhatsApp sem conexão ativa', () => {
    expect(sdVisibleChannels(undefined).map((c) => c.id)).toEqual([
      'IN_APP',
      'EMAIL',
      'WHATSAPP',
    ])
    expect(sdVisibleChannels(prefs()).map((c) => c.id)).toEqual([
      'IN_APP',
      'EMAIL',
    ])
    expect(
      sdVisibleChannels(prefs({ whatsappAvailable: true })).map((c) => c.id),
    ).toEqual(['IN_APP', 'EMAIL', 'WHATSAPP'])
  })
})

describe('<SdNotificationsTab />', () => {
  it('mostra a matriz com os canais marcados e avisa sobre o WhatsApp', async () => {
    mockFetch([{ match: URL, data: prefs() }])
    renderTab()

    expect(await screen.findByText('Conversas')).toBeTruthy()
    expect(screen.getByText('Nova mensagem no chamado')).toBeTruthy()
    expect(
      screen.getByText(/O canal WhatsApp aparece aqui quando/),
    ).toBeTruthy()

    const inApp = screen.getByLabelText('Nova mensagem no chamado — No app')
    expect(
      inApp.getAttribute('aria-checked') ?? inApp.dataset.checked,
    ).toBeTruthy()
    // Nota interna não oferece e-mail: a célula vira um traço.
    expect(screen.queryByLabelText('Nota interna — E-mail')).toBeNull()
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('salva só as células alteradas e limpa o rascunho', async () => {
    const spy = mockFetch([
      { match: URL, data: prefs() },
      { method: 'PUT', match: URL, data: prefs() },
    ])
    renderTab()

    const email = await screen.findByLabelText(
      'Nova mensagem no chamado — E-mail',
    )
    fireEvent.click(email)

    const save = screen.getByRole('button', { name: 'Salvar' })
    await waitFor(() => expect(save).toHaveProperty('disabled', false))
    fireEvent.click(save)

    await waitFor(() =>
      expect(fetchBody(spy, URL, 'PUT')).toEqual({
        items: [{ event: 'ticket.message', channel: 'EMAIL', enabled: false }],
      }),
    )
    await waitFor(() => expect(save).toHaveProperty('disabled', true))
  })

  it('restaura os padrões com DELETE', async () => {
    const spy = mockFetch([
      { match: URL, data: prefs() },
      { method: 'DELETE', match: URL, data: prefs() },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Restaurar padrões' }),
    )
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([, init]) => (init?.method ?? 'GET') === 'DELETE'),
      ).toBe(true),
    )
  })

  it('esconde o aviso do WhatsApp quando há conexão ativa', async () => {
    mockFetch([{ match: URL, data: prefs({ whatsappAvailable: true }) }])
    renderTab()
    expect(await screen.findByText('Conversas')).toBeTruthy()
    expect(
      screen.queryByText(/O canal WhatsApp aparece aqui quando/),
    ).toBeNull()
    expect(
      screen.getByLabelText('Nova mensagem no chamado — WhatsApp'),
    ).toBeTruthy()
  })

  it('avisa quando não há nada para configurar', async () => {
    mockFetch([{ match: URL, data: prefs({ groups: [] }) }])
    renderTab()
    expect(
      await screen.findByText(
        /Nenhuma notificação disponível para o seu perfil/,
      ),
    ).toBeTruthy()
  })

  it('mostra o erro de carregamento', async () => {
    mockFetch([{ match: URL, status: 500, error: 'Falhou aqui' }])
    renderWithQuery(<SdNotificationsMatrix workspaceId={WS} />)
    expect(await screen.findByText('Falhou aqui')).toBeTruthy()
  })
})
