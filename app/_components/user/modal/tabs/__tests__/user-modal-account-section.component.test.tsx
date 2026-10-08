import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { UserModalAccountSection } from '../user-modal-account-section'

const auth = vi.hoisted(() => ({ signOut: vi.fn() }))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: { signOut: auth.signOut },
}))

const PROFILE = {
  deletionScheduledAt: null,
  acceptedTermsAt: '2026-01-10T12:00:00.000Z',
  acceptedPrivacyAt: null,
}

function renderSection(profile: Record<string, unknown> = PROFILE) {
  const spy = mockFetch([
    { method: 'GET', match: '/api/users/me', data: profile },
  ])
  render(<UserModalAccountSection />)
  return spy
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<UserModalAccountSection /> legal acceptances', () => {
  it('shows consent dates and pending acceptances', async () => {
    renderSection()
    const terms = new Date(PROFILE.acceptedTermsAt).toLocaleDateString('pt-BR')
    expect(await screen.findByText(`Aceito em ${terms}`)).toBeTruthy()
    expect(screen.getByText('Pendente de aceite')).toBeTruthy()
  })

  it('shows both dates when accepted', async () => {
    renderSection({
      ...PROFILE,
      acceptedPrivacyAt: '2026-01-11T12:00:00.000Z',
    })
    const privacy = new Date('2026-01-11T12:00:00.000Z').toLocaleDateString(
      'pt-BR',
    )
    expect(await screen.findByText(`Aceita em ${privacy}`)).toBeTruthy()
  })

  it('keeps the defaults when the profile cannot be loaded', async () => {
    const spy = mockFetch([
      { method: 'GET', match: '/api/users/me', status: 500 },
    ])
    render(<UserModalAccountSection />)
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(screen.getAllByText('Pendente de aceite')).toHaveLength(2)
  })

  it('ignores network errors while loading the profile', async () => {
    const spy = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', spy)
    render(<UserModalAccountSection />)
    await waitFor(() => expect(spy).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeTruthy()
  })
})

describe('<UserModalAccountSection /> account deletion', () => {
  it('asks for confirmation before scheduling deletion', () => {
    const spy = renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    expect(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    ).toBeTruthy()
    expect(spy.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeTruthy()
  })

  it('schedules the deletion and signs out', async () => {
    renderSection()
    mockFetch([
      { method: 'DELETE', match: '/api/users/me', data: null },
      { method: 'GET', match: '/api/users/me', data: PROFILE },
    ])
    const location = { href: '' }
    vi.stubGlobal('location', location)

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    await waitFor(() => expect(auth.signOut).toHaveBeenCalled())
    await waitFor(() => expect(location.href).toBe('/'))
    vi.unstubAllGlobals()
  })

  it('shows a fallback error when scheduling deletion fails', async () => {
    renderSection()
    mockFetch([
      { method: 'DELETE', match: '/api/users/me', status: 500 },
      { method: 'GET', match: '/api/users/me', data: PROFILE },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(
      await screen.findByText('Não foi possível agendar a exclusão'),
    ).toBeTruthy()
    expect(auth.signOut).not.toHaveBeenCalled()
  })

  it('shows the API error message when deletion is refused', async () => {
    renderSection()
    mockFetch([
      {
        method: 'DELETE',
        match: '/api/users/me',
        status: 409,
        error: 'Transfira a titularidade do workspace antes',
      },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(
      await screen.findByText('Transfira a titularidade do workspace antes'),
    ).toBeTruthy()
  })

  it('shows network errors when scheduling', async () => {
    renderSection()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Erro X')))

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(await screen.findByText('Erro X')).toBeTruthy()
  })

  it('lets the user cancel a scheduled deletion', async () => {
    renderSection({
      ...PROFILE,
      deletionScheduledAt: '2026-10-01T12:00:00.000Z',
    })

    const cancel = await screen.findByRole('button', {
      name: 'Cancelar exclusão',
    })
    expect(screen.queryByRole('button', { name: 'Excluir conta' })).toBeNull()

    mockFetch([
      { method: 'DELETE', match: '/api/users/me/deletion', data: null },
    ])
    fireEvent.click(cancel)

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Excluir conta' }),
      ).toBeTruthy(),
    )
  })

  it('shows the error when cancelling fails', async () => {
    renderSection({
      ...PROFILE,
      deletionScheduledAt: '2026-10-01T12:00:00.000Z',
    })
    const cancel = await screen.findByRole('button', {
      name: 'Cancelar exclusão',
    })

    mockFetch([
      { method: 'DELETE', match: '/api/users/me/deletion', status: 500 },
    ])
    fireEvent.click(cancel)
    expect(
      await screen.findByText('Não foi possível cancelar a exclusão'),
    ).toBeTruthy()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar exclusão' }))
    expect(await screen.findByText('Erro de rede')).toBeTruthy()
  })
})
