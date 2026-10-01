import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdTicketFollowersDTO } from '@/types/sd-notification'
import { SdFollowButton } from '../sd-follow-button'

const WS = 'ws-1'
const TICKET = 't1'
const URL = `/api/workspaces/${WS}/servicedesk/tickets/${TICKET}/followers`

function follower(userId: string) {
  return {
    userId,
    name: `Nome ${userId}`,
    email: `${userId}@example.com`,
    image: null,
    followedAt: '2026-10-01T12:00:00.000Z',
  }
}

const notFollowing: SdTicketFollowersDTO = { items: [], following: false }
const following: SdTicketFollowersDTO = {
  items: [follower('u1')],
  following: true,
}

function renderButton() {
  return renderWithQuery(<SdFollowButton workspaceId={WS} ticketRef={TICKET} />)
}

/** O botão nasce desabilitado enquanto a lista carrega. */
async function readyButton(name: RegExp) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button).toHaveProperty('disabled', false))
  return button
}

describe('<SdFollowButton />', () => {
  it('oferece "Seguir" para quem não segue', async () => {
    mockFetch([{ match: URL, data: notFollowing }])
    renderButton()
    const button = await screen.findByRole('button', { name: /Seguir/ })
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })

  it('segue com POST e passa a mostrar "Parar de seguir"', async () => {
    const spy = mockFetch([
      { match: URL, data: notFollowing },
      { method: 'POST', match: URL, data: following },
    ])
    renderButton()

    fireEvent.click(await readyButton(/Seguir/))
    await waitFor(() =>
      expect(spy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
        true,
      ),
    )
    const button = await screen.findByRole('button', {
      name: /Parar de seguir/,
    })
    expect(button.getAttribute('aria-pressed')).toBe('true')
  })

  it('para de seguir com DELETE', async () => {
    const spy = mockFetch([
      { match: URL, data: following },
      { method: 'DELETE', match: URL, data: notFollowing },
    ])
    renderButton()

    fireEvent.click(await readyButton(/Parar de seguir/))
    await waitFor(() =>
      expect(spy.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
        true,
      ),
    )
    expect(await screen.findByRole('button', { name: /Seguir/ })).toBeTruthy()
  })

  it('mostra quantos outros seguem o chamado', async () => {
    mockFetch([
      {
        match: URL,
        data: {
          items: [follower('u1'), follower('u2'), follower('u3')],
          following: true,
        },
      },
    ])
    renderButton()
    expect(await screen.findByText('+2')).toBeTruthy()
  })

  it('não conta um "+0" quando só o próprio usuário segue', async () => {
    mockFetch([{ match: URL, data: following }])
    renderButton()
    await screen.findByRole('button', { name: /Parar de seguir/ })
    expect(screen.queryByText('+0')).toBeNull()
  })

  it('desabilita enquanto carrega e segue clicável depois de um erro', async () => {
    mockFetch([
      { match: URL, data: notFollowing },
      { method: 'POST', match: URL, status: 500, error: 'Falhou' },
    ])
    renderButton()
    const button = await readyButton(/Seguir/)
    fireEvent.click(button)
    await waitFor(() => expect(button).toHaveProperty('disabled', false))
    expect(button.getAttribute('aria-pressed')).toBe('false')
  })
})
