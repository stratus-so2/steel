import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdMailboxDTO } from '@/types/sd-mailbox'
import {
  formatSdMailboxSync,
  parseSdSenderList,
  SdMailSettingsTab,
} from '../mail-tab'
import { SdSettingsProvider } from '../sd-settings-kit'
import { SD_SETTINGS_TABS } from '../settings-tabs'

const WS = 'ws-1'
const MAILBOXES = `/api/workspaces/${WS}/servicedesk/mailboxes`

const mailbox = (overrides: Partial<SdMailboxDTO> = {}): SdMailboxDTO => ({
  id: 'mb-1',
  workspaceId: WS,
  name: 'Suporte',
  address: 'suporte@empresa.com.br',
  status: 'ACTIVE',
  statusError: null,
  imapHost: 'imap.empresa.com.br',
  imapPort: 993,
  imapSecure: true,
  imapUser: 'suporte',
  folder: 'INBOX',
  processedFolder: null,
  smtpHost: null,
  smtpPort: null,
  smtpSecure: true,
  smtpUser: null,
  smtpConfigured: false,
  defaultType: 'INCIDENT',
  defaultDepartmentId: null,
  defaultCategoryId: null,
  defaultPriorityId: null,
  allowedSenders: [],
  blockedSenders: [],
  createUnknownContacts: true,
  sendAcknowledgement: true,
  lastSyncAt: null,
  lastSeenUid: null,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  ...overrides,
})

const config = {
  departments: [
    {
      id: 'dep-1',
      name: 'Infra',
      children: [{ id: 'dep-2', name: 'Redes' }],
    },
  ],
  categories: [{ id: 'cat-1', name: 'Hardware' }],
  priorities: [{ id: 'pri-1', name: 'Alta' }],
} as unknown as SdConfigBootstrapDTO

function renderTab(canEdit = true, bootstrap = config) {
  return renderWithQuery(
    <SdSettingsProvider value={{ workspaceId: WS, canEdit, config: bootstrap }}>
      <SdMailSettingsTab />
    </SdSettingsProvider>,
  )
}

beforeEach(() => {
  // Nenhum teste depende de relógio ou clipboard aqui.
})

describe('SD_SETTINGS_TABS', () => {
  it('registers the mail tab right before the WhatsApp one', () => {
    const ids = SD_SETTINGS_TABS.map((tab) => tab.id)
    expect(ids).toContain('mail')
    expect(ids.indexOf('mail')).toBeLessThan(ids.indexOf('whatsapp'))
    const tab = SD_SETTINGS_TABS.find((item) => item.id === 'mail')
    expect(tab?.label).toBe('E-mail')
    expect(tab?.component).toBe(SdMailSettingsTab)
  })
})

describe('parseSdSenderList', () => {
  it('splits on newlines, commas and semicolons, lowercasing and deduping', () => {
    expect(
      parseSdSenderList(' Ana@X.com \n@cliente.com.br, ana@x.com;  '),
    ).toEqual(['ana@x.com', '@cliente.com.br'])
    expect(parseSdSenderList('')).toEqual([])
  })
})

describe('formatSdMailboxSync', () => {
  it('says "nunca" with no read yet and formats the date otherwise', () => {
    expect(formatSdMailboxSync(null)).toBe('nunca')
    expect(formatSdMailboxSync('2026-10-01T12:00:00.000Z')).toMatch(
      /\d{2}\/\d{2}/,
    )
  })
})

