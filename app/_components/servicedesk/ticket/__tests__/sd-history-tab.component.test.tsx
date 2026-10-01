import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type {
  SdTicketAttachmentDTO,
  SdTicketMessageDTO,
} from '@/types/sd-ticket-message'
import {
  filterSdCannedResponses,
  sdMentionQuery,
  sdResolveMentions,
} from '../history/sd-message-composer'
import { SdTicketHistoryTab } from '../tabs/history-tab'
import {
  AGENTS,
  stubEventSource,
  TAB_URL,
  TICKET_ID,
  tabProps,
  user,
} from './sd-ticket-tab-fixtures'

vi.mock('@/components/ui/emoji-picker', () => ({
  EmojiPicker: ({
    onEmojiSelect,
  }: {
    onEmojiSelect: (e: { emoji: string }) => void
  }) => (
    <button type='button' onClick={() => onEmojiSelect({ emoji: '🎉' })}>
      emoji-🎉
    </button>
  ),
  EmojiPickerSearch: () => null,
  EmojiPickerContent: () => null,
  EmojiPickerFooter: () => null,
}))

function attachment(
  overrides: Partial<SdTicketAttachmentDTO> = {},
): SdTicketAttachmentDTO {
  return {
    id: 'a1',
    ticketId: TICKET_ID,
    messageId: 'm1',
    kind: 'DOCUMENT',
    fileName: 'laudo.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    uploadedBy: null,
    url: `${TAB_URL}/attachments/a1`,
    createdAt: '2026-09-21T12:00:00.000Z',
    ...overrides,
  }
}

function message(
  overrides: Partial<SdTicketMessageDTO> = {},
): SdTicketMessageDTO {
  return {
    id: 'm1',
    ticketId: TICKET_ID,
    authorKind: 'REQUESTER',
    author: user('u-req', 'Rui Solicitante'),
    contact: null,
    visibility: 'PUBLIC',
    channel: 'PLATFORM',
    body: 'O servidor caiu de novo',
    attachments: [],
    mentionedUserIds: [],
    editedAt: null,
    createdAt: '2026-09-21T12:00:00.000Z',
    canEdit: false,
    editableUntil: null,
    ...overrides,
  }
}

const MESSAGES = [
  message(),
  message({
    id: 'm2',
    authorKind: 'AGENT',
    author: user('u-agent', 'Ana Agente'),
    body: 'Verificando os logs',
    visibility: 'INTERNAL',
    canEdit: true,
    editedAt: '2026-09-21T12:05:00.000Z',
  }),
  message({
    id: 'm3',
    authorKind: 'SYSTEM',
    author: null,
    body: 'Chamado atribuído automaticamente',
  }),
  message({
    id: 'm4',
    authorKind: 'AI',
    author: null,
    body: 'Sugestão: reinicie o serviço',
    attachments: [
      attachment(),
      attachment({
        id: 'a2',
        kind: 'IMAGE',
        fileName: 'print.png',
        mimeType: 'image/png',
      }),
      attachment({ id: 'a3', kind: 'VIDEO', fileName: 'v.mp4' }),
      attachment({ id: 'a4', kind: 'AUDIO', fileName: 'a.ogg' }),
    ],
  }),
]

