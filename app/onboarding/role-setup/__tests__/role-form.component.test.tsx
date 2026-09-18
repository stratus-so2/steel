import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RoleForm } from '../role-form'

const actions = vi.hoisted(() => ({ saveRoleSetup: vi.fn() }))
vi.mock('../actions', () => ({ saveRoleSetup: actions.saveRoleSetup }))

function lastFormData(): FormData {
  const call = actions.saveRoleSetup.mock.calls.at(-1)
  if (!call) throw new Error('saveRoleSetup was not called')
  return call[1] as FormData
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continuar' }) as HTMLButtonElement
}

describe('<RoleForm /> (onboarding)', () => {
  it('lists every role and keeps "Continuar" disabled until one is picked', () => {
    render(<RoleForm />)

    for (const label of [
      'Product Manager',
      'Engineering Manager',
      'Designer',
      'Developer',
      'Fundador / Executivo',
      'Operations Manager',
      'Outro',
    ]) {
      expect(screen.getByText(label)).toBeTruthy()
    }
    expect(continueButton().disabled).toBe(true)
    // Skipping is always possible.
    expect(
      (
        screen.getByRole('button', {
          name: 'Pular esta etapa',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false)
  })

  it('styles the hint with the muted foreground token', () => {
    render(<RoleForm />)
    expect(screen.getByText('Selecione uma opção').className).toBe(
      'text-sm text-muted-foreground',
    )
  })

  it('submits the selected role with the continue intent', async () => {
    actions.saveRoleSetup.mockResolvedValue({ ok: true })
    render(<RoleForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Designer' }))
    expect(continueButton().disabled).toBe(false)
    fireEvent.click(continueButton())

    await waitFor(() => expect(actions.saveRoleSetup).toHaveBeenCalled())
    const fd = lastFormData()
    expect(fd.get('role')).toBe('DESIGNER')
    expect(fd.get('intent')).toBe('continue')
  })

  it('lets the user switch selection before continuing', async () => {
    actions.saveRoleSetup.mockResolvedValue({ ok: true })
    render(<RoleForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Designer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Developer' }))
    fireEvent.click(continueButton())

    await waitFor(() => expect(actions.saveRoleSetup).toHaveBeenCalled())
    expect(lastFormData().get('role')).toBe('DEVELOPER')
  })

  it('skips without a role', async () => {
    actions.saveRoleSetup.mockResolvedValue({ ok: true })
    render(<RoleForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Pular esta etapa' }))

    await waitFor(() => expect(actions.saveRoleSetup).toHaveBeenCalled())
    const fd = lastFormData()
    expect(fd.get('intent')).toBe('skip')
    expect(fd.get('role')).toBe('')
  })

  it('renders the server action error as an alert', async () => {
    actions.saveRoleSetup.mockResolvedValue({
      ok: false,
      error: 'Não foi possível salvar',
    })
    render(<RoleForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Outro' }))
    fireEvent.click(continueButton())

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Não foi possível salvar',
    )
  })
})
