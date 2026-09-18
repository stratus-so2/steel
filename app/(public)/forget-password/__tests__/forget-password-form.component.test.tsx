import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ForgetPasswordForm } from '../forget-password-form'

const auth = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: { requestPasswordReset: auth.requestPasswordReset },
}))

function submitEmail(value: string) {
  fireEvent.change(screen.getByPlaceholderText('nome@empresa.com'), {
    target: { value },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enviar link de redefinição' }),
  )
}

describe('<ForgetPasswordForm />', () => {
  it('requires an e-mail (whitespace-only counts as empty)', async () => {
    render(<ForgetPasswordForm />)
    submitEmail('   ')

    expect(await screen.findByText('E-mail é obrigatório')).toBeTruthy()
    expect(auth.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('requests the reset with a trimmed e-mail and shows a neutral confirmation', async () => {
    auth.requestPasswordReset.mockResolvedValue({ data: {}, error: null })
    render(<ForgetPasswordForm />)
    submitEmail('  ana@empresa.com ')

    expect(await screen.findByText('Verifique seu e-mail.')).toBeTruthy()
    expect(auth.requestPasswordReset).toHaveBeenCalledWith({
      email: 'ana@empresa.com',
      redirectTo: '/reset-password',
    })
    expect(
      screen
        .getByRole('link', { name: 'Voltar para o login' })
        .getAttribute('href'),
    ).toBe('/sign-in')
    // The form is gone — no way to probe other addresses from this screen.
    expect(screen.queryByPlaceholderText('nome@empresa.com')).toBeNull()
  })

  it('shows the API error and keeps the form available', async () => {
    auth.requestPasswordReset.mockResolvedValue({
      data: null,
      error: { message: 'Muitas tentativas' },
    })
    render(<ForgetPasswordForm />)
    submitEmail('ana@empresa.com')

    expect(await screen.findByText('Muitas tentativas')).toBeTruthy()
    expect(screen.queryByText('Verifique seu e-mail.')).toBeNull()
    const button = screen.getByRole('button', {
      name: 'Enviar link de redefinição',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it('uses the pt-BR fallback when the error carries no message', async () => {
    auth.requestPasswordReset.mockResolvedValue({ data: null, error: {} })
    render(<ForgetPasswordForm />)
    submitEmail('ana@empresa.com')

    expect(
      await screen.findByText(
        'Não foi possível enviar o e-mail de redefinição',
      ),
    ).toBeTruthy()
  })

  it('disables the form while the request is in flight', async () => {
    let resolve: (v: unknown) => void = () => {}
    auth.requestPasswordReset.mockReturnValue(
      new Promise((r) => {
        resolve = r
      }),
    )
    render(<ForgetPasswordForm />)
    submitEmail('ana@empresa.com')

    const pending = (await screen.findByRole('button', {
      name: 'Enviando...',
    })) as HTMLButtonElement
    expect(pending.disabled).toBe(true)
    resolve({ data: {}, error: null })
    expect(await screen.findByText('Verifique seu e-mail.')).toBeTruthy()
  })
})
