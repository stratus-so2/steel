import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CookieConsentProvider } from '@/app/_components/user/cookie-consent/provider'
import type { CookieConsent } from '@/lib/cookie-consent/types'
import { mockFetch } from '@/src/__tests__/component-utils'
import SettingsPage from '../page'

const auth = vi.hoisted(() => ({
  useSession: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: {
    useSession: auth.useSession,
    signOut: auth.signOut,
    twoFactor: { enable: auth.enable, disable: auth.disable },
  },
}))

const PROFILE = {
  deletionScheduledAt: null,
  acceptedTermsAt: '2026-01-10T12:00:00.000Z',
  acceptedPrivacyAt: null,
}

function renderPage({
  twoFactorEnabled = false,
  consent = null as CookieConsent,
  profile = PROFILE as Record<string, unknown>,
} = {}) {
  auth.useSession.mockReturnValue({
    data: { user: { twoFactorEnabled } },
    isPending: false,
  })
  const spy = mockFetch([
    { method: 'GET', match: '/api/users/me', data: profile },
  ])
  render(
    <CookieConsentProvider initial={consent} isAuthenticated={false}>
      <SettingsPage />
    </CookieConsentProvider>,
  )
  return spy
}

function twoFactorSwitch() {
  return screen.getAllByRole('switch')[0]
}

describe('<SettingsPage /> two-factor', () => {
  beforeEach(() => {
    auth.enable.mockReset()
    auth.disable.mockReset()
  })

  it('reflects the current 2FA state', () => {
    renderPage({ twoFactorEnabled: true })
    expect(screen.getByText('Ativa')).toBeTruthy()
  })

  it('requires the password before enabling 2FA', async () => {
    renderPage()
    expect(screen.getByText('Inativa')).toBeTruthy()

    fireEvent.click(twoFactorSwitch())
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar 2FA' }))

    expect(
      await screen.findByText('Informe sua senha para continuar'),
    ).toBeTruthy()
    expect(auth.enable).not.toHaveBeenCalled()
  })

  it('enables 2FA and shows the one-time backup codes', async () => {
    auth.enable.mockResolvedValue({
      data: { backupCodes: ['aaaa-1111', 'bbbb-2222'] },
      error: null,
    })
    renderPage()

    fireEvent.click(twoFactorSwitch())
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'minha-senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ativar 2FA' }))

    expect(await screen.findByText('Códigos de backup')).toBeTruthy()
    expect(screen.getByText('aaaa-1111')).toBeTruthy()
    expect(screen.getByText('bbbb-2222')).toBeTruthy()
    expect(auth.enable).toHaveBeenCalledWith({ password: 'minha-senha' })
    // Password form closes after success.
    expect(screen.queryByRole('button', { name: 'Ativar 2FA' })).toBeNull()
  })

  it('shows the error and keeps the form open when disabling fails', async () => {
    auth.disable.mockResolvedValue({
      data: null,
      error: { message: 'Senha incorreta' },
    })
    renderPage({ twoFactorEnabled: true })

    fireEvent.click(twoFactorSwitch())
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'errada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Desativar 2FA' }))

    expect(await screen.findByText('Senha incorreta')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Desativar 2FA' })).toBeTruthy()
  })

  it('cancelling closes the password form', async () => {
    renderPage()
    fireEvent.click(twoFactorSwitch())
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByPlaceholderText('••••••')).toBeNull()
  })
})

describe('<SettingsPage /> privacy', () => {
  it('shows consent dates and pending legal acceptances', async () => {
    renderPage()
    expect(
      screen.getByText(
        'Você ainda não decidiu sobre o uso de cookies de análise.',
      ),
    ).toBeTruthy()
    const terms = new Date(PROFILE.acceptedTermsAt).toLocaleDateString('pt-BR')
    expect(await screen.findByText(`Aceito em ${terms}`)).toBeTruthy()
    expect(screen.getByText('Pendente de aceite')).toBeTruthy()
  })

  it('toggles analytics cookie consent', async () => {
    renderPage({ consent: 'rejected' })
    expect(
      screen.getByText('Recusados. Nenhum tracker de análise é carregado.'),
    ).toBeTruthy()

    fireEvent.click(screen.getAllByRole('switch')[1])

    expect(
      await screen.findByText('Aceitos. Você pode revogar a qualquer momento.'),
    ).toBeTruthy()
  })
})

describe('<SettingsPage /> account deletion', () => {
  it('asks for confirmation before scheduling deletion', async () => {
    const spy = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    expect(
      screen.getByRole('button', { name: 'Confirmar exclusão' }),
    ).toBeTruthy()
    expect(spy.mock.calls.some(([, i]) => i?.method === 'DELETE')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.getByRole('button', { name: 'Excluir conta' })).toBeTruthy()
  })

  it('shows a fallback error when scheduling deletion fails', async () => {
    renderPage()
    const spy = mockFetch([
      { method: 'DELETE', match: '/api/users/me', status: 500 },
      { method: 'GET', match: '/api/users/me', data: PROFILE },
    ])

    fireEvent.click(screen.getByRole('button', { name: 'Excluir conta' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))

    expect(
      await screen.findByText('Não foi possível agendar a exclusão'),
    ).toBeTruthy()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalled()
  })

  it('lets the user cancel a scheduled deletion', async () => {
    renderPage({
      profile: { ...PROFILE, deletionScheduledAt: '2026-10-01T12:00:00.000Z' },
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

  // Regression: the page used to read `json.error.message`, but the API error
  // envelope (`errorResponse` in utils/http-response.ts) puts `message` at
  // the top level, so only the generic fallback was ever shown.
  it('shows the API error message when deletion is refused', async () => {
    renderPage()
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

    await screen.findByText(
      'Transfira a titularidade do workspace antes',
      {},
      {
        timeout: 500,
      },
    )
  })
})