const CANNED = [
  {
    id: 'c1',
    title: 'Reinício',
    shortcut: 'reinicio',
    body: 'Reiniciamos o serviço, pode testar?',
    departmentId: null,
    createdById: 'u1',
    createdByName: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
]

function routes(extra: Parameters<typeof mockFetch>[0] = []) {
  return mockFetch([
    ...extra,
    {
      match: `${TAB_URL}/messages?`,
      data: { items: MESSAGES, nextBefore: 'm0' },
    },
    { match: '/servicedesk/config', data: { cannedResponses: CANNED } },
    { match: '/servicedesk/agents', data: AGENTS },
    {
      method: 'POST',
      match: `${TAB_URL}/messages`,
      handler: () => message({ id: 'new' }),
    },
    {
      method: 'POST',
      match: `${TAB_URL}/attachments`,
      data: attachment({ id: 'up1', messageId: null, fileName: 'foto.png' }),
    },
    { method: 'PATCH', match: `${TAB_URL}/messages/m2`, data: MESSAGES[1] },
    { method: 'DELETE', match: `${TAB_URL}/messages/m2`, data: null },
  ])
}

beforeEach(() => {
  stubEventSource()
})

describe('composer helpers', () => {
  it('filters canned responses and detects mentions', () => {
    expect(filterSdCannedResponses(CANNED, 'rein')).toHaveLength(1)
    expect(filterSdCannedResponses(CANNED, 'xyz')).toHaveLength(0)
    expect(filterSdCannedResponses(CANNED, '')).toHaveLength(1)
    expect(sdMentionQuery('oi @An')).toBe('An')
    expect(sdMentionQuery('oi @')).toBe('')
    expect(sdMentionQuery('email@x')).toBeNull()
  })

  it('keeps only the picked mentions still present in the text', () => {
    const picked = [
      { id: 'a', name: 'Ana Agente' },
      { id: 'b', name: 'Bruno' },
      { id: 'a', name: 'Ana Agente' },
    ]
    expect(sdResolveMentions('Veja @Ana Agente e @Bruno', picked)).toEqual([
      'a',
      'b',
    ])
    // A menção apagada do texto não vai para o servidor.
    expect(sdResolveMentions('Veja @Bruno', picked)).toEqual(['b'])
    expect(sdResolveMentions('sem menção', picked)).toEqual([])
    expect(sdResolveMentions('@Ana Agente', [])).toEqual([])
  })
})

describe('SdTicketHistoryTab — agent', () => {
  it('renders every author kind, internal notes and attachments', async () => {
    routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)

    expect(await screen.findByText('O servidor caiu de novo')).toBeTruthy()
    expect(screen.getAllByText('Nota interna').length).toBeGreaterThan(0)
    expect(screen.getByText('(editado)')).toBeTruthy()
    expect(screen.getByTestId('sd-message-system').textContent).toContain(
      'Chamado atribuído automaticamente',
    )
    expect(screen.getByText('IA')).toBeTruthy()
    expect(
      screen.getByText('laudo.pdf').closest('a')?.getAttribute('href'),
    ).toBe(`${TAB_URL}/attachments/a1?download=1`)
    expect(screen.getByRole('button', { name: 'Ver print.png' })).toBeTruthy()
    expect(document.querySelector('video')).not.toBeNull()
    expect(document.querySelector('audio')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: 'Carregar anteriores' }),
    ).toBeTruthy()
  })

  it('sends an internal note with an uploaded attachment', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    await screen.findByText('O servidor caiu de novo')

    fireEvent.click(screen.getByRole('radio', { name: 'Nota interna' }))
    const file = new File(['x'], 'foto.png', { type: 'image/png' })
    fireEvent.change(screen.getByTestId('sd-composer-file'), {
      target: { files: [file] },
    })
    expect(await screen.findByText('foto.png')).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('enviando…')).toBeNull())

    fireEvent.change(screen.getByLabelText('Mensagem'), {
      target: { value: 'Logs anexados' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))

    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/messages`)).toEqual({
        body: 'Logs anexados',
        visibility: 'INTERNAL',
        attachmentIds: ['up1'],
        mentionedUserIds: [],
      }),
    )
    await waitFor(() =>
      expect(
        (screen.getByLabelText('Mensagem') as HTMLTextAreaElement).value,
      ).toBe(''),
    )
  })

  it('rejects files over 25 MB on the client', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    await screen.findByText('O servidor caiu de novo')
    const big = new File(['x'], 'grande.zip')
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 })
    fireEvent.change(screen.getByTestId('sd-composer-file'), {
      target: { files: [big] },
    })
    expect(screen.queryByText('grande.zip')).toBeNull()
    expect(fetchBody(spy, `${TAB_URL}/attachments`)).toBeUndefined()
  })

  it('inserts a canned response with the "/" shortcut and an emoji', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    await screen.findByText('O servidor caiu de novo')
    const box = screen.getByLabelText('Mensagem')

    fireEvent.change(box, { target: { value: '/rein' } })
    fireEvent.click(
      await screen.findByRole('option', { name: /reinicio · Reinício/ }),
    )
    expect((box as HTMLTextAreaElement).value).toBe(
      'Reiniciamos o serviço, pode testar?',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Emoji' }))
    fireEvent.click(await screen.findByText('emoji-🎉'))
    expect((box as HTMLTextAreaElement).value).toBe(
      'Reiniciamos o serviço, pode testar?🎉',
    )

    fireEvent.keyDown(box, { key: 'Enter' })
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/messages`)).toMatchObject({
        visibility: 'PUBLIC',
        attachmentIds: [],
      }),
    )
  })

  it('mentions an agent with "@" and sends the mentioned ids', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    await screen.findByText('O servidor caiu de novo')
    const box = screen.getByLabelText('Mensagem')
    fireEvent.change(box, { target: { value: 'Veja @An' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Agente' }))
    expect((box as HTMLTextAreaElement).value).toBe('Veja @Ana Agente ')

    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/messages`)).toMatchObject({
        body: 'Veja @Ana Agente',
        mentionedUserIds: ['u-agent'],
      }),
    )
  })

  it('drops a mention the agent erased before sending', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    await screen.findByText('O servidor caiu de novo')
    const box = screen.getByLabelText('Mensagem')
    fireEvent.change(box, { target: { value: 'Veja @An' } })
    fireEvent.click(await screen.findByRole('option', { name: 'Ana Agente' }))
    fireEvent.change(box, { target: { value: 'Deixa, resolvi sozinho' } })

    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/messages`)).toMatchObject({
        mentionedUserIds: [],
      }),
    )
  })

  it('edits and deletes an own message', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    await screen.findByText('Verificando os logs')

    fireEvent.click(screen.getByRole('button', { name: 'Editar mensagem' }))
    const editor = screen.getAllByLabelText('Editar mensagem')[0] as HTMLElement
    fireEvent.change(editor, { target: { value: 'Logs verificados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/messages/m2`, 'PATCH')).toEqual({
        body: 'Logs verificados',
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Excluir mensagem' }))
    await waitFor(() =>
      expect(
        spy.mock.calls.some(
          ([url, init]) =>
            String(url).endsWith('/messages/m2') && init?.method === 'DELETE',
        ),
      ).toBe(true),
    )
  })
})

