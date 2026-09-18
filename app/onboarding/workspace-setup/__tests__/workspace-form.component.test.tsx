import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspaceForm } from '../workspace-form'

const actions = vi.hoisted(() => ({ createOnboardingWorkspace: vi.fn() }))
vi.mock('../actions', () => ({
  createOnboardingWorkspace: actions.createOnboardingWorkspace,
}))

function nameInput() {
  return screen.getByPlaceholderText(
    'Algo familiar e reconhecível é sempre melhor.',
  ) as HTMLInputElement
}
function slugInput() {
  return screen.getByPlaceholderText(
    'Digite ou cole um URL',
  ) as HTMLInputElement
}
function submitButton() {
  return screen.getByRole('button', {
    name: 'Criar workspace',
  }) as HTMLButtonElement
}

describe('<WorkspaceForm /> (onboarding)', () => {
  it('derives the slug from the name while the slug is untouched', () => {
    render(<WorkspaceForm />)

    fireEvent.change(nameInput(), { target: { value: '  Minha Empresa  X ' } })
    expect(slugInput().value).toBe('minha-empresa-x')
  })

  it('drops characters outside [a-z0-9-] (accents included)', () => {
    render(<WorkspaceForm />)

    fireEvent.change(nameInput(), { target: { value: 'Ação & Cia!' } })
    expect(slugInput().value).toBe('ao-cia')
  })

  it('stops syncing the slug once the user edits it manually', () => {
    render(<WorkspaceForm />)

    fireEvent.change(nameInput(), { target: { value: 'Acme' } })
    fireEvent.change(slugInput(), { target: { value: 'Meu Slug' } })
    expect(slugInput().value).toBe('meu-slug')

    fireEvent.change(nameInput(), { target: { value: 'Acme Labs' } })
    expect(slugInput().value).toBe('meu-slug')
  })

  it('requires a name and slug of at least 2 characters', () => {
    render(<WorkspaceForm />)
    expect(submitButton().disabled).toBe(true)

    fireEvent.change(nameInput(), { target: { value: 'A' } })
    expect(submitButton().disabled).toBe(true)

    fireEvent.change(nameInput(), { target: { value: 'Ac' } })
    expect(submitButton().disabled).toBe(false)

    // A name made only of symbols yields an empty slug → still invalid.
    fireEvent.change(nameInput(), { target: { value: '!!!' } })
    expect(submitButton().disabled).toBe(true)
  })

  it('submits name, slug and the chosen team size', async () => {
    actions.createOnboardingWorkspace.mockResolvedValue({ ok: true })
    render(<WorkspaceForm />)

    fireEvent.change(nameInput(), { target: { value: 'Acme Labs' } })
    fireEvent.click(screen.getByRole('button', { name: '11-50' }))
    fireEvent.click(submitButton())

    await waitFor(() =>
      expect(actions.createOnboardingWorkspace).toHaveBeenCalled(),
    )
    const fd = actions.createOnboardingWorkspace.mock.calls[0][1] as FormData
    expect(fd.get('name')).toBe('Acme Labs')
    expect(fd.get('slug')).toBe('acme-labs')
    expect(fd.get('teamSize')).toBe('11-50')
  })

  it('shows the server action error (e.g. slug taken)', async () => {
    actions.createOnboardingWorkspace.mockResolvedValue({
      ok: false,
      error: 'Este URL já está em uso',
    })
    render(<WorkspaceForm />)

    fireEvent.change(nameInput(), { target: { value: 'Acme' } })
    fireEvent.click(submitButton())

    expect(await screen.findByText('Este URL já está em uso')).toBeTruthy()
  })
})
