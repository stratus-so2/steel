import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { ProfileForm } from '../profile-form'

const actions = vi.hoisted(() => ({ saveProfileSetup: vi.fn() }))
vi.mock('../actions', () => ({ saveProfileSetup: actions.saveProfileSetup }))

const auth = vi.hoisted(() => ({ enable: vi.fn(), disable: vi.fn() }))
vi.mock('@/src/lib/auth-client', () => ({
  authClient: { twoFactor: { enable: auth.enable, disable: auth.disable } },
}))

const DEFAULT_PROPS = {
  name: 'Ana Souza',
  image: null,
  twoFactorEnabled: false,
  hasPassword: true,
}

function renderForm(props: Partial<typeof DEFAULT_PROPS> = {}) {
  return render(<ProfileForm {...DEFAULT_PROPS} {...props} />)
}

function nameInput() {
  return screen.getByPlaceholderText('Seu nome') as HTMLInputElement
}
function continueButton() {
  return screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
}
function open2FA() {
  fireEvent.click(screen.getByText('Verificação em duas etapas'))
}

describe('<ProfileForm /> (onboarding)', () => {
  it('prefills the name, shows initials and requires ≥ 2 characters', () => {
    renderForm()

    expect(nameInput().value).toBe('Ana Souza')
    expect(screen.getByText('AS')).toBeTruthy()
    expect(continueButton().disabled).toBe(false)

    fireEvent.change(nameInput(), { target: { value: ' A ' } })
    expect(continueButton().disabled).toBe(true)
  })

  it('submits the name and the (default-on) marketing consent', async () => {
    actions.saveProfileSetup.mockResolvedValue({ ok: true })
    renderForm()

    fireEvent.change(nameInput(), { target: { value: 'Ana Maria' } })
    fireEvent.click(continueButton())

    await waitFor(() => expect(actions.saveProfileSetup).toHaveBeenCalled())
    const fd = actions.saveProfileSetup.mock.calls[0][1] as FormData
    expect(fd.get('name')).toBe('Ana Maria')
    expect(fd.get('marketingConsent')).toBeTruthy()
  })

  it('shows the server action error', async () => {
    actions.saveProfileSetup.mockResolvedValue({
      ok: false,
      error: 'Nome inválido',
    })
    renderForm()
    fireEvent.click(continueButton())

    expect((await screen.findByRole('alert')).textContent).toBe('Nome inválido')
  })

  it('uploads a new avatar through the API', async () => {
    const fetchSpy = mockFetch([
      {
        method: 'POST',
        match: '/api/users/me/avatar',
        data: { url: 'https://cdn.test/a.png' },
      },
    ])
    const { container } = renderForm()
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File(['x'], 'a.png', { type: 'image/png' })

    fireEvent.change(input, { target: { files: [file] } })

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const body = fetchSpy.mock.calls[0][1]?.body as FormData
    expect(body.get('avatars')).toBeInstanceOf(File)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('reports a failed avatar upload', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/api/users/me/avatar',
        status: 413,
        error: 'Arquivo muito grande',
      },
    ])
    const { container } = renderForm()
    const input = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement

    fireEvent.change(input, {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })

    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('explains that 2FA needs a password when the account has none', () => {
    renderForm({ hasPassword: false })
    open2FA()

    expect(
      screen.getByText('Disponível apenas para contas com senha definida.'),
    ).toBeTruthy()
    expect(
      screen.getByRole('switch').getAttribute('aria-disabled') === 'true' ||
        screen.getByRole('switch').hasAttribute('data-disabled'),
    ).toBe(true)
  })

  it('requires the password to enable 2FA and shows backup codes', async () => {
    auth.enable.mockResolvedValue({
      data: { backupCodes: ['code-1', 'code-2'] },
      error: null,
    })
    renderForm()
    open2FA()
    expect(screen.getByText('Inativa')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch'))
    fireEvent.click(screen.getByRole('button', { name: 'Ativar 2FA' }))
    expect(
      await screen.findByText('Informe sua senha para continuar'),
    ).toBeTruthy()
    expect(auth.enable).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: 'segredo123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ativar 2FA' }))

    expect(await screen.findByText('Códigos de backup')).toBeTruthy()
    expect(screen.getByText('code-1')).toBeTruthy()
    expect(screen.getByText('Ativa')).toBeTruthy()
    expect(auth.enable).toHaveBeenCalledWith({ password: 'segredo123' })
  })

  it('keeps 2FA off and shows the error when enabling fails', async () => {
    auth.enable.mockResolvedValue({ data: null, error: {} })
    renderForm()
    open2FA()
    fireEvent.click(screen.getByRole('switch'))
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: 'errada' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Ativar 2FA' }))

    expect(
      await screen.findByText('Não foi possível ativar a 2FA'),
    ).toBeTruthy()
    expect(screen.getByText('Inativa')).toBeTruthy()
  })

  it('disables 2FA with the password', async () => {
    auth.disable.mockResolvedValue({ data: {}, error: null })
    renderForm({ twoFactorEnabled: true })
    open2FA()
    expect(screen.getByText('Código por e-mail a cada login.')).toBeTruthy()

    fireEvent.click(screen.getByRole('switch'))
    fireEvent.change(screen.getByPlaceholderText('••••••'), {
      target: { value: 'segredo123' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Desativar 2FA' }))

    await waitFor(() => expect(screen.getByText('Inativa')).toBeTruthy())
    expect(auth.disable).toHaveBeenCalledWith({ password: 'segredo123' })
  })

  it('cancelling the 2FA prompt hides the password field', () => {
    renderForm()
    open2FA()
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByText(/Senha para ativar a 2FA/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText(/Senha para ativar a 2FA/)).toBeNull()
  })
})