describe('<SdMailSettingsTab />', () => {
  it('invites the admin to add the first mailbox', async () => {
    mockFetch([{ match: MAILBOXES, data: [] }])
    renderTab()
    expect(await screen.findByText(/Nenhuma caixa cadastrada/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adicionar caixa' })).toBeTruthy()
  })

  it('surfaces the error of the mailbox query', async () => {
    mockFetch([{ match: MAILBOXES, status: 403, error: 'Só administradores' }])
    renderTab()
    expect(await screen.findByText('Só administradores')).toBeTruthy()
  })

  it('shows the mailbox with its state, the last read and the SMTP badge', async () => {
    mockFetch([
      {
        match: MAILBOXES,
        data: [
          mailbox({
            smtpConfigured: true,
            lastSyncAt: '2026-10-01T12:00:00.000Z',
          }),
        ],
      },
    ])
    renderTab()

    expect(await screen.findByText('Suporte')).toBeTruthy()
    expect(screen.getByText('Lendo')).toBeTruthy()
    expect(screen.getByText('SMTP próprio')).toBeTruthy()
    expect(screen.getByText(/última[\s\S]*leitura/)).toBeTruthy()
  })

  it('reports the error of the last read', async () => {
    mockFetch([
      {
        match: MAILBOXES,
        data: [mailbox({ status: 'ERROR', statusError: 'Login recusado' })],
      },
    ])
    renderTab()
    expect(await screen.findByText('Login recusado')).toBeTruthy()
    expect(screen.getByText('Com erro')).toBeTruthy()
  })

  it('creates a mailbox from the dialog, with the SMTP fields', async () => {
    const spy = mockFetch([
      { method: 'POST', match: MAILBOXES, data: mailbox() },
      { match: MAILBOXES, data: [] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Adicionar caixa' }),
    )
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Central' },
    })
    fireEvent.change(screen.getByLabelText('Endereço'), {
      target: { value: 'Central@Empresa.com.br' },
    })
    fireEvent.change(screen.getByLabelText('Servidor IMAP'), {
      target: { value: 'imap.empresa.com.br' },
    })
    fireEvent.change(screen.getByLabelText('Usuário'), {
      target: { value: 'central' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'segredo' },
    })
    fireEvent.change(screen.getByLabelText('Servidor SMTP'), {
      target: { value: 'smtp.empresa.com.br' },
    })
    fireEvent.change(await screen.findByLabelText('Senha SMTP'), {
      target: { value: 'smtp-segredo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar caixa' }))

    await waitFor(() =>
      expect(fetchBody(spy, MAILBOXES)).toMatchObject({
        name: 'Central',
        address: 'central@empresa.com.br',
        imapHost: 'imap.empresa.com.br',
        imapPort: 993,
        imapUser: 'central',
        imapPassword: 'segredo',
        folder: 'INBOX',
        processedFolder: null,
        smtpHost: 'smtp.empresa.com.br',
        smtpPort: 465,
        smtpUser: 'central',
        smtpPassword: 'smtp-segredo',
        defaultType: 'INCIDENT',
        createUnknownContacts: true,
        sendAcknowledgement: true,
      }),
    )
  })

  it('sends no SMTP when the dialog leaves it blank', async () => {
    const spy = mockFetch([
      { method: 'POST', match: MAILBOXES, data: mailbox() },
      { match: MAILBOXES, data: [] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Adicionar caixa' }),
    )
    fireEvent.change(await screen.findByLabelText('Nome'), {
      target: { value: 'Central' },
    })
    fireEvent.change(screen.getByLabelText('Endereço'), {
      target: { value: 'central@empresa.com.br' },
    })
    fireEvent.change(screen.getByLabelText('Servidor IMAP'), {
      target: { value: 'imap.empresa.com.br' },
    })
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'segredo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar caixa' }))

    await waitFor(() =>
      expect(fetchBody(spy, MAILBOXES)).toMatchObject({
        imapUser: 'central@empresa.com.br',
        smtpHost: null,
        smtpPort: null,
        smtpUser: null,
        smtpPassword: null,
      }),
    )
  })

  it('tests the connection and reports how many messages the folder has', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${MAILBOXES}/mb-1/test`,
        data: {
          connected: true,
          status: 'ACTIVE',
          error: null,
          messages: 5,
          smtp: null,
        },
      },
      { match: MAILBOXES, data: [mailbox()] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Testar conexão' }),
    )
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) => String(url).endsWith('/test')),
      ).toBe(true),
    )
  })

  it('reads the mailbox on demand', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${MAILBOXES}/mb-1/sync`,
        data: { fetched: 2, opened: 1, appended: 1, skipped: 0, failed: 0 },
      },
      { match: MAILBOXES, data: [mailbox()] },
    ])
    renderTab()

    fireEvent.click(await screen.findByRole('button', { name: 'Ler agora' }))
    await waitFor(() =>
      expect(
        spy.mock.calls.some(([url]) => String(url).endsWith('/sync')),
      ).toBe(true),
    )
  })

  it('pauses and resumes the reading', async () => {
    const spy = mockFetch([
      { method: 'PATCH', match: `${MAILBOXES}/mb-1`, data: mailbox() },
      { match: MAILBOXES, data: [mailbox()] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Pausar leitura' }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, `${MAILBOXES}/mb-1`, 'PATCH')).toEqual({
        status: 'PAUSED',
      }),
    )
  })

  it('offers to resume a paused mailbox', async () => {
    const spy = mockFetch([
      { method: 'PATCH', match: `${MAILBOXES}/mb-1`, data: mailbox() },
      { match: MAILBOXES, data: [mailbox({ status: 'PAUSED' })] },
    ])
    renderTab()

    expect(await screen.findByText('Pausada')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Retomar leitura' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${MAILBOXES}/mb-1`, 'PATCH')).toEqual({
        status: 'ACTIVE',
      }),
    )
  })

  it('saves the sender lists', async () => {
    const spy = mockFetch([
      { method: 'PATCH', match: `${MAILBOXES}/mb-1`, data: mailbox() },
      { match: MAILBOXES, data: [mailbox()] },
    ])
    renderTab()

    fireEvent.change(
      await screen.findByLabelText('Remetentes aceitos de Suporte'),
      { target: { value: '@cliente.com.br\nana@x.com' } },
    )
    fireEvent.change(
      screen.getByLabelText('Remetentes bloqueados de Suporte'),
      {
        target: { value: 'spam@x.com' },
      },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar listas' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${MAILBOXES}/mb-1`, 'PATCH')).toEqual({
        allowedSenders: ['@cliente.com.br', 'ana@x.com'],
        blockedSenders: ['spam@x.com'],
      }),
    )
  })

  it('toggles the unknown-contact and acknowledgement switches', async () => {
    const spy = mockFetch([
      { method: 'PATCH', match: `${MAILBOXES}/mb-1`, data: mailbox() },
      { match: MAILBOXES, data: [mailbox()] },
    ])
    renderTab()

    fireEvent.click(
      await screen.findByRole('switch', {
        name: 'Criar contato para remetente desconhecido',
      }),
    )
    await waitFor(() =>
      expect(fetchBody(spy, `${MAILBOXES}/mb-1`, 'PATCH')).toEqual({
        createUnknownContacts: false,
      }),
    )
  })

  it('removes the mailbox after confirming', async () => {
    const spy = mockFetch([
      { method: 'DELETE', match: `${MAILBOXES}/mb-1`, data: null },
      { match: MAILBOXES, data: [mailbox()] },
    ])
    renderTab()

    fireEvent.click(await screen.findByRole('button', { name: 'Remover' }))
    const confirm = await screen.findByRole('button', { name: /Remover/ })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/mb-1') &&
            (init as RequestInit | undefined)?.method === 'DELETE',
        ),
      ).toBe(true),
    )
  })

  it('hides every action in read-only mode', async () => {
    mockFetch([{ match: MAILBOXES, data: [mailbox()] }])
    renderTab(false)

    expect(await screen.findByText(/modo leitura/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Testar conexão' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Adicionar caixa' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Salvar listas' })).toBeNull()
  })

  it('renders the defaults without the configuration bootstrap', async () => {
    mockFetch([{ match: MAILBOXES, data: [mailbox()] }])
    renderTab(true, undefined as unknown as SdConfigBootstrapDTO)
    expect(await screen.findByText('Suporte')).toBeTruthy()
    expect(screen.getByText(/O caminho de um e-mail/)).toBeTruthy()
  })
})
