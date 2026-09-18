import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmActionDialog } from '../shell/confirm-action-dialog'

function renderDialog(
  props: Partial<Parameters<typeof ConfirmActionDialog>[0]> = {},
) {
  const onConfirm = vi.fn()
  render(
    <ConfirmActionDialog
      open
      onOpenChange={() => {}}
      title='Excluir Acme definitivamente'
      description='Apaga tudo.'
      confirmLabel='Excluir workspace'
      destructive
      requireSlug='acme'
      pending={false}
      onConfirm={onConfirm}
      {...props}
    />,
  )
  return { onConfirm }
}

const confirmButton = () =>
  screen.getByRole('button', { name: 'Excluir workspace' }) as HTMLButtonElement

describe('<ConfirmActionDialog />', () => {
  it('keeps the destructive action disabled until reason and slug match', () => {
    const { onConfirm } = renderDialog()

    expect(confirmButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'encerramento do contrato' },
    })
    expect(confirmButton().disabled).toBe(true)

    const slugInput = screen.getByLabelText(/para confirmar/)
    fireEvent.change(slugInput, { target: { value: 'ACME' } })
    expect(confirmButton().disabled).toBe(true)
    expect(slugInput.getAttribute('aria-invalid')).toBe('true')

    fireEvent.change(slugInput, { target: { value: 'acme' } })
    expect(confirmButton().disabled).toBe(false)

    fireEvent.click(confirmButton())
    expect(onConfirm).toHaveBeenCalledWith({
      reason: 'encerramento do contrato',
      confirmSlug: 'acme',
    })
  })

  it('requires a minimum reason even without slug confirmation', () => {
    renderDialog({ requireSlug: undefined, confirmLabel: 'Suspender' })
    const button = () =>
      screen.getByRole('button', { name: 'Suspender' }) as HTMLButtonElement

    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'abc' },
    })
    expect(button().disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Motivo'), {
      target: { value: 'inadimplência' },
    })
    expect(button().disabled).toBe(false)
  })

  it('shows the pending label and blocks double submits', () => {
    renderDialog({ pending: true, pendingLabel: 'Enfileirando...' })
    const button = screen.getByRole('button', {
      name: 'Enfileirando...',
    }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })
})
