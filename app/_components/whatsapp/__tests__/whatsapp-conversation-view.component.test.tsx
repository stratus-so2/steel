import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  type FetchRoute,
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { WhatsAppConversationDTO } from '@/types/whatsapp-conversation'
import type { WhatsAppMessageDTO } from '@/types/whatsapp-message'
import { WhatsappConversationView } from '../whatsapp-conversation-view'

// Dialog/select flows render Base UI portals and wait on several fetches;
// the project default (5s) is too tight when the suite runs under load.
vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))
// `useUser` only fires once Better Auth reports a session.
vi.mock('@/src/lib/auth-client', () => ({
  authClient: { useSession: () => ({ data: { user: { id: 'u_1' } } }) },
}))

// The composer has its own suite; here we only care about what the view
// hands it (disabled state and reply target).
vi.mock('../whatsapp-composer', () => ({
  WhatsappComposer: (props: {
    disabled?: boolean
    replyTarget: WhatsAppMessageDTO | null
    contactName: string
  }) => (
    <div
      data-testid='composer'
      data-disabled={String(Boolean(props.disabled))}
      data-reply={props.replyTarget?.id ?? ''}
      data-contact={props.contactName}
    />
  ),
}))
vi.mock('../whatsapp-video-call-dialog', () => ({
  WhatsappVideoCallDialog: (props: { open: boolean; roomName: string }) =>
    props.open ? <div data-testid='video-call'>{props.roomName}</div> : null,
}))

const API = '/api/workspaces/ws_1/whatsapp'
const MESSAGES = `${API}/conversations/cv_1/messages`

