import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { AcceptInvitation } from '../accept-invitation'

// Stable router object: the component lists `router` as an effect
// dependency, exactly like Next's (stable) app router instance.
const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock('next/navigation', () => ({ useRouter: () => router }))

describe('<AcceptInvitation />', () => {
  it('accepts the token once and redirects to the workspace', async () => {
    const fetchSpy = mockFetch([
      {
        method: 'POST',
        match: '/api/invitations/accept',
        data: { workspaceId: 'ws_1', slug: 'acme' },
      },
    ])
    renderWithQuery(<AcceptInvitation token='tok-abc' />)

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/acme'))
    expect(fetchBody(fetchSpy, '/api/invitations/accept')).toEqual({
      token: 'tok-abc',
    })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Convite aceito! Redirecionando…')).toBeTruthy()
  })

  it('shows the pending message while validating', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/api/invitations/accept',
        handler: () => new Promise(() => {}),
      },
    ])
    renderWithQuery(<AcceptInvitation token='tok' />)

    expect(await screen.findByText('Validando convite…')).toBeTruthy()
  })

  it('renders the API error and does not redirect', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/api/invitations/accept',
        status: 410,
        error: 'Convite expirado',
      },
    ])
    renderWithQuery(<AcceptInvitation token='tok' />)

    expect(
      await screen.findByText('Não foi possível aceitar o convite'),
    ).toBeTruthy()
    expect(screen.getByText('Convite expirado')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
  })
})
