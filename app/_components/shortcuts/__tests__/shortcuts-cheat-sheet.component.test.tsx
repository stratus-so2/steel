import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShortcutHint, ShortcutKbd } from '../shortcut-kbd'
import { ShortcutsCheatSheet } from '../shortcuts-cheat-sheet'
import { ShortcutsProvider, useShortcut } from '../shortcuts-provider'

function press(key: string, init: KeyboardEventInit = {}, target?: Element) {
  act(() => {
    ;(target ?? window).dispatchEvent(
      new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
      }),
    )
  })
}

function Screen() {
  useShortcut('sd.ticket.reply', vi.fn())
  useShortcut('sd.ticket.note', vi.fn())
  return <input aria-label='Campo' />
}

function renderSheet(props: { singleKeyEnabled?: boolean } = {}) {
  return render(
    <ShortcutsProvider {...props}>
      <Screen />
      <ShortcutsCheatSheet />
    </ShortcutsProvider>,
  )
}

describe('ShortcutsCheatSheet', () => {
  it('opens on "?" with what is on this screen, searchable', async () => {
    renderSheet()
    press('?', { shiftKey: true })
    const dialog = await screen.findByRole('dialog', {
      name: 'Atalhos do teclado',
    })
    expect(within(dialog).getByText('Responder')).toBeTruthy()
    expect(within(dialog).getByText('Nota interna')).toBeTruthy()
    // The sheet's own keys are mounted too.
    expect(
      within(dialog).getByText('Mostrar os atalhos do teclado'),
    ).toBeTruthy()
    expect(within(dialog).queryByText('Ir para o CRM')).toBeNull()

    fireEvent.change(within(dialog).getByLabelText('Buscar atalho'), {
      target: { value: 'nota' },
    })
    expect(within(dialog).queryByText('Responder')).toBeNull()
    expect(within(dialog).getByText('Nota interna')).toBeTruthy()

    fireEvent.change(within(dialog).getByLabelText('Buscar atalho'), {
      target: { value: 'xyz-nada' },
    })
    expect(within(dialog).getByText('Nenhum atalho encontrado.')).toBeTruthy()
  })

  it('lists everything on "Todos", grouped', async () => {
    renderSheet()
    press('?', { shiftKey: true })
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('tab', { name: 'Todos' }))
    expect(within(dialog).getByText('Ir para o CRM')).toBeTruthy()
    expect(
      within(dialog).getByRole('heading', { name: 'Comunicação' }),
    ).toBeTruthy()
    // Ranges read as "1 a 9".
    const tabRow = dialog.querySelector('[data-shortcut-id="sd.ticket.tab"]')
    expect(tabRow?.textContent).toContain('a')
  })

  it('opens with Ctrl+/ while typing and toggles closed', async () => {
    renderSheet()
    press('/', { ctrlKey: true }, screen.getByLabelText('Campo'))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    // "?" typed in a field never opens it.
    press('/', { ctrlKey: true })
    expect(screen.queryByRole('dialog')).toBeNull()
    press('?', { shiftKey: true }, screen.getByLabelText('Campo'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('explains when single keys are off and still shows their keys', async () => {
    renderSheet({ singleKeyEnabled: false })
    press('/', { ctrlKey: true })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/estão desligados/)).toBeTruthy()
    const reply = dialog.querySelector('[data-shortcut-id="sd.ticket.reply"]')
    expect(reply?.querySelector('kbd')?.textContent).toBe('R')
  })

  it('shows the editor group when an editor is on screen', async () => {
    render(
      <ShortcutsProvider>
        <div data-slate-editor />
        <textarea data-composer aria-label='Mensagem' />
        <ShortcutsCheatSheet />
      </ShortcutsProvider>,
    )
    press('/', { ctrlKey: true })
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Negrito')).toBeTruthy()
    expect(within(dialog).getByText('Enviar a mensagem')).toBeTruthy()
  })
})

describe('ShortcutKbd / ShortcutHint', () => {
  it('prints Ctrl or ⌘ and hides single keys when they are off', () => {
    const { container, rerender } = render(
      <ShortcutsProvider isMac={false}>
        <ShortcutKbd id='global.search' />
        <ShortcutHint id='sd.ticket.assign' />
      </ShortcutsProvider>,
    )
    expect(container.textContent).toContain('Ctrl')
    expect(container.textContent).toContain('Atribuir')
    rerender(
      <ShortcutsProvider isMac singleKeyEnabled={false}>
        <ShortcutKbd id='global.search' />
        <ShortcutHint id='sd.ticket.assign' />
        <ShortcutKbd id='nav.crm' />
      </ShortcutsProvider>,
    )
    expect(container.textContent).toContain('⌘')
    expect(container.textContent).not.toContain('depois')
    const keys = container.querySelectorAll('[data-keys]')
    expect([...keys].map((k) => k.getAttribute('data-keys'))).toEqual(['mod+k'])
  })

  it('renders sequences with "depois" and every alternative with "ou"', () => {
    const { container } = render(
      <ShortcutsProvider>
        <ShortcutKbd id='nav.crm' />
        <ShortcutKbd id='list.next' all />
      </ShortcutsProvider>,
    )
    expect(container.textContent).toContain('depois')
    expect(container.textContent).toContain('ou')
  })
})