describe('SdTicketHistoryTab — requester / closed', () => {
  it('hides the internal toggle and canned responses for requesters', async () => {
    const spy = routes()
    renderWithQuery(<SdTicketHistoryTab {...tabProps('requester')} />)
    await screen.findByText('O servidor caiu de novo')
    expect(screen.queryByRole('radio', { name: 'Nota interna' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Respostas prontas' }),
    ).toBeNull()

    fireEvent.change(screen.getByLabelText('Mensagem'), {
      target: { value: 'Obrigado' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
    await waitFor(() =>
      expect(fetchBody(spy, `${TAB_URL}/messages`)).toEqual({
        body: 'Obrigado',
        visibility: 'PUBLIC',
        attachmentIds: [],
        mentionedUserIds: [],
      }),
    )
    expect(
      spy.mock.calls.some(([url]) => String(url).includes('/config')),
    ).toBe(false)
  })

  it('blocks the composer on a closed ticket', async () => {
    routes()
    renderWithQuery(
      <SdTicketHistoryTab
        {...tabProps('agent', {
          phase: {
            id: 'p9',
            name: 'Fechado',
            color: null,
            category: 'CLOSED',
            completionPercent: 100,
            position: 9,
            wipLimit: 0,
          },
        })}
      />,
    )
    expect(await screen.findByText(/Chamado encerrado/)).toBeTruthy()
    expect(screen.queryByLabelText('Mensagem')).toBeNull()
  })

  it('shows the empty state', async () => {
    mockFetch([
      { match: `${TAB_URL}/messages?`, data: { items: [], nextBefore: null } },
      { match: '/servicedesk/config', data: { cannedResponses: [] } },
      { match: '/servicedesk/agents', data: [] },
    ])
    renderWithQuery(<SdTicketHistoryTab {...tabProps('agent')} />)
    expect(await screen.findByText(/Nenhuma mensagem ainda/)).toBeTruthy()
  })
})
