import { act, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  isRichEditorTarget,
  isTypingTarget,
  ShortcutsProvider,
  topOverlay,
  useIsMac,
  useShortcut,
  useShortcuts,
} from '../shortcuts-provider'
import { useQuickSend } from '../use-quick-send'

function Bind({
  id,
  handler,
  enabled,
  inDialog = false,
}: {
  id: string
  handler: (e: KeyboardEvent, keys: string) => unknown
  enabled?: boolean
  inDialog?: boolean
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  useShortcut(id, handler, { enabled, ref })
  return inDialog ? (
    <div role='dialog'>
      <span ref={ref} />
    </div>
  ) : (
    <span ref={ref} />
  )
}

function press(key: string, init: KeyboardEventInit = {}, target?: Element) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  act(() => {
    ;(target ?? window).dispatchEvent(event)
  })
  return event
}

describe('ShortcutsProvider', () => {
  it('fires a binding and prevents the default only then', () => {
    const handler = vi.fn()
    render(
      <ShortcutsProvider>
        <Bind id='list.new' handler={handler} />
      </ShortcutsProvider>,
    )
    const fired = press('n')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(fired.defaultPrevented).toBe(true)
    const ignored = press('q')
    expect(ignored.defaultPrevented).toBe(false)
  })

  it('runs G sequences', () => {
    const crm = vi.fn()
    render(
      <ShortcutsProvider>
        <Bind id='nav.crm' handler={crm} />
      </ShortcutsProvider>,
    )
    press('g')
    expect(crm).not.toHaveBeenCalled()
    press('c')
    expect(crm).toHaveBeenCalledTimes(1)
  })

  it('never fires single keys while typing, but lets Ctrl+K through', () => {
    const single = vi.fn()
    const search = vi.fn()
    render(
      <ShortcutsProvider>
        <Bind id='list.new' handler={single} />
        <Bind id='global.search' handler={search} />
        <input aria-label='campo' />
        <div contentEditable data-slate-editor suppressContentEditableWarning>
          texto
        </div>
      </ShortcutsProvider>,
    )
    const input = screen.getByLabelText('campo')
    press('n', {}, input)
    expect(single).not.toHaveBeenCalled()
    press('k', { ctrlKey: true }, input)
    expect(search).toHaveBeenCalledTimes(1)

    // Inside the rich editor Ctrl+K is the editor's "link".
    const editor = document.querySelector('[data-slate-editor]') as Element
    press('k', { ctrlKey: true }, editor)
    expect(search).toHaveBeenCalledTimes(1)
  })

  it('ignores keys a component already handled and IME composition', () => {
    const handler = vi.fn()
    render(
      <ShortcutsProvider>
        <Bind id='list.new' handler={handler} />
      </ShortcutsProvider>,
    )
    const event = new KeyboardEvent('keydown', {
      key: 'n',
      bubbles: true,
      cancelable: true,
    })
    event.preventDefault()
    act(() => {
      window.dispatchEvent(event)
    })
    press('n', { isComposing: true })
    press('Shift', { shiftKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('traps keys while a dialog is open, except the dialog’s own', () => {
    const outside = vi.fn()
    const inside = vi.fn()
    render(
      <ShortcutsProvider>
        <Bind id='list.new' handler={outside} />
        <Bind id='list.next' handler={inside} inDialog />
      </ShortcutsProvider>,
    )
    press('n')
    press('j')
    expect(outside).not.toHaveBeenCalled()
    expect(inside).toHaveBeenCalledTimes(1)
  })

  it('falls through when a handler returns false', () => {
    const outer = vi.fn()
    const inner = vi.fn(() => false)
    render(
      <ShortcutsProvider>
        <Bind id='global.escape' handler={outer} />
        <Bind id='list.clear' handler={inner} />
      </ShortcutsProvider>,
    )
    press('Escape')
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).toHaveBeenCalledTimes(1)

    outer.mockReturnValue(false as never)
    const event = press('Escape')
    expect(event.defaultPrevented).toBe(false)
  })

  it('skips disabled bindings and honors the single-key preference', () => {
    const disabled = vi.fn()
    const single = vi.fn()
    const arrow = vi.fn()
    render(
      <ShortcutsProvider singleKeyEnabled={false}>
        <Bind id='list.new' handler={disabled} enabled={false} />
        <Bind id='list.toggle-select' handler={single} />
        <Bind id='list.next' handler={arrow} />
      </ShortcutsProvider>,
    )
    press('n')
    press('x')
    press('j')
    press('ArrowDown')
    expect(disabled).not.toHaveBeenCalled()
    expect(single).not.toHaveBeenCalled()
    expect(arrow).toHaveBeenCalledTimes(1)
  })

  it('uses ⌘ as mod on Mac', () => {
    const handler = vi.fn()
    render(
      <ShortcutsProvider isMac>
        <Bind id='global.search' handler={handler} />
      </ShortcutsProvider>,
    )
    press('k', { ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
    press('k', { metaKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('triggers a binding by id and reports what is mounted', () => {
    const handler = vi.fn()
    let api: ReturnType<typeof useShortcuts> = null
    function Probe() {
      api = useShortcuts()
      return null
    }
    render(
      <ShortcutsProvider quickSendMode='CTRL_ENTER'>
        <Bind id='global.search' handler={handler} />
        <Bind id='list.new' handler={vi.fn()} enabled={false} />
        <Probe />
      </ShortcutsProvider>,
    )
    expect(api).not.toBeNull()
    const ctx = api as unknown as NonNullable<ReturnType<typeof useShortcuts>>
    expect(ctx.trigger('global.search')).toBe(true)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(ctx.trigger('list.new')).toBe(false)
    expect([...ctx.activeIds()]).toEqual(['global.search'])
    expect(ctx.quickSendMode).toBe('CTRL_ENTER')
  })

  it('does nothing outside the provider', () => {
    const handler = vi.fn()
    function Outside() {
      useShortcut('list.new', handler)
      const mac = useIsMac()
      const quick = useQuickSend()
      return (
        <span>
          {String(mac)} {quick.mode} {quick.hint}
        </span>
      )
    }
    render(<Outside />)
    press('n')
    expect(handler).not.toHaveBeenCalled()
    expect(
      screen.getByText(/false ENTER Enter envia · Shift\+Enter quebra linha/),
    ).toBeTruthy()
  })
})

describe('DOM helpers', () => {
  it('detects typing targets', () => {
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    const text = document.createElement('input')
    const area = document.createElement('textarea')
    const div = document.createElement('div')
    expect(isTypingTarget(checkbox)).toBe(false)
    expect(isTypingTarget(text)).toBe(true)
    expect(isTypingTarget(area)).toBe(true)
    expect(isTypingTarget(div)).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
    expect(isRichEditorTarget(div)).toBe(false)
  })

  it('finds the open overlay and skips closed or hidden ones', () => {
    document.body.innerHTML = `
      <div role="dialog" data-closed></div>
      <div aria-hidden="true"><div role="menu"></div></div>
    `
    expect(topOverlay()).toBeNull()
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div role="dialog" id="d"></div>',
    )
    expect(topOverlay()?.id).toBe('d')
    document.body.innerHTML = ''
  })
})
