import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { NotificationInbox } from '../notification-inbox'

vi.setConfig({ testTimeout: 20_000 })

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))
const push = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const BASE = '/api/workspaces/ws_1/notifications'

const list = {
  unreadCount: 1,
  items: [
    {
      id: 'n1',
      workspaceId: 'ws_1',
      kind: 'WHATSAPP_NEGATIVE_SENTIMENT',
      title: 'Sentimento negativo: Maria',
      body: 'A conversa com Maria está com média de sentimento -0,50.',
      href: '/clinica/zap?conversa=c1',
      read: false,
      createdAt: new Date().toISOString(),
    },
  ],
}

describe('<NotificationInbox />', () => {
  it('lists notifications and opens one, marking it as read', async () => {
    const fetchSpy = mockFetch([
      { method: 'POST', match: `${BASE}/read`, data: { updated: 1 } },
      { match: BASE, data: list },
    ])
    renderWithQuery(<NotificationInbox workspaceId='ws_1' />)

    fireEvent.click(await screen.findByText('Sentimento negativo: Maria'))

    expect(push).toHaveBeenCalledWith('/clinica/zap?conversa=c1')
    await waitFor(() =>
      expect(fetchBody(fetchSpy, `${BASE}/read`)).toEqual({ ids: ['n1'] }),
    )
  })

  it('marks everything as read', async () => {
    const fetchSpy = mockFetch([
      { method: 'POST', match: `${BASE}/read`, data: { updated: 1 } },
      { match: BASE, data: list },
    ])
    renderWithQuery(<NotificationInbox workspaceId='ws_1' />)
    await screen.findByText('1 não lida')

    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar todas como lidas' }),
    )
    await waitFor(() => expect(fetchBody(fetchSpy, `${BASE}/read`)).toEqual({}))
  })

  it('shows the empty state', async () => {
    mockFetch([{ match: BASE, data: { unreadCount: 0, items: [] } }])
    renderWithQuery(<NotificationInbox workspaceId='ws_1' />)
    expect(
      await screen.findByText('Nenhuma notificação por aqui.'),
    ).toBeTruthy()
  })
})