function conversation(
  overrides: Partial<WhatsAppConversationDTO> = {},
): WhatsAppConversationDTO {
  return {
    id: 'cv_1',
    workspaceId: 'ws_1',
    connectionId: 'conn_1',
    contactId: 'c1',
    contactName: 'Ana Souza',
    contactWaId: '5511911111111',
    contactAvatarUrl: null,
    status: 'IN_PROGRESS',
    assignedUserId: 'u_2',
    aiActive: false,
    aiHandoff: false,
    unreadCount: 0,
    avgSentimentScore: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    pinned: false,
    archived: false,
    contactSince: '2025-03-10T12:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function message(overrides: Partial<WhatsAppMessageDTO>): WhatsAppMessageDTO {
  return {
    id: 'm1',
    workspaceId: 'ws_1',
    conversationId: 'cv_1',
    direction: 'IN',
    type: 'TEXT',
    text: 'Olá!',
    mediaUrl: null,
    status: 'DELIVERED',
    senderUserId: null,
    sentByAi: false,
    replyToMessageId: null,
    reactionEmoji: null,
    reactedByContact: null,
    contactPayload: null,
    createdAt: '2026-01-01T12:00:00.000Z',
    ...overrides,
  }
}

const thread = [
  message({ id: 'm1', text: 'Preciso de ajuda com meu pedido' }),
  message({
    id: 'm2',
    direction: 'OUT',
    text: 'Claro! Qual o número?',
    sentByAi: true,
    status: 'READ',
    reactionEmoji: '👍',
  }),
  message({
    id: 'm3',
    direction: 'OUT',
    text: 'Não chegou',
    status: 'FAILED',
  }),
  message({
    id: 'm4',
    type: 'CONTACT',
    text: null,
    contactPayload: { name: 'Carlos Lima', waId: '5531977776666' },
  }),
]

const members = [
  { id: 'u_1', name: 'Eu Mesmo', email: 'eu@x.com', image: null },
  { id: 'u_2', name: 'Beatriz', email: 'bia@x.com', image: null },
]

function setup(extra: FetchRoute[] = [], messages = thread) {
  return mockFetch([
    ...extra,
    { match: MESSAGES, data: messages },
    { match: `${API}/assignable-members`, data: members },
    { match: '/api/users/me', data: { id: 'u_1', name: 'Eu Mesmo' } },
  ])
}

describe('<WhatsappConversationView />', () => {
  it('renders the contact header and the message thread', async () => {
    setup()
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
      />,
    )

    expect(screen.getByText('Ana Souza')).toBeTruthy()
    expect(
      await screen.findByText('Preciso de ajuda com meu pedido'),
    ).toBeTruthy()
    expect(screen.getByText('Claro! Qual o número?')).toBeTruthy()
    // AI-sent marker, reaction and failed delivery are surfaced.
    expect(screen.getByText('IA')).toBeTruthy()
    expect(screen.getByText('👍')).toBeTruthy()
    expect(screen.getByText('Falhou')).toBeTruthy()
    expect(screen.getByText('Carlos Lima')).toBeTruthy()
    expect(screen.getByTestId('composer').dataset.disabled).toBe('false')
    expect(screen.getByTestId('composer').dataset.contact).toBe('Ana Souza')
  })

  it('marks the conversation as read only when it has unread messages', async () => {
    const fetchSpy = setup([
      { method: 'POST', match: `${API}/conversations/cv_1/read`, data: {} },
    ])
    const { unmount } = renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation({ unreadCount: 2 })}
      />,
    )
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/read')),
      ).toBe(true),
    )
    unmount()

    const second = setup()
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation({ unreadCount: 0 })}
      />,
    )
    await screen.findByText('Preciso de ajuda com meu pedido')
    expect(
      second.mock.calls.some(([url]) => String(url).endsWith('/read')),
    ).toBe(false)
  })

  it('locks the composer while the AI is handling and lets the agent take over', async () => {
    const fetchSpy = setup([
      { method: 'PATCH', match: `${API}/conversations/cv_1/ai`, data: {} },
    ])
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation({ aiActive: true })}
      />,
    )

    expect(screen.getByTestId('composer').dataset.disabled).toBe('true')
    expect(screen.queryByText(/transferida para atendimento humano/)).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Remover do atendimento da IA' }),
    )
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(
          ([url, init]) =>
            init?.method === 'PATCH' &&
            String(url).endsWith('/conversations/cv_1/ai'),
        ),
      ).toBe(true),
    )
  })

  it('shows the handoff banner and resumes the AI', async () => {
    const fetchSpy = setup([
      {
        method: 'PATCH',
        match: `${API}/conversations/cv_1/ai/resume`,
        data: {},
      },
    ])
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation({ aiHandoff: true })}
      />,
    )

    expect(screen.queryByText(/A IA está atendendo/)).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: 'Retomar atendimento da IA' }),
    )
    await waitFor(() =>
      expect(
        fetchSpy.mock.calls.some(([url]) => String(url).endsWith('/ai/resume')),
      ).toBe(true),
    )
  })

  it('transfers the conversation to another member', async () => {
    const fetchSpy = setup([
      {
        method: 'PATCH',
        match: `${API}/conversations/cv_1/assign`,
        data: conversation(),
      },
    ])
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
      />,
    )
    await screen.findByText('Preciso de ajuda com meu pedido')

    fireEvent.click(screen.getByRole('button', { name: 'Transferir conversa' }))
    const menu = await screen.findByRole('menu')
    const me = await within(menu).findByRole('menuitem', {
      name: 'Eu Mesmo (você)',
    })
    // The current assignee cannot be picked again.
    expect(
      within(menu)
        .getByRole('menuitem', { name: 'Beatriz' })
        .getAttribute('aria-disabled'),
    ).toBe('true')

    fireEvent.click(me)
    await waitFor(() =>
      expect(
        fetchBody(fetchSpy, `${API}/conversations/cv_1/assign`, 'PATCH'),
      ).toEqual({ assignedUserId: 'u_1' }),
    )
  })

  it('shows a placeholder when nobody can receive the conversation', async () => {
    mockFetch([
      { match: MESSAGES, data: [] },
      { match: `${API}/assignable-members`, data: [] },
      { match: '/api/users/me', data: { id: 'u_1', name: 'Eu' } },
    ])
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Transferir conversa' }))
    const menu = await screen.findByRole('menu')
    expect(
      await within(menu).findByText('Nenhum membro disponível'),
    ).toBeTruthy()
  })

  it('starts a conversation with a shared contact card', async () => {
    const started = conversation({ id: 'cv_new', contactName: 'Carlos Lima' })
    const fetchSpy = setup([
      {
        method: 'POST',
        match: `${API}/contacts/find-or-create`,
        data: { id: 'c9' },
      },
      { method: 'POST', match: `${API}/conversations`, data: started },
    ])
    const onSelectConversation = vi.fn()
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
        onSelectConversation={onSelectConversation}
      />,
    )

    fireEvent.click(
      await screen.findByRole('button', { name: /Iniciar conversa/ }),
    )
    await waitFor(() =>
      expect(onSelectConversation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cv_new' }),
      ),
    )
    expect(fetchBody(fetchSpy, `${API}/contacts/find-or-create`)).toEqual({
      name: 'Carlos Lima',
      waId: '5531977776666',
    })
    expect(fetchBody(fetchSpy, /\/whatsapp\/conversations$/)).toEqual({
      contactId: 'c9',
      connectionId: 'conn_1',
    })
  })

  it('sends a video call link and opens the call', async () => {
    const fetchSpy = setup([{ method: 'POST', match: MESSAGES, data: {} }])
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar chamada de vídeo' }),
    )
    expect(await screen.findByTestId('video-call')).toBeTruthy()
    expect(fetchBody(fetchSpy, MESSAGES).text).toContain(
      'https://meet.jit.si/steel-cv_1',
    )
  })

  it('reports an error and keeps the call closed when the link fails to send', async () => {
    setup([{ method: 'POST', match: MESSAGES, status: 502, error: 'falhou' }])
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
      />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Iniciar chamada de vídeo' }),
    )
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Erro ao iniciar chamada'),
    )
    expect(screen.queryByTestId('video-call')).toBeNull()
  })

  it('sets the reply target from the message context menu', async () => {
    setup()
    renderWithQuery(
      <WhatsappConversationView
        workspaceId='ws_1'
        conversation={conversation()}
      />,
    )
    const bubble = await screen.findByText('Preciso de ajuda com meu pedido')
    fireEvent.contextMenu(bubble)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Responder' }))

    await waitFor(() =>
      expect(screen.getByTestId('composer').dataset.reply).toBe('m1'),
    )
  })
})
