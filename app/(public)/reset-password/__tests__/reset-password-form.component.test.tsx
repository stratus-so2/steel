import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResetPasswordForm } from '../reset-password-form'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

const auth = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: { resetPassword: auth.resetPassword, signOut: auth.signOut },
}))

function fillAndSubmit(password: string, confirm: string) {
  const [pw, confirmInput] = screen.getAllByPlaceholderText('••••••••')
  fireEvent.change(pw, { target: { value: password } })
  fireEvent.change(confirmInput, { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: 'Redefinir senha' }))
}

describe('<ResetPasswordForm />', () => {
  it('shows the invalid-link state when no token is present', () => {
    render(<ResetPasswordForm />)

    expect(screen.getByText('Link inválido ou expirado.')).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Solicitar novo link' })
        .getAttribute('href'),
    ).toBe('/forget-password')
    expect(screen.queryByRole('button', { name: 'Redefinir senha' })).toBeNull()
  })

  it('shows the invalid-link state when better-auth flagged the link', () => {
    render(<ResetPasswordForm token='tok' linkError='INVALID_TOKEN' />)
    expect(screen.getByText('Link inválido ou expirado.')).toBeTruthy()
  })

  it('validates minimum length and matching confirmation in pt-BR', async () => {
    render(<ResetPasswordForm token='tok' />)
    fillAndSubmit('curta', 'outra')

    expect(
      await screen.findByText('A senha deve ter ao menos 8 caracteres'),
    ).toBeTruthy()
    expect(screen.getByText('As senhas não coincidem')).toBeTruthy()
    expect(auth.resetPassword).not.toHaveBeenCalled()
  })

  it('flags only the mismatch when the password is long enough', async () => {
    render(<ResetPasswordForm token='tok' />)
    fillAndSubmit('novaSenha123', 'novaSenha124')

    expect(await screen.findByText('As senhas não coincidem')).toBeTruthy()
    expect(
      screen.queryByText('A senha deve ter ao menos 8 caracteres'),
    ).toBeNull()
  })

  it('resets, signs out every session and sends the user to sign-in', async () => {
    auth.resetPassword.mockResolvedValue({ data: {}, error: null })
    auth.signOut.mockResolvedValue({})
    render(<ResetPasswordForm token='tok-123' />)
    fillAndSubmit('novaSenha123', 'novaSenha123')

    await waitFor(() => expect(push).toHaveBeenCalledWith('/sign-in'))
    expect(auth.resetPassword).toHaveBeenCalledWith({
      newPassword: 'novaSenha123',
      token: 'tok-123',
    })
    expect(auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('shows the expired-link fallback error and does not redirect', async () => {
    auth.resetPassword.mockResolvedValue({ data: null, error: {} })
    render(<ResetPasswordForm token='tok' />)
    fillAndSubmit('novaSenha123', 'novaSenha123')

    expect(
      await screen.findByText(
        'Não foi possível redefinir a senha. O link pode ter expirado.',
      ),
    ).toBeTruthy()
    expect(auth.signOut).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
