import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SignInForm } from '../sign-in-form'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

const auth = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  sendOtp: vi.fn(),
  verifyOtp: vi.fn(),
  verifyBackupCode: vi.fn(),
  signInSocial: vi.fn(),
}))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: {
    signIn: { email: auth.signInEmail, social: auth.signInSocial },
    twoFactor: {
      sendOtp: auth.sendOtp,
      verifyOtp: auth.verifyOtp,
      verifyBackupCode: auth.verifyBackupCode,
    },
  },
}))

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('nome@empresa.com'), {
    target: { value: email },
  })
  fireEvent.change(screen.getByPlaceholderText('••••••'), {
    target: { value: password },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))
}

describe('<SignInForm />', () => {
  beforeEach(() => {
    auth.sendOtp.mockResolvedValue({ data: {}, error: null })
  })

  it('shows pt-BR required-field errors and does not call the API', async () => {
    render(<SignInForm />)
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }))

    expect(await screen.findByText('E-mail é obrigatório')).toBeTruthy()
    expect(screen.getByText('Senha é obrigatória')).toBeTruthy()
    expect(auth.signInEmail).not.toHaveBeenCalled()
  })

  it('signs in and redirects to the requested destination', async () => {
    auth.signInEmail.mockResolvedValue({ data: { user: {} }, error: null })
    render(<SignInForm redirectTo='/acme' />)

    fillAndSubmit('ana@empresa.com', 'segredo123')

    await waitFor(() => expect(push).toHaveBeenCalledWith('/acme'))
    expect(auth.signInEmail).toHaveBeenCalledWith({
      email: 'ana@empresa.com',
      password: 'segredo123',
    })
  })

  it('renders the fallback error when credentials are rejected', async () => {
    auth.signInEmail.mockResolvedValue({ data: null, error: {} })
    render(<SignInForm />)

    fillAndSubmit('ana@empresa.com', 'errada')

    expect(await screen.findByText('E-mail ou senha inválidos')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    // Form stays usable after the failure.
    expect(
      (screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
  })

  it('moves to the OTP step when two-factor is required', async () => {
    auth.signInEmail.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    })
    render(<SignInForm />)

    fillAndSubmit('ana@empresa.com', 'segredo123')

    expect(await screen.findByText('Confirme seu e-mail')).toBeTruthy()
    expect(screen.getByText('ana@empresa.com')).toBeTruthy()
    expect(auth.sendOtp).toHaveBeenCalledTimes(1)
    expect(push).not.toHaveBeenCalled()
  })

  it('validates and verifies a backup code', async () => {
    auth.signInEmail.mockResolvedValue({
      data: { twoFactorRedirect: true },
      error: null,
    })
    auth.verifyBackupCode.mockResolvedValue({ data: {}, error: null })
    render(<SignInForm />)
    fillAndSubmit('ana@empresa.com', 'segredo123')

    fireEvent.click(
      await screen.findByRole('button', { name: /usar um código de backup/i }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Verificar código' }))
    expect(await screen.findByText('Informe um código de backup')).toBeTruthy()
    expect(auth.verifyBackupCode).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('xxxxxxxx'), {
      target: { value: '  abcd1234 ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Verificar código' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'))
    expect(auth.verifyBackupCode).toHaveBeenCalledWith({ code: 'abcd1234' })
  })

  it('links to sign-up preserving the redirect target', () => {
    render(<SignInForm redirectTo='/convite?x=1' />)
    const link = screen.getByRole('link', { name: 'Cadastre-se' })
    expect(link.getAttribute('href')).toBe(
      `/sign-up?redirect=${encodeURIComponent('/convite?x=1')}`,
    )
  })
})
