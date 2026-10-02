import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TotpStatus } from '@/src/hooks/use-two-factor-totp'
import { UserModalSecurityTotp } from '../user-modal-security-totp'

const auth = vi.hoisted(() => ({
  enable: vi.fn(),
  getTotpUri: vi.fn(),
}))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: {
    twoFactor: { enable: auth.enable, getTotpUri: auth.getTotpUri },
  },
}))

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

const hint = vi.hoisted(() => ({
  rememberTwoFactorMethod: vi.fn(),
  lastTwoFactorMethod: vi.fn(() => null),
}))
vi.mock('@/src/lib/two-factor-method-hint', () => hint)

const totp = vi.hoisted(() => ({
  status: { twoFactorEnabled: true, totpEnabled: false, hasSecret: true },
  confirm: vi.fn(),
  disable: vi.fn(),
}))
vi.mock('@/src/hooks/use-two-factor-totp', () => ({
  useTwoFactorTotp: () => ({ data: totp.status, isPending: false }),
  useConfirmTwoFactorTotp: () => ({
    mutateAsync: totp.confirm,
    isPending: false,
  }),
  useDisableTwoFactorTotp: () => ({
    mutateAsync: totp.disable,
    isPending: false,
  }),
}))

function wrap(node: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>{node}</QueryClientProvider>,
  )
}

function renderPanel(
  overrides: Partial<TotpStatus> = {},
  canUsePassword = true,
) {
  totp.status = {
    twoFactorEnabled: true,
    totpEnabled: false,
    hasSecret: true,
    ...overrides,
  }
  const onSessionChanged = vi.fn()
  wrap(
    <UserModalSecurityTotp
      canUsePassword={canUsePassword}
      twoFactorEnabled={totp.status.twoFactorEnabled}
      onSessionChanged={onSessionChanged}
    />,
  )
  return { onSessionChanged }
}

const TOTP_URI =
  'otpauth://totp/Steel:ana@empresa.com?secret=JBSWY3DPEHPK3PXP&issuer=Steel'

beforeEach(() => {
  vi.clearAllMocks()
  auth.getTotpUri.mockResolvedValue({
    data: { totpURI: TOTP_URI },
    error: null,
  })
  auth.enable.mockResolvedValue({
    data: { totpURI: TOTP_URI, backupCodes: ['aaaa1111', 'bbbb2222'] },
    error: null,
  })
})

describe('<UserModalSecurityTotp />', () => {
  it('asks for the password before showing anything', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))

    expect(
      await screen.findByText('Senha para ativar o aplicativo'),
    ).toBeTruthy()
    expect(auth.getTotpUri).not.toHaveBeenCalled()
  })

  it('refuses to continue with an empty password', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Continuar' }))

    expect(
      await screen.findByText('Informe sua senha para continuar'),
    ).toBeTruthy()
    expect(auth.getTotpUri).not.toHaveBeenCalled()
  })

  it('reuses the existing secret when the account already has 2FA', async () => {
    renderPanel({ hasSecret: true })
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() => expect(auth.getTotpUri).toHaveBeenCalled())
    // Chamar `enable()` de novo rotacionaria os códigos de recuperação que a
    // pessoa já guardou.
    expect(auth.enable).not.toHaveBeenCalled()
    expect(
      await screen.findByLabelText('QR code para o aplicativo autenticador'),
    ).toBeTruthy()
  })

  it('creates a secret and shows the recovery codes when there is none', async () => {
    const { onSessionChanged } = renderPanel({
      hasSecret: false,
      twoFactorEnabled: false,
    })
    totp.confirm.mockResolvedValue({
      twoFactorEnabled: true,
      totpEnabled: true,
      hasSecret: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Ativar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    await waitFor(() =>
      expect(auth.enable).toHaveBeenCalledWith({
        password: 'senha',
      }),
    )
    await waitFor(() => expect(onSessionChanged).toHaveBeenCalled())

    fireEvent.change(await screen.findByPlaceholderText('000000'), {
      target: { value: ' 123456 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }))

    expect(await screen.findByText('Códigos de recuperação')).toBeTruthy()
    expect(screen.getByText('aaaa1111')).toBeTruthy()
    expect(totp.confirm).toHaveBeenCalledWith('123456')
    expect(hint.rememberTwoFactorMethod).toHaveBeenCalledWith('totp')
  })

  it('shows the manual key for apps that cannot scan', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('JBSWY3DPEHPK3PXP')).toBeTruthy()
  })

  it('refuses an empty code and never calls the confirm endpoint', async () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmar código' }),
    )

    expect(
      await screen.findByText('Informe o código do aplicativo'),
    ).toBeTruthy()
    expect(totp.confirm).not.toHaveBeenCalled()
  })

  it('keeps the user on the QR step when the code is refused', async () => {
    renderPanel()
    totp.confirm.mockRejectedValue(new Error('Código inválido ou expirado'))

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    fireEvent.change(await screen.findByPlaceholderText('000000'), {
      target: { value: '000000' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar código' }))

    expect(await screen.findByText('Código inválido ou expirado')).toBeTruthy()
    expect(hint.rememberTwoFactorMethod).not.toHaveBeenCalled()
  })

  it('surfaces a pt-BR message when better-auth refuses the password', async () => {
    renderPanel()
    auth.getTotpUri.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_PASSWORD' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'errada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('Senha inválida')).toBeTruthy()
  })

  it('requires the password to switch the authenticator off', async () => {
    renderPanel({ totpEnabled: true })
    totp.disable.mockResolvedValue({
      twoFactorEnabled: true,
      totpEnabled: false,
      hasSecret: true,
    })

    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))
    expect(
      await screen.findByText('Senha para desligar o aplicativo'),
    ).toBeTruthy()

    // Sem senha não sai do lugar.
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))
    expect(
      await screen.findByText('Informe sua senha para continuar'),
    ).toBeTruthy()
    expect(totp.disable).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: 'senha' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))

    await waitFor(() => expect(totp.disable).toHaveBeenCalledWith('senha'))
    expect(hint.rememberTwoFactorMethod).toHaveBeenCalledWith('otp')
  })

  it('reports why the server refused to switch the authenticator off', async () => {
    renderPanel({ totpEnabled: true })
    totp.disable.mockRejectedValue(new Error('Senha inválida'))

    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))
    fireEvent.change(await screen.findByPlaceholderText('••••••'), {
      target: { value: 'errada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Desligar' }))

    expect(await screen.findByText('Senha inválida')).toBeTruthy()
    expect(hint.rememberTwoFactorMethod).not.toHaveBeenCalled()
  })

  it('is unavailable to an account with no password', () => {
    renderPanel({}, false)
    expect(
      (screen.getByRole('button', { name: 'Cadastrar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(
      screen.getByText(
        'Defina uma senha antes de cadastrar um aplicativo autenticador.',
      ),
    ).toBeTruthy()
  })
})
