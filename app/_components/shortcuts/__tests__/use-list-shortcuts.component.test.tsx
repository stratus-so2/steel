import { act, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ShortcutsProvider, useShortcut } from '../shortcuts-provider'
import {
  focusedRow,
  type ListShortcutOptions,
  useListShortcuts,
} from '../use-list-shortcuts'

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  act(() => {
    window.dispatchEvent(event)
  })
  return event
}

type Extra = Omit<ListShortcutOptions, 'containerRef'>

function List({
  extra = {},
  kanban = false,
}: {
  extra?: Extra
  kanban?: boolean
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  useListShortcuts({
    containerRef: ref,
    isSelected: (id) => selected.includes(id),
    onToggleSelect: (id) =>
      setSelected((cur) =>
        cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
      ),
    onSelectAll: () => setSelected(['a', 'b', 'c']),
    onClearSelection: () => {
      if (selected.length === 0) return false
      setSelected([])
    },
    ...extra,
  })
  const rows = kanban
    ? [
        ['a', 'todo'],
        ['b', 'todo'],
        ['c', 'done'],
      ]
    : [
        ['a', ''],
        ['b', ''],
        ['c', ''],
      ]
  return (
    <div ref={ref}>
      <p data-testid='selected'>{selected.join(',')}</p>
      {kanban ? (
        <>
          <section data-shortcut-column-id='todo' />
          <section data-shortcut-column-id='doing' />
          <section data-shortcut-column-id='done' />
        </>
      ) : null}
      {rows.map(([id, column]) => (
        // biome-ignore lint/a11y/useSemanticElements: test rows
        <div
          key={id}
          role='button'
          tabIndex={0}
          data-shortcut-row={id}
          data-shortcut-column={column || undefined}
          data-shortcut-href={id === 'c' ? '/x/c' : undefined}
        >
          Linha {id}
        </div>
      ))}
    </div>
  )
}

function focused() {
  return focusedRow(document.body)?.dataset.shortcutRow
}

describe('useListShortcuts', () => {
  it('moves with J/K, selects with X and extends with Shift+J/K', () => {
    render(
      <ShortcutsProvider>
        <List />
      </ShortcutsProvider>,
    )
    // Arrows wait for the list to have the focus.
    expect(press('ArrowDown').defaultPrevented).toBe(false)
    press('j')
    expect(focused()).toBe('a')
    press('ArrowDown')
    expect(focused()).toBe('b')
    press('k')
    expect(focused()).toBe('a')
    press('x')
    expect(screen.getByTestId('selected').textContent).toBe('a')
    press('J', { shiftKey: true })
    expect(screen.getByTestId('selected').textContent).toBe('a,b')
    expect(focused()).toBe('b')
    press('K', { shiftKey: true })
    expect(focused()).toBe('a')
    press('Escape')
    expect(screen.getByTestId('selected').textContent).toBe('')
    // Nothing to clear: Esc goes on.
    expect(press('Escape').defaultPrevented).toBe(false)
    press('a', { ctrlKey: true })
    expect(screen.getByTestId('selected').textContent).toBe('a,b,c')
  })

  it('opens with Enter/O: callback, href or click', () => {
    const onOpen = vi.fn()
    const navigate = vi.fn()
    const { unmount } = render(
      <ShortcutsProvider navigate={navigate}>
        <List extra={{ onOpen }} />
      </ShortcutsProvider>,
    )
    press('o')
    expect(onOpen).not.toHaveBeenCalled()
    press('j')
    press('Enter')
    expect(onOpen).toHaveBeenCalledWith('a', expect.any(HTMLElement))
    unmount()

    render(
      <ShortcutsProvider navigate={navigate}>
        <List />
      </ShortcutsProvider>,
    )
    press('k')
    expect(focused()).toBe('c')
    press('o')
    expect(navigate).toHaveBeenCalledWith('/x/c')
  })

  it('runs the toolbar keys and falls back to the global search', () => {
    const onNew = vi.fn()
    const onFilters = vi.fn()
    const onToggleView = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const search = vi.fn()
    function GlobalSearch() {
      useShortcut('global.search', search)
      return null
    }
    render(
      <ShortcutsProvider>
        <GlobalSearch />
        <List extra={{ onNew, onFilters, onToggleView, onEdit, onDelete }} />
      </ShortcutsProvider>,
    )
    press('n')
    press('f')
    press('v')
    press('/')
    press('e')
    expect(onEdit).not.toHaveBeenCalled()
    press('#')
    expect(onDelete).toHaveBeenCalledWith(null)
    press('j')
    press('e')
    press('#')
    expect(onNew).toHaveBeenCalledTimes(1)
    expect(onFilters).toHaveBeenCalledTimes(1)
    expect(onToggleView).toHaveBeenCalledTimes(1)
    expect(search).toHaveBeenCalledTimes(1)
    expect(onEdit).toHaveBeenCalledWith('a')
    expect(onDelete).toHaveBeenLastCalledWith('a')
  })

  it('walks and moves kanban cards across columns', () => {
    const onMove = vi.fn()
    render(
      <ShortcutsProvider>
        <List kanban extra={{ onMove }} />
      </ShortcutsProvider>,
    )
    expect(press('ArrowRight').defaultPrevented).toBe(false)
    press('j')
    press('ArrowRight')
    // Skips the empty "doing" column.
    expect(focused()).toBe('c')
    press('ArrowRight')
    expect(focused()).toBe('c')
    press('ArrowLeft')
    expect(focused()).toBe('a')
    press('ArrowRight', { shiftKey: true })
    expect(onMove).toHaveBeenCalledWith('a', 'doing', 1)
    press('ArrowLeft', { shiftKey: true })
    expect(onMove).toHaveBeenCalledTimes(1)
  })

  it('leaves arrows alone in a plain list and without callbacks', () => {
    render(
      <ShortcutsProvider>
        <List />
      </ShortcutsProvider>,
    )
    press('j')
    expect(press('ArrowLeft').defaultPrevented).toBe(false)
    expect(press('ArrowRight', { shiftKey: true }).defaultPrevented).toBe(false)
    expect(press('n').defaultPrevented).toBe(false)
  })
})
